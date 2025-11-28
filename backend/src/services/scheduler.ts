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
    });
};
