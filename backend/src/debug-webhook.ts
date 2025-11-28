
import { Idea, Post, initDB } from './db';
import { AIService } from './services/ai';
import crypto from 'crypto';

async function debugWebhook() {
    await initDB();

    const title = "Debug Idea";
    const summary = "Debug Summary";
    const tags = ["debug"];
    const source = "debug-script";

    try {
        // 1. Compute Hash
        const contentString = `${title.trim()}|${(summary || '').trim()}`;
        const contentHash = crypto.createHash('sha256').update(contentString).digest('hex');
        console.log('Hash:', contentHash);

        // 2. Check Duplicate
        const existingIdea = await Idea.findOne({ where: { contentHash } });
        if (existingIdea) {
            console.log('Duplicate found:', existingIdea.id);
            // Delete it to allow re-run
            await existingIdea.destroy();
            console.log('Deleted duplicate for testing.');
        }

        // 3. Create Idea
        console.log('Creating Idea...');
        const idea = await Idea.create({
            title,
            description: summary,
            tags: JSON.stringify(tags),
            source,
            contentHash,
            status: 'NEW'
        });
        console.log('Idea created:', idea.id);

        // 4. AI Generation
        console.log('Calling AI...');
        const prompt = `
            Based on this idea, write a professional LinkedIn post.
            Title: ${title}
            Summary: ${summary}
            Tags: ${tags.join(', ')}
            
            Keep it engaging and professional.
            `;
        const generatedContent = await AIService.improvise(prompt);
        console.log('AI Content:', generatedContent);

        // 5. Create Post
        console.log('Creating Post...');
        const scheduledTime = new Date();
        scheduledTime.setDate(scheduledTime.getDate() + 7);

        const post = await Post.create({
            content: generatedContent,
            scheduledTime: scheduledTime,
            status: 'DRAFT',
            platforms: JSON.stringify(['LINKEDIN']),
        });
        console.log('Post created:', post.id);

    } catch (error) {
        console.error('Debug Error:', error);
    }
}

debugWebhook();
