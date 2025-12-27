import express, { Response } from 'express';
import { AIService } from '../services/ai';
import { Settings } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/improvise', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const { content, targetAudience, authorUrn } = req.body;

        if (!content) {
            res.status(400).json({ error: 'Content is required' });
            return;
        }

        const settings = await Settings.findOne({ where: { userId } });
        let toneInstructions = settings?.globalTone || undefined;

        if (settings?.accountTones && authorUrn) {
            try {
                const accountTones = JSON.parse(settings.accountTones);
                if (accountTones[authorUrn]) {
                    toneInstructions = accountTones[authorUrn];
                }
            } catch (e) {
                console.error('Error parsing accountTones:', e);
            }
        }

        const improvedContent = await AIService.improvise(userId, content, targetAudience, toneInstructions);
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
