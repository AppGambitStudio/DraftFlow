import express, { Response } from 'express';
import { AIService } from '../services/ai';
import { Settings } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/improvise', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const { content, targetAudience, authorUrn } = req.body;

        if (!content) {
            res.status(400).json({ error: 'Content is required' });
            return;
        }

        const settings = await Settings.findOne({ where: { tenantId } });
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

        const improvedContent = await AIService.improvise(tenantId, content, targetAudience, toneInstructions);
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
