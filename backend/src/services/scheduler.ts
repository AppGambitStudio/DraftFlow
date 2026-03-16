import cron from 'node-cron';
import { Post, Idea, Settings, WeeklyDigest } from '../db';
import { linkedinService } from './linkedin';
import { twitterService } from './twitter';
import { Op } from 'sequelize';
import { markdownToUnicode } from '../utils/markdownToUnicode';
import { AIService } from './ai';
import { analyticsSyncService } from './analyticsSync';
import { RssService } from './rss';

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
                // Atomic update to 'PUBLISHING' to prevent race conditions
                const [affectedCount] = await Post.update(
                    { status: 'PUBLISHING' },
                    {
                        where: {
                            id: post.id,
                            status: 'SCHEDULED'
                        }
                    }
                );

                // If affectedCount is 0, another instance already picked this up
                if (affectedCount === 0) {
                    console.log(`[Scheduler] Post ${post.id} already being processed by another instance.`);
                    continue;
                }

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
                        const contentToPublish = markdownToUnicode(post.content);
                        const attachments = post.mediaUrls ? JSON.parse(post.mediaUrls) : [];
                        const linkedinId = await linkedinService.publishPost(post.tenantId as string, contentToPublish, post.authorUrn || undefined, attachments);
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
                        const attachments = post.mediaUrls ? JSON.parse(post.mediaUrls) : [];
                        const twitterId = await twitterService.publishTweet(post.tenantId as string, post.content, attachments);
                        await post.update({ twitterPostId: twitterId });
                        results.push('Twitter');
                    } catch (error: any) {
                        console.error(`Failed to publish post ${post.id} to Twitter:`, error);
                        errors.push(`Twitter: ${error.message}`);
                    }
                }

                if (errors.length > 0) {
                    if (results.length === 0) {
                        await post.update({
                            status: 'FAILED',
                            error: errors.join('; '),
                        });
                    } else {
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

                // Trigger analytics sync after successful publish (delayed to let LinkedIn process)
                if (results.length > 0 && post.tenantId) {
                    setTimeout(() => {
                        console.log(`[Scheduler] Triggering post-publish analytics sync for tenant ${post.tenantId}`);
                        analyticsSyncService.syncTenantPosts(post.tenantId as string).catch(err => {
                            console.error('[Scheduler] Post-publish analytics sync error:', err);
                        });
                    }, 60000); // 1 minute delay
                }
            }
        } catch (error) {
            console.error('Error in scheduler:', error);
        }

        // Clean up stuck GENERATING posts (older than 10 minutes)
        try {
            const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
            const [stuckCount] = await Post.update(
                { status: 'FAILED', error: 'Generation timed out' },
                {
                    where: {
                        status: 'GENERATING',
                        createdAt: { [Op.lte]: tenMinutesAgo }
                    }
                }
            );
            if (stuckCount > 0) {
                console.log(`[Scheduler] Cleaned up ${stuckCount} stuck GENERATING post(s)`);
            }
        } catch (cleanupError) {
            console.error('[Scheduler] Error cleaning up stuck posts:', cleanupError);
        }

        // Check for recurring ideas
        await checkRecurringIdeas();

        // Check for scheduled weekly digests
        await checkScheduledDigests();
    });

    // Run every day at midnight
    cron.schedule('0 0 * * *', async () => {
        analyticsSyncService.syncAllRecentPosts();

        // Refresh all RSS feeds daily
        try {
            console.log('[Scheduler] Starting daily RSS feed refresh...');
            await RssService.refreshAllTenantFeeds();
            console.log('[Scheduler] RSS feed refresh complete');
        } catch (err) {
            console.error('[Scheduler] RSS feed refresh error:', err);
        }
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
                    // Atomic update to mark as starting generation to prevent double-runs
                    const [affectedCount] = await Idea.update(
                        { lastGeneratedAt: now },
                        {
                            where: {
                                id: idea.id,
                                lastGeneratedAt: idea.lastGeneratedAt // Ensure it hasn't changed since our check
                            }
                        }
                    );

                    if (affectedCount === 0) {
                        console.log(`[Scheduler] Idea ${idea.id} already being processed by another instance.`);
                        continue;
                    }

                    console.log(`[Scheduler] Generation triggered for Idea ${idea.id}: "${idea.title}" (${idea.frequency})`);

                    // Calculate scheduled time for the post
                    const postScheduledTime = new Date();
                    if (idea.frequency === 'DAILY') {
                        postScheduledTime.setDate(postScheduledTime.getDate() + 1);
                    } else if (idea.frequency === 'WEEKLY') {
                        postScheduledTime.setDate(postScheduledTime.getDate() + 7);
                    } else if (idea.frequency === 'MONTHLY') {
                        postScheduledTime.setMonth(postScheduledTime.getMonth() + 1);
                    }
                    postScheduledTime.setHours(targetHour, targetMinute, 0, 0);

                    // Create placeholder post first so we can link it in the idea's history
                    const post = await Post.create({
                        content: `Generating post from idea: ${idea.title}...`,
                        userId: idea.userId,
                        tenantId: idea.tenantId,
                        scheduledTime: postScheduledTime,
                        status: 'GENERATING',
                        platforms: JSON.stringify(['LINKEDIN']),
                        authorUrn: idea.authorUrn,
                        authorName: idea.authorName,
                        mediaUrls: '[]',
                    });

                    // Generate content and summary, passing postId so it's stored in the idea's history
                    try {
                        const { content } = await AIService.generateForIdea(
                            idea.tenantId as string,
                            idea,
                            'LinkedIn',
                            undefined,
                            post.id
                        );

                        await post.update({ content, status: 'DRAFT' });
                        console.log(`[Scheduler] Successfully generated draft for Idea ${idea.id}`);
                    } catch (genError: any) {
                        console.error(`[Scheduler] AI generation failed for Idea ${idea.id}, Post ${post.id}:`, genError.message);
                        await post.update({
                            status: 'FAILED',
                            error: genError.message || 'AI generation failed',
                        });
                    }
                }
            } catch (ideaError: any) {
                console.error(`[Scheduler] Error processing Idea ${idea.id}:`, ideaError);
            }
        }
    } catch (error) {
        console.error('[Scheduler] Error in checkRecurringIdeas:', error);
    }
};

