
import { initDB, Post, User, Settings, TenantMember } from './db';
import { linkedinService } from './services/linkedin';
import { Op } from 'sequelize';

const run = async () => {
    await initDB();

    console.log('--- SYNCING LINKEDIN HISTORY ---');

    // 1. Get first membership
    const membership = await TenantMember.findOne();
    if (!membership) {
        console.error('No memberships found');
        return;
    }
    const { userId, tenantId } = membership;
    console.log(`Syncing for Tenant: ${tenantId} (User: ${userId})`);

    // 2. Fetch recent posts from LinkedIn
    console.log('Fetching recent posts from LinkedIn...');
    const recentPosts = await linkedinService.getRecentPosts(tenantId, undefined, 20);
    console.log(`Found ${recentPosts.length} posts on LinkedIn.`);

    let added = 0;
    let skipped = 0;

    for (const liPost of recentPosts) {
        // Check if exists
        const exists = await Post.findOne({
            where: {
                [Op.or]: [
                    { linkedinPostId: liPost.id },
                ]
            }
        });

        if (exists) {
            skipped++;
            // Optional: Update status if needed?
            if (exists.status !== 'PUBLISHED') {
                console.log(`Updating status for post ${exists.id} to PUBLISHED`);
                exists.status = 'PUBLISHED';
                exists.linkedinPostId = liPost.id;
                await exists.save();
                added++; // Count as an update/add action
            }
        } else {
            // Create new post
            console.log(`Importing LinkedIn Post: ${liPost.id}`);
            await Post.create({
                userId: userId,
                tenantId: tenantId,
                content: liPost.content,
                scheduledTime: new Date(liPost.createdAt),
                status: 'PUBLISHED', // It's already live
                platforms: JSON.stringify(['LINKEDIN']),
                linkedinPostId: liPost.id,
                authorUrn: undefined, // Default
                createdAt: new Date(liPost.createdAt),
                updatedAt: new Date(liPost.createdAt)
            });
            added++;
        }
    }

    console.log('--- SYNC COMPLETE ---');
    console.log(`Added/Updated: ${added}`);
    console.log(`Skipped (Already existed): ${skipped}`);
};

run();
