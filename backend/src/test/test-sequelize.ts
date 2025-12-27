import { sequelize, Settings, Post, initDB } from '../db';

async function testSequelize() {
    console.log('Testing Sequelize ORM...');

    await initDB();

    // 1. Create/Update Settings
    const existingSettings = await Settings.findOne();
    if (!existingSettings) {
        await Settings.create({ linkedinAccessToken: 'test-token' });
        console.log('Created settings.');
    } else {
        console.log('Settings exist.');
    }

    // 2. Create Post
    const newPost = await Post.create({
        content: 'Sequelize Test Post',
        scheduledTime: new Date(),
        status: 'DRAFT'
    });
    console.log('Created post:', newPost.id);

    // 3. Fetch Post
    const fetchedPost = await Post.findByPk(newPost.id);

    if (!fetchedPost) {
        console.log('Failed to fetch post');
        return;
    }
    console.log('Fetched post content:', fetchedPost.content);

    if (fetchedPost.content === 'Sequelize Test Post') {
        console.log('Sequelize Test PASSED');
    } else {
        console.log('Sequelize Test FAILED');
    }
}

testSequelize().catch(console.error);
