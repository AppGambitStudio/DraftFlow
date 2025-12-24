import cron from 'node-cron';
import { Post, Idea } from '../db';
import { linkedinService } from './linkedin';
import { twitterService } from './twitter';
import { Op } from 'sequelize';
import { markdownToUnicode } from '../utils/markdownToUnicode';
import { AIService } from './ai';

export const startScheduler = () => {
    console.log('Scheduler started...');

    // Run every minute
    cron.schedule('* * * * *', async () => {
        console.log('Checking for scheduled posts...');
        const now = new Date();

        try {
            const postsToPublish = await Post.findAll({
                where: {
                    status: 'SCHEDULED',
                    scheduledTime: {
                        [Op.lte]: now
                    }
                }
            });

            for (const post of postsToPublish) {
                // Parse platforms
                let platforms: string[] = ['LINKEDIN'];
                try {
                    if (post.platforms) {
                        platforms = JSON.parse(post.platforms);
                    }
                } catch (e) {
                    console.error('Error parsing platforms:', e);
                }

                console.log(`Publishing post ${post.id} to ${platforms.join(', ')}`);

                const results = [];
                const errors = [];

                // Publish to LinkedIn
                if (platforms.includes('LINKEDIN')) {
                    try {
                        // Assuming linkedinService is imported and available
                        // The original publishPost function is replaced here
                        // Convert Markdown to Unicode for LinkedIn
                        const contentToPublish = markdownToUnicode(post.content);
                        const linkedinId = await linkedinService.publishPost(post.userId as string, contentToPublish, post.authorUrn || undefined);
                        await post.update({ linkedinPostId: linkedinId });
                        results.push('LinkedIn');
                    } catch (error: any) {
                        console.error(`Failed to publish post ${post.id} to LinkedIn:`, error);
                        errors.push(`LinkedIn: ${error.message}`);
                    }
                }

                // Publish to Twitter
                if (platforms.includes('TWITTER')) {
                    try {
                        // Assuming twitterService is imported and available
                        const twitterId = await twitterService.publishTweet(post.userId as string, post.content);
                        await post.update({ twitterPostId: twitterId });
                        results.push('Twitter');
                    } catch (error: any) {
                        console.error(`Failed to publish post ${post.id} to Twitter:`, error);
                        errors.push(`Twitter: ${error.message}`);
                    }
                }

                if (errors.length > 0) {
                    // If all failed, mark as FAILED
                    if (results.length === 0) {
                        await post.update({
                            status: 'FAILED',
                            error: errors.join('; '),
                        });
                    } else {
                        // If some succeeded, mark as PUBLISHED but log errors
                        // Ideally we'd have a PARTIAL_SUCCESS status, but for now PUBLISHED with error note
                        await post.update({
                            status: 'PUBLISHED',
                            error: `Partial success. Published to: ${results.join(', ')}. Failed: ${errors.join('; ')}`,
                        });
                    }
                } else {
                    await post.update({
                        status: 'PUBLISHED',
                        error: null,
                    });
                }
            }
        } catch (error) {
            console.error('Error in scheduler:', error);
        }

        // Check for recurring ideas
        await checkRecurringIdeas();
    });
};

const checkRecurringIdeas = async () => {
    try {

        const recurringIdeas = await Idea.findAll({
            where: {
                isRecurring: true,
                frequency: { [Op.not]: null }
            }
        });

        const now = new Date();
        const currentDayOfWeek = now.getDay(); // 0-6 (Sun-Sat)
        const currentDayOfMonth = now.getDate();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        for (const idea of recurringIdeas) {
            try {
                let shouldGenerate = false;
                const lastRun = idea.lastGeneratedAt ? new Date(idea.lastGeneratedAt) : null;

                // 1. Time Check (Requirement: Current time must be at or after idea.scheduleTime)
                const timeParts = (idea.scheduleTime || "09:00").split(':');
                const targetHour = parseInt(timeParts[0] || "9", 10);
                const targetMinute = parseInt(timeParts[1] || "0", 10);

                const timeHasPassed = (currentHour > targetHour) || (currentHour === targetHour && currentMinute >= targetMinute);

                if (isNaN(targetHour) || isNaN(targetMinute) || !timeHasPassed) continue;

                // 2. Frequency & Recency Check (Requirement: Correct day and not already run today)
                const hoursSinceLastRun = lastRun ? (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60) : 999999;

                if (idea.frequency === 'DAILY') {
                    if (hoursSinceLastRun >= 23) shouldGenerate = true;
                } else if (idea.frequency === 'WEEKLY') {
                    // Check if today is the correct day of week
                    const dayOfWeekToRun = idea.scheduleDayOfWeek !== null ? idea.scheduleDayOfWeek : 1; // Default Monday
                    if (currentDayOfWeek === dayOfWeekToRun && hoursSinceLastRun >= 23) shouldGenerate = true;
                } else if (idea.frequency === 'MONTHLY') {
                    const dayOfMonthToRun = idea.scheduleDayOfMonth !== null ? idea.scheduleDayOfMonth : 1;
                    if (currentDayOfMonth === dayOfMonthToRun && hoursSinceLastRun >= 23) shouldGenerate = true;
                }

                if (shouldGenerate) {
                    console.log(`[Scheduler] Generation triggered for Idea ${idea.id}: "${idea.title}" (${idea.frequency})`);

                    const prompt = `
                    Write a fresh, engaging LinkedIn post based on this core idea. 
                    Make it distinct from previous variations if possible.
                    
                    Title: ${idea.title}
                    Core Concept: ${idea.description}
                    Tags: ${idea.tags}
                    `;

                    // Generate content
                    const content = await AIService.improvise(idea.userId as string, prompt);

                    // Calculate next scheduled time for the post
                    // If generated today, maybe schedule for next occurrence?
                    // Typically, if we generate it now, we want it to show up as a draft for the NEXT slot.
                    const postScheduledTime = new Date();
                    if (idea.frequency === 'DAILY') {
                        postScheduledTime.setDate(postScheduledTime.getDate() + 1);
                    } else if (idea.frequency === 'WEEKLY') {
                        postScheduledTime.setDate(postScheduledTime.getDate() + 7);
                    } else if (idea.frequency === 'MONTHLY') {
                        postScheduledTime.setMonth(postScheduledTime.getMonth() + 1);
                    }
                    postScheduledTime.setHours(targetHour, targetMinute, 0, 0);

                    // Create Post
                    await Post.create({
                        content,
                        userId: idea.userId,
                        scheduledTime: postScheduledTime,
                        status: 'DRAFT',
                        platforms: JSON.stringify(['LINKEDIN']),
                        authorUrn: idea.authorUrn,
                        authorName: idea.authorName,
                    });

                    // Update lastGeneratedAt ONLY after success
                    await idea.update({ lastGeneratedAt: now });

                    console.log(`[Scheduler] Successfully generated draft for Idea ${idea.id}`);
                }
            } catch (ideaError: any) {
                console.error(`[Scheduler] Error processing Idea ${idea.id}:`, ideaError);
            }
        }
    } catch (error) {
        console.error('[Scheduler] Error in checkRecurringIdeas:', error);
    }
};
