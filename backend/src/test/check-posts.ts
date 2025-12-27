import { sequelize, Post } from '../db';

async function checkPosts() {
    try {
        await sequelize.authenticate();
        console.log('Database connected.');

        const posts = await Post.findAll();
        console.log('All Posts:', JSON.stringify(posts, null, 2));

        const now = new Date();
        console.log('Current Server Time:', now.toISOString());

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await sequelize.close();
    }
}

checkPosts();
