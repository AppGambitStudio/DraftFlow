import cron from 'node-cron';
import { Post } from '../db';
import { linkedinService } from './linkedin';
import { twitterService } from './twitter';
import { Op } from 'sequelize';
import { markdownToUnicode } from '../utils/markdownToUnicode';

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
                        const linkedinId = await linkedinService.publishPost(contentToPublish);
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
                        const twitterId = await twitterService.publishTweet(post.content);
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
        const { Idea, Post } = require('../db'); // Lazy load to avoid circular deps if any
        const { AIService } = require('./ai');

        const recurringIdeas = await Idea.findAll({
            where: {
                isRecurring: true,
                frequency: { [Op.not]: null }
            }
        });

        const now = new Date();

        for (const idea of recurringIdeas) {
            let shouldGenerate = false;
            const lastRun = idea.lastGeneratedAt ? new Date(idea.lastGeneratedAt) : null;

            if (!lastRun) {
                shouldGenerate = true;
            } else {
                const diffMs = now.getTime() - lastRun.getTime();
                const diffDays = diffMs / (1000 * 60 * 60 * 24);

                if (idea.frequency === 'DAILY' && diffDays >= 1) shouldGenerate = true;
                if (idea.frequency === 'WEEKLY' && diffDays >= 7) shouldGenerate = true;
                if (idea.frequency === 'MONTHLY' && diffDays >= 30) shouldGenerate = true;
            }

            if (shouldGenerate) {
                console.log(`Generating recurring post for idea: ${idea.title} (${idea.frequency})`);

                try {
                    // Optimistic locking: Update lastGeneratedAt BEFORE generation to prevent other workers from picking it up
                    // We use a transaction or just check if the update affected any rows
                    // Since we are using Sequelize, we can try to update with a where clause on the old timestamp

                    const [affectedRows] = await Idea.update(
                        { lastGeneratedAt: now },
                        {
                            where: {
                                id: idea.id,
                                // Ensure we only update if it hasn't changed since we read it
                                lastGeneratedAt: idea.lastGeneratedAt
                            }
                        }
                    );

                    if (affectedRows === 0) {
                        console.log(`Skipping idea ${idea.id} - already processed by another worker.`);
                        continue;
                    }

                    const prompt = `
                    Write a fresh, engaging LinkedIn post based on this core idea. 
                    Make it distinct from previous variations if possible.
                    
                    Title: ${idea.title}
                    Core Concept: ${idea.description}
                    Tags: ${idea.tags}
                    `;

                    const content = await AIService.improvise(prompt);

                    // Schedule for tomorrow same time (or just draft without time?)
                    // Let's set it to DRAFT with a tentative time of tomorrow 9am
                    const scheduledTime = new Date();
                    scheduledTime.setDate(scheduledTime.getDate() + 1);
                    scheduledTime.setHours(9, 0, 0, 0);

                    await Post.create({
                        content,
                        scheduledTime,
                        status: 'DRAFT',
                        platforms: JSON.stringify(['LINKEDIN'])
                    });

                    console.log(`Recurring post generated for idea ${idea.id}`);

                } catch (error) {
                    console.error(`Failed to generate recurring post for idea ${idea.id}:`, error);
                    // Optional: Revert lastGeneratedAt if failed, but maybe safer to just skip till next cycle
                }
            }
        }

    } catch (error) {
        console.error('Error checking recurring ideas:', error);
    }
};
