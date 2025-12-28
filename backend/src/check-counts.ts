
import { initDB, Post, User } from './db';

const run = async () => {
    await initDB();

    const posts = await Post.findAll();
    const total = posts.length;
    const drafts = posts.filter(p => p.status === 'DRAFT').length;
    const scheduled = posts.filter(p => p.status === 'SCHEDULED').length;
    const published = posts.filter(p => p.status === 'PUBLISHED').length;
    const failed = posts.filter(p => p.status === 'FAILED').length;

    console.log('--- DB COUNTS ---');
    console.log('Total:', total);
    console.log('Drafts:', drafts);
    console.log('Scheduled:', scheduled);
    console.log('Published:', published);
    console.log('Failed:', failed);
    console.log('Sum of states:', drafts + scheduled + published + failed);
};

run();
