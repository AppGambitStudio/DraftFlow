import express, { Response } from 'express';
import { AIService } from '../services/ai';
import { Settings } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/improvise', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const { content, targetAudience, authorUrn, direction, platform } = req.body;

        if (!content) {
            res.status(400).json({ error: 'Content is required' });
            return;
        }

        const improvedContent = await AIService.improvise(tenantId, content, authorUrn, targetAudience, undefined, direction, platform);
        res.json({ content: improvedContent });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/enhance-idea', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const { title, description } = req.body;

        if (!description) {
            res.json({ content: '' });
            return;
        }

        const enhancedDescription = await AIService.enhanceIdeaDescription(tenantId, title || '', description);
        res.json({ content: enhancedDescription });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
