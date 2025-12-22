import express, { Response } from 'express';
import { Idea } from '../db';
import { AIService } from '../services/ai';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';

const router = express.Router();

// Get all ideas
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const ideas = await Idea.findAll({
            where: { userId },
            order: [['createdAt', 'DESC']]
        });
        res.json(ideas);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch ideas' });
    }
});

// Create new idea
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { title, description, tags, isRecurring, frequency, authorUrn, authorName, targetAudience, scheduleTime, scheduleDayOfWeek, scheduleDayOfMonth } = req.body;
        const idea = await Idea.create({
            userId,
            title,
            description,
            tags: JSON.stringify(tags || []),
            status: 'NEW',
            isRecurring: isRecurring || false,
            frequency: frequency || null,
            lastGeneratedAt: null,
            authorUrn: authorUrn,
            authorName: authorName,
            targetAudience: targetAudience || null,
            generatedSummaries: '[]',
            sourceLinks: JSON.stringify(req.body.sourceLinks || []),
            scheduleTime: scheduleTime || null,
            scheduleDayOfWeek: scheduleDayOfWeek !== undefined ? scheduleDayOfWeek : null,
            scheduleDayOfMonth: scheduleDayOfMonth || null
        });
        res.json(idea);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create idea' });
    }
});

// Update idea
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;
        const { title, description, tags, status, isRecurring, frequency, authorUrn, authorName, targetAudience, scheduleTime, scheduleDayOfWeek, scheduleDayOfMonth } = req.body;
        const idea = await Idea.findOne({ where: { id, userId } });

        if (!idea) {
            return res.status(404).json({ error: 'Idea not found or unauthorized' });
        }

        idea.title = title || idea.title;
        idea.description = description || idea.description;
        if (tags) idea.tags = JSON.stringify(tags);
        if (status) idea.status = status;
        if (isRecurring !== undefined) idea.isRecurring = isRecurring;
        if (frequency) idea.frequency = frequency;
        if (authorUrn !== undefined) idea.authorUrn = authorUrn;
        if (authorName !== undefined) idea.authorName = authorName;
        if (targetAudience !== undefined) idea.targetAudience = targetAudience;
        if (req.body.sourceLinks !== undefined) idea.sourceLinks = JSON.stringify(req.body.sourceLinks);

        if (scheduleTime !== undefined) idea.scheduleTime = scheduleTime;
        if (scheduleDayOfWeek !== undefined) idea.scheduleDayOfWeek = scheduleDayOfWeek;
        if (scheduleDayOfMonth !== undefined) idea.scheduleDayOfMonth = scheduleDayOfMonth;

        await idea.save();

        res.json(idea);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update idea' });
    }
});

// Delete idea
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;
        const idea = await Idea.findOne({ where: { id, userId } });

        if (!idea) {
            return res.status(404).json({ error: 'Idea not found or unauthorized' });
        }

        await idea.destroy();
        res.json({ message: 'Idea deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete idea' });
    }
});

// Generate post from idea
router.post('/:id/generate', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { id } = req.params;
        const { platform, targetAudience, additionalContext } = req.body; // 'LINKEDIN' or 'TWITTER'
        const idea = await Idea.findOne({ where: { id, userId } });

        if (!idea) {
            return res.status(404).json({ error: 'Idea not found or unauthorized' });
        }

        const prompt = `
            Based on the following idea, write a professional and engaging ${platform || 'LinkedIn'} post.
            
            Title: ${idea.title}
            Description: ${idea.description}
            
            The post should be easy to understand and should break down complex topics into simple concepts.
            The post should be ready to publish, with appropriate hashtags.
        `;

        let contextFromLinks = '';
        try {
            const links = JSON.parse(idea.sourceLinks || '[]');
            if (links.length > 0) {
                console.log('Fetching content from links:', links);
                const axios = require('axios');

                const linkContents = await Promise.all(links.map(async (link: string) => {
                    if (!link) return '';
                    try {
                        const response = await axios.get(link, { timeout: 10000 });
                        // Simple regex to strip HTML tags, script, and style
                        let text = response.data;
                        if (typeof text !== 'string') text = JSON.stringify(text); // Handle non-string responses

                        text = text.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gm, "");
                        text = text.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gm, "");
                        text = text.replace(/<[^>]+>/g, "\n");
                        text = text.replace(/\s+/g, " ").trim();
                        // Truncate to avoid huge context (e.g., 2000 chars per link)
                        return `[Content from ${link}]:\n${text.substring(0, 2000)}...\n`;
                    } catch (err: any) {
                        console.error(`Failed to fetch content from ${link}:`, err.message);
                        return `[Failed to fetch content from ${link}]\n`;
                    }
                }));

                contextFromLinks = '\n\nAdditional Context from Reference Links:\n' + linkContents.join('\n');
            }
        } catch (e) {
            console.error('Error processing sourceLinks:', e);
        }

        const fullPrompt = prompt + contextFromLinks;

        let previousSummaries: string[] = [];
        try {
            previousSummaries = JSON.parse(idea.generatedSummaries || '[]');
        } catch (e) {
            previousSummaries = [];
        }

        const { content, summary } = await AIService.generate(userId, fullPrompt, targetAudience, previousSummaries, additionalContext);

        // Update idea with new summary
        if (summary) {
            const newSummaries = [...previousSummaries, summary].slice(-5); // Keep last 5
            idea.generatedSummaries = JSON.stringify(newSummaries);
            idea.lastGeneratedAt = new Date();
            await idea.save();
        }

        res.json({ content });
    } catch (error: any) {
        console.error('Generate error:', error);
        res.status(500).json({ error: 'Failed to generate post' });
    }
});

export default router;
