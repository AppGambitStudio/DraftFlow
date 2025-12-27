import { initDB } from '../db';
import { analyticsSyncService } from '../services/analyticsSync';
import dotenv from 'dotenv';

dotenv.config();

async function runOnce() {
    console.log('--- Manual Analytics Sync Triggered ---');
    try {
        await initDB();
        await analyticsSyncService.syncAllRecentPosts();
        console.log('--- Manual Sync Finished ---');
        process.exit(0);
    } catch (error) {
        console.error('Manual Sync Failed:', error);
        process.exit(1);
    }
}

runOnce();
