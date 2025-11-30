import express from 'express';
import { Idea } from '../db';
import { AIService } from '../services/ai';

const router = express.Router();

// Get all ideas
router.get('/', async (req, res) => {
    try {
        const ideas = await Idea.findAll({ order: [['createdAt', 'DESC']] });
        res.json(ideas);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch ideas' });
    }
});

// Create new idea
router.post('/', async (req, res) => {
    try {
        const { title, description, tags, isRecurring, frequency, authorUrn, authorName, targetAudience } = req.body;
        const idea = await Idea.create({
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
        });
        res.json(idea);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create idea' });
    }
});

// Update idea
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, tags, status, isRecurring, frequency, authorUrn, authorName, targetAudience } = req.body;
        const idea = await Idea.findByPk(id);

        if (!idea) {
            return res.status(404).json({ error: 'Idea not found' });
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

        await idea.save();

        res.json(idea);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update idea' });
    }
});

// Delete idea
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const idea = await Idea.findByPk(id);

        if (!idea) {
            return res.status(404).json({ error: 'Idea not found' });
        }

        await idea.destroy();
        res.json({ message: 'Idea deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete idea' });
    }
});

// Generate post from idea
router.post('/:id/generate', async (req, res) => {
    try {
        const { id } = req.params;
        const { platform, targetAudience } = req.body; // 'LINKEDIN' or 'TWITTER'
        const idea = await Idea.findByPk(id);

        if (!idea) {
            return res.status(404).json({ error: 'Idea not found' });
        }

        const prompt = `
            Based on the following idea, write a professional and engaging ${platform || 'LinkedIn'} post.
            
            Title: ${idea.title}
            Description: ${idea.description}
            
            The post should be ready to publish, with appropriate hashtags.
        `;

        const content = await AIService.generate(prompt, targetAudience);
        res.json({ content });
    } catch (error: any) {
        console.error('Generate error:', error);
        res.status(500).json({ error: 'Failed to generate post' });
    }
});

export default router;
