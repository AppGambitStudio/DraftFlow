import { Post, User } from '../db';
import { linkedinService } from './linkedin';
import { twitterService } from './twitter';
import { Op } from 'sequelize';
import { subDays } from 'date-fns';

export class AnalyticsSyncService {
    /**
     * Syncs stats for all active posts (published in the last 30 days) 
     * that haven't been synced in the last 20 hours.
     */
    async syncAllRecentPosts() {
        console.log('[AnalyticsSync] Starting daily stats sync...');
        const thirtyDaysAgo = subDays(new Date(), 30);
        const twentyHoursAgo = new Date(Date.now() - 20 * 60 * 60 * 1000);

        try {
            // Find all unique users with active posts
            const activePosts = await Post.findAll({
                where: {
                    status: 'PUBLISHED',
                    scheduledTime: { [Op.gte]: thirtyDaysAgo },
                    [Op.or]: [
                        { lastStatsSyncedAt: null },
                        { lastStatsSyncedAt: { [Op.lt]: twentyHoursAgo } }
                    ]
                },
                attributes: ['userId'],
                group: ['userId']
            });

            const userIds = activePosts.map(p => p.userId).filter(Boolean) as string[];
            console.log(`[AnalyticsSync] Found ${userIds.length} users with posts needing sync.`);

            for (const userId of userIds) {
                await this.syncUserPosts(userId);
            }

            console.log('[AnalyticsSync] All syncs completed.');
        } catch (error) {
            console.error('[AnalyticsSync] Error in syncAllRecentPosts:', error);
        }
    }

    async syncUserPosts(userId: string) {
        console.log(`[AnalyticsSync] Syncing for user: ${userId}`);
        const thirtyDaysAgo = subDays(new Date(), 30);

        try {
            // Respect the 50 posts/day extraction limit mentioned in standard practices
            const posts = await Post.findAll({
                where: {
                    userId,
                    status: 'PUBLISHED',
                    scheduledTime: { [Op.gte]: thirtyDaysAgo }
                },
                order: [['scheduledTime', 'DESC']],
                limit: 50
            });

            // Sync LinkedIn
            const linkedinPosts = posts.filter(p => !!p.linkedinPostId);
            if (linkedinPosts.length > 0) {
                const authorGroups: Record<string, Post[]> = {};
                linkedinPosts.forEach(p => {
                    const author = p.authorUrn || 'SELF';
                    if (!authorGroups[author]) authorGroups[author] = [];
                    authorGroups[author].push(p);
                });

                for (const [authorUrn, group] of Object.entries(authorGroups)) {
                    const postIds = group.map(p => p.linkedinPostId as string);
                    let stats = await linkedinService.getPostStats(userId, postIds, authorUrn === 'SELF' ? undefined : authorUrn);

                    // If aggregate stats failed to find these posts, try granular extraction for the most recent 10 posts
                    // to respect the extraction limit while ensuring we get data for new content.
                    if (stats.length === 0) {
                        console.log(`[AnalyticsSync] Aggregate stats returned empty for ${authorUrn}. Trying granular fallback...`);
                        const recentPosts = group.slice(0, 10);
                        for (const post of recentPosts) {
                            const granular = await linkedinService.getDetailedSocialActions(userId, post.linkedinPostId!);
                            if (granular) {
                                await post.update({
                                    likesCount: granular.likes,
                                    commentsCount: granular.comments,
                                    lastStatsSyncedAt: new Date()
                                });
                            }
                        }
                    } else {
                        for (const stat of stats) {
                            const post = group.find(p => p.linkedinPostId === stat.urn);
                            if (post) {
                                await post.update({
                                    likesCount: stat.likes,
                                    commentsCount: stat.comments,
                                    repostsCount: stat.reposts,
                                    impressionsCount: stat.impressions,
                                    lastStatsSyncedAt: new Date()
                                });
                            }
                        }
                    }
                }
            }

            // Sync Twitter
            const twitterPosts = posts.filter(p => !!p.twitterPostId);
            if (twitterPosts.length > 0) {
                const tweetIds = twitterPosts.map(p => p.twitterPostId as string);
                const stats = await twitterService.getTweetStats(userId, tweetIds);

                for (const stat of stats) {
                    const post = twitterPosts.find(p => p.twitterPostId === stat.id);
                    if (post) {
                        await post.update({
                            likesCount: stat.likes,
                            commentsCount: stat.comments,
                            repostsCount: stat.reposts,
                            impressionsCount: stat.impressions,
                            lastStatsSyncedAt: new Date()
                        });
                    }
                }
            }
        } catch (error) {
            console.error(`[AnalyticsSync] Error syncing user ${userId}:`, error);
        }
    }
}

export const analyticsSyncService = new AnalyticsSyncService();
