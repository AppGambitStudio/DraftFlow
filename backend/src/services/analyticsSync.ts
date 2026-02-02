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
            // Find all unique tenants with active posts
            const activePosts = await Post.findAll({
                where: {
                    status: 'PUBLISHED',
                    scheduledTime: { [Op.gte]: thirtyDaysAgo },
                    [Op.or]: [
                        { lastStatsSyncedAt: null },
                        { lastStatsSyncedAt: { [Op.lt]: twentyHoursAgo } }
                    ]
                },
                attributes: ['tenantId'],
                group: ['tenantId']
            });

            const tenantIds = activePosts.map(p => p.tenantId).filter(Boolean) as string[];
            console.log(`[AnalyticsSync] Found ${tenantIds.length} tenants with posts needing sync.`);

            for (const tenantId of tenantIds) {
                await this.syncTenantPosts(tenantId);
            }

            console.log('[AnalyticsSync] All syncs completed.');
        } catch (error) {
            console.error('[AnalyticsSync] Error in syncAllRecentPosts:', error);
        }
    }

    async syncTenantPosts(tenantId: string) {
        console.log(`[AnalyticsSync] Syncing for tenant: ${tenantId}`);
        const thirtyDaysAgo = subDays(new Date(), 30);

        try {
            // Respect the 50 posts/day extraction limit mentioned in standard practices
            const posts = await Post.findAll({
                where: {
                    tenantId,
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
                    let stats = await linkedinService.getPostStats(tenantId, postIds, authorUrn === 'SELF' ? undefined : authorUrn);

                    // If aggregate stats failed, try granular extraction via v2 socialActions
                    if (stats.length === 0) {
                        console.log(`[AnalyticsSync] Aggregate stats returned empty for ${authorUrn}. Trying granular fallback for ${group.length} posts...`);
                        for (const post of group) {
                            const granular = await linkedinService.getDetailedSocialActions(tenantId, post.linkedinPostId!);
                            if (granular === null) {
                                console.log(`[AnalyticsSync] Rate limited by LinkedIn. Stopping granular sync.`);
                                break;
                            }
                            if (granular) {
                                await post.update({
                                    likesCount: granular.likes,
                                    commentsCount: granular.comments,
                                    repostsCount: granular.reposts || 0,
                                    impressionsCount: granular.impressions || 0,
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
                const stats = await twitterService.getTweetStats(tenantId, tweetIds);

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
            console.error(`[AnalyticsSync] Error syncing tenant ${tenantId}:`, error);
        }
    }

    // Alias for backward compatibility or if needed specifically for userId somewhere
    async syncUserPosts(userId: string) {
        // Find tenantId for this user
        const { TenantMember } = require('../db');
        const membership = await TenantMember.findOne({ where: { userId } });
        if (membership) {
            return this.syncTenantPosts(membership.tenantId);
        }
    }
}

export const analyticsSyncService = new AnalyticsSyncService();
