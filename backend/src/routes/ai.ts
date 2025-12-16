import express from 'express';
import { AIService } from '../services/ai';

const router = express.Router();

router.post('/improvise', async (req, res) => {
    try {
        const { content, targetAudience } = req.body;

        if (!content) {
            res.status(400).json({ error: 'Content is required' });
            return;
        }

        const improvedContent = await AIService.improvise(content, targetAudience);
        res.json({ content: improvedContent });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/enhance-idea', async (req, res) => {
    try {
        const { title, description } = req.body;

        if (!description) {
            res.json({ content: '' });
            return;
        }

        const enhancedDescription = await AIService.enhanceIdeaDescription(title || '', description);
        res.json({ content: enhancedDescription });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
