
import express from 'express';
import crypto from 'crypto';
import { Idea, Post, User, Settings, TenantMember } from '../db';
import { AIService } from '../services/ai';

const router = express.Router();

// POST /api/webhooks/idea
router.post('/idea', async (req, res) => {
    try {
        const { title, summary, tags, source } = req.body;
        const tenantIdHeader = req.headers['x-tenant-id'] as string;
        const webhookSecretHeader = req.headers['x-webhook-secret'] as string;

        if (!tenantIdHeader || !webhookSecretHeader) {
            return res.status(401).json({ error: 'X-Tenant-ID and X-Webhook-Secret headers are required' });
        }

        // Validate secret and find tenant
        const settings = await Settings.findOne({ where: { tenantId: tenantIdHeader, webhookSecret: webhookSecretHeader } });
        if (!settings) {
            return res.status(401).json({ error: 'Invalid Tenant ID or Webhook Secret' });
        }

        const tenantId = tenantIdHeader;

        // Find a user for this tenant to act as creator (ideally an owner/admin)
        const member = await TenantMember.findOne({ where: { tenantId }, order: [['role', 'ASC']] }); // OWNER is alphabetically first usually
        if (!member) {
            return res.status(500).json({ error: 'No member found for this tenant' });
        }
        const userId = member.userId;

        // 1. Validation
        if (!title) {
            return res.status(400).json({ error: 'Title is required' });
        }

        // 2. Compute Hash (Title + Summary)
        const contentString = `${title.trim()}|${(summary || '').trim()}`;
        const contentHash = crypto.createHash('sha256').update(contentString).digest('hex');

        // 3. Check for Duplicates
        const existingIdea = await Idea.findOne({ where: { contentHash, tenantId } });
        if (existingIdea) {
            console.log(`Duplicate idea detected in tenant ${tenantId} (Hash: ${contentHash}). Skipping.`);
            return res.status(200).json({ message: 'Duplicate idea skipped', ideaId: existingIdea.id });
        }

        // 4. Create Idea
        const idea = await Idea.create({
            title,
            userId,
            tenantId,
            description: summary,
            tags: tags ? JSON.stringify(tags) : '[]',
            source: source || 'webhook',
            contentHash,
            status: 'NEW',
            isRecurring: false,
            frequency: null,
            lastGeneratedAt: null,
            generatedSummaries: '[]',
            sourceLinks: '[]',
        });

        console.log(`Idea created via webhook for tenant ${tenantId}: ${idea.id}`);
        // 5. Auto-Magic: Generate Draft Post using AI
        let post = null;
        try {
            const prompt = `
            Based on this idea, write a professional LinkedIn post.
            Title: ${title}
            Summary: ${summary}
            Tags: ${tags ? (Array.isArray(tags) ? tags.join(', ') : tags) : ''}
            
            Keep it engaging and professional.
            `;

            const result = await AIService.generate(tenantId, prompt);
            const generatedContent = result.content;

            // 6. Schedule for 1 week later
            const scheduledTime = new Date();
            scheduledTime.setDate(scheduledTime.getDate() + 7);

            post = await Post.create({
                content: generatedContent,
                userId,
                tenantId,
                scheduledTime: scheduledTime,
                status: 'DRAFT',
                platforms: JSON.stringify(['LINKEDIN']),
            });

            // Update idea status
            idea.status = 'DRAFTED';
            await idea.save();

            console.log(`Draft post created for idea ${idea.id} in tenant ${tenantId}: ${post.id}`);

        } catch (aiError) {
            console.error('Failed to generate auto-post for idea:', aiError);
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

// POST /schedule
router.post('/schedule', async (req, res) => {
    try {
        const { content, scheduledTime, platforms, authorUrn, authorName } = req.body;
        const tenantIdHeader = req.headers['x-tenant-id'] as string;
        const webhookSecretHeader = req.headers['x-webhook-secret'] as string;

        if (!tenantIdHeader || !webhookSecretHeader) {
            return res.status(401).json({ error: 'X-Tenant-ID and X-Webhook-Secret headers are required' });
        }

        // Validate secret and find tenant
        const settings = await Settings.findOne({ where: { tenantId: tenantIdHeader, webhookSecret: webhookSecretHeader } });
        if (!settings) {
            return res.status(401).json({ error: 'Invalid Tenant ID or Webhook Secret' });
        }

        const tenantId = tenantIdHeader;

        // Find a user for this tenant to act as creator
        const member = await TenantMember.findOne({ where: { tenantId }, order: [['role', 'ASC']] });
        if (!member) {
            return res.status(500).json({ error: 'No member found for this tenant' });
        }
        const userId = member.userId;

        if (!content) {
            return res.status(400).json({ error: 'Content is required' });
        }

        // Default to 24 hours from now if not provided
        let time = new Date();
        if (scheduledTime) {
            time = new Date(scheduledTime);
        } else {
            time.setDate(time.getDate() + 1);
        }

        const post = await Post.create({
            content,
            userId,
            tenantId,
            scheduledTime: time,
            status: 'SCHEDULED',
            platforms: platforms ? JSON.stringify(platforms) : JSON.stringify(['LINKEDIN']),
            authorUrn: authorUrn || null,
            authorName: authorName || null,
        });

        console.log(`Post scheduled via webhook for tenant ${tenantId}: ${post.id}`);

        res.status(201).json({
            message: 'Post scheduled successfully',
            postId: post.id
        });

    } catch (error: any) {
        console.error('Webhook Schedule Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

export default router;
