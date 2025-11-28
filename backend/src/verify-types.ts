import { Post, Settings, initDB } from './db';

async function verifyTypes() {
    await initDB();

    // Check if static methods exist (TypeScript check)
    const posts = await Post.findAll();
    console.log('Posts found:', posts.length);

    const newPost = await Post.create({
        content: 'Type Check Post',
        scheduledTime: new Date(),
        status: 'DRAFT'
    });
    console.log('Post created:', newPost.id);

    const foundPost = await Post.findByPk(newPost.id);
    console.log('Post found by PK:', foundPost?.content);
}

verifyTypes().catch(console.error);
