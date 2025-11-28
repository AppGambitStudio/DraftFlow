
import express from 'express';
import crypto from 'crypto';
import { Idea, Post } from '../db';
import { AIService } from '../services/ai';

const router = express.Router();

// POST /api/webhooks/n8n/idea
router.post('/n8n/idea', async (req, res) => {
    try {
        const { title, summary, tags, source } = req.body;

        // 1. Validation
        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }

        // 2. Compute Hash (Title + Summary)
        const contentString = `${title.trim()}|${(summary || '').trim()}`;
        const contentHash = crypto.createHash('sha256').update(contentString).digest('hex');

        // 3. Check for Duplicates
        const existingIdea = await Idea.findOne({ where: { contentHash } });
        if (existingIdea) {
            console.log(`Duplicate idea detected (Hash: ${contentHash}). Skipping.`);
            return res.status(200).json({ message: 'Duplicate idea skipped', ideaId: existingIdea.id });
        }

        // 4. Create Idea
        const idea = await Idea.create({
            title,
            description: summary,
            tags: tags ? JSON.stringify(tags) : '[]',
            source: source || 'n8n',
            contentHash,
            status: 'NEW'
        });

        console.log(`Idea created via webhook: ${idea.id}`);

        // 5. Auto-Magic: Generate Draft Post using AI
        // We'll run this asynchronously so we don't block the webhook response too long, 
        // OR we can wait if n8n expects the post ID. Let's wait to ensure reliability.
        let post = null;
        try {
            const prompt = `
            Based on this idea, write a professional LinkedIn post.
            Title: ${title}
            Summary: ${summary}
            Tags: ${tags ? tags.join(', ') : ''}
            
            Keep it engaging and professional.
            `;

            const generatedContent = await AIService.improvise(prompt);

            // 6. Schedule for 1 week later
            const scheduledTime = new Date();
            scheduledTime.setDate(scheduledTime.getDate() + 7);

            post = await Post.create({
                content: generatedContent,
                scheduledTime: scheduledTime,
                status: 'DRAFT', // Keep as DRAFT for review, or SCHEDULED if bold. Let's stick to DRAFT for safety.
                platforms: JSON.stringify(['LINKEDIN']),
            });

            // Update idea status
            idea.status = 'DRAFTED';
            await idea.save();

            console.log(`Draft post created for idea ${idea.id}: ${post.id}`);

        } catch (aiError) {
            console.error('Failed to generate auto-post for idea:', aiError);
            // We still return success for the idea creation
        }

        res.status(201).json({
            message: 'Idea processed successfully',
            ideaId: idea.id,
            postId: post?.id || null
        });

    } catch (error: any) {
        console.error('Webhook Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;
