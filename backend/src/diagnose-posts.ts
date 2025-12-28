
import { initDB, Post } from './db';
import { Op } from 'sequelize';

const run = async () => {
    await initDB();

    console.log('--- DIAGNOSTIC CHECK ---');

    // 1. Check for SCHEDULED posts that have a LinkedIn Post ID (Stuck in limbo)
    const stuckScheduled = await Post.findAll({
        where: {
            status: 'SCHEDULED',
            linkedinPostId: { [Op.not]: null }
        }
    });
    console.log(`SCHEDULED posts with linkedinPostId: ${stuckScheduled.length}`);
    stuckScheduled.forEach(p => console.log(` - ID: ${p.id}, LinkedInID: ${p.linkedinPostId}`));

    // 2. Check for FAILED posts that might have a LinkedIn ID (False failure?)
    const stuckFailed = await Post.findAll({
        where: {
            status: 'FAILED',
            linkedinPostId: { [Op.not]: null }
        }
    });
    console.log(`FAILED posts with linkedinPostId: ${stuckFailed.length}`);
    stuckFailed.forEach(p => console.log(` - ID: ${p.id}, LinkedInID: ${p.linkedinPostId}`));

    // 3. Check for PUBLISHING (Stuck in processing)
    const stuckPublishing = await Post.findAll({
        where: {
            status: 'PUBLISHING'
        }
    });
    console.log(`PUBLISHING posts (stuck?): ${stuckPublishing.length}`);
    stuckPublishing.forEach(p => console.log(` - ID: ${p.id}, Time: ${p.scheduledTime}`));

};

run();
