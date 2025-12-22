import express, { Response } from 'express';
import { AIService } from '../services/ai';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/improvise', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { content, targetAudience } = req.body;

        if (!content) {
            res.status(400).json({ error: 'Content is required' });
            return;
        }

        const improvedContent = await AIService.improvise(userId, content, targetAudience);
        res.json({ content: improvedContent });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/enhance-idea', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { title, description } = req.body;

        if (!description) {
            res.json({ content: '' });
            return;
        }

        const enhancedDescription = await AIService.enhanceIdeaDescription(userId, title || '', description);
        res.json({ content: enhancedDescription });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