// Track in-progress digest generation to prevent race conditions
const digestsInProgress = new Set<string>();

const checkScheduledDigests = async () => {
    try {
        // Find all settings with digestConfig that has scheduleEnabled
        const allSettings = await Settings.findAll({
            where: {
                digestConfig: { [Op.not]: null }
            }
        });

        const now = new Date();
        const currentDayOfWeek = now.getDay(); // 0-6 (Sun-Sat)
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        for (const settings of allSettings) {
            try {
                const tenantId = settings.tenantId as string;
                const config = JSON.parse(settings.digestConfig || '{}');
                if (!config.scheduleEnabled || !config.topics || config.topics.length === 0) continue;

                const targetDayOfWeek = config.scheduleDayOfWeek ?? 1; // Monday default
                if (currentDayOfWeek !== targetDayOfWeek) continue;

                const timeParts = (config.scheduleTime || '09:00').split(':');
                const targetHour = parseInt(timeParts[0] || '9', 10);
                const targetMinute = parseInt(timeParts[1] || '0', 10);
                const timeHasPassed = (currentHour > targetHour) || (currentHour === targetHour && currentMinute >= targetMinute);
                if (!timeHasPassed) continue;

                // Skip if already generating for this tenant
                if (digestsInProgress.has(tenantId)) continue;

                // Check if we already generated one today
                const todayStart = new Date();
                todayStart.setHours(0, 0, 0, 0);

                const existingToday = await WeeklyDigest.findOne({
                    where: {
                        tenantId,
                        createdAt: { [Op.gte]: todayStart }
                    }
                });

                if (existingToday) continue;

                // Mark as in-progress to prevent duplicate runs
                digestsInProgress.add(tenantId);

                console.log(`[Scheduler] Auto-generating weekly digest for tenant ${tenantId}`);

                try {
                    const result = await AIService.generateWeeklyDigest(tenantId, {
                        topics: config.topics,
                        platform: config.platform || 'linkedin',
                        storyCount: config.storyCount || 5,
                        additionalContext: config.additionalContext || undefined,
                        authorUrn: config.authorUrn || undefined,
                    });

                    // Auto-save as draft post
                    const post = await Post.create({
                        content: result.content,
                        tenantId,
                        userId: settings.userId,
                        platforms: JSON.stringify([(config.platform || 'linkedin').toUpperCase()]),
                        status: 'DRAFT',
                        scheduledTime: new Date(),
                        authorUrn: config.authorUrn || null,
                        mediaUrls: '[]',
                    });

                    // Link the digest to the post
                    const digest = await WeeklyDigest.findByPk(result.digestId);
                    if (digest) {
                        await digest.update({ postId: post.id });
                    }

                    console.log(`[Scheduler] Weekly digest generated for tenant ${tenantId}, post ${post.id}`);
                } finally {
                    digestsInProgress.delete(tenantId);
                }
            } catch (err: any) {
                console.error(`[Scheduler] Error generating weekly digest for tenant ${settings.tenantId}:`, err.message);
                digestsInProgress.delete(settings.tenantId as string);
            }
        }
    } catch (error) {
        console.error('[Scheduler] Error in checkScheduledDigests:', error);
    }
};
