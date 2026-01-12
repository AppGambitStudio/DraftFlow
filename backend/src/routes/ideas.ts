import express, { Response } from 'express';
import { Idea, Settings } from '../db';
import { AIService } from '../services/ai';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';

const router = express.Router();

// Get all ideas
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const ideas = await Idea.findAll({
            where: { tenantId },
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
        const tenantId = req.tenantId!;
        const { title, description, tags, isRecurring, frequency, authorUrn, authorName, targetAudience, scheduleTime, scheduleDayOfWeek, scheduleDayOfMonth, postShape, effortLevel, keyTakeaway, antiGoals, attachments } = req.body;
        const idea = await Idea.create({
            userId,
            tenantId,
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
            attachments: JSON.stringify(attachments || []),
            scheduleTime: scheduleTime || null,
            scheduleDayOfWeek: scheduleDayOfWeek !== undefined ? scheduleDayOfWeek : null,
            scheduleDayOfMonth: scheduleDayOfMonth || null,
            postShape: postShape || null,
            effortLevel: effortLevel || null,
            keyTakeaway: keyTakeaway || null,
            antiGoals: antiGoals || null
        });
        res.json(idea);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create idea' });
    }
});

// Update idea
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const { id } = req.params;
        const { title, description, tags, status, isRecurring, frequency, authorUrn, authorName, targetAudience, scheduleTime, scheduleDayOfWeek, scheduleDayOfMonth, postShape, effortLevel, keyTakeaway, antiGoals, attachments } = req.body;
        const idea = await Idea.findOne({ where: { id, tenantId } });

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
        if (attachments !== undefined) idea.attachments = JSON.stringify(attachments);

        if (scheduleTime !== undefined) idea.scheduleTime = scheduleTime;
        if (scheduleDayOfWeek !== undefined) idea.scheduleDayOfWeek = scheduleDayOfWeek;
        if (scheduleDayOfMonth !== undefined) idea.scheduleDayOfMonth = scheduleDayOfMonth;

        if (postShape !== undefined) idea.postShape = postShape;
        if (effortLevel !== undefined) idea.effortLevel = effortLevel;
        if (keyTakeaway !== undefined) idea.keyTakeaway = keyTakeaway;
        if (antiGoals !== undefined) idea.antiGoals = antiGoals;

        await idea.save();

        res.json(idea);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update idea' });
    }
});

// Delete idea
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const { id } = req.params;
        const idea = await Idea.findOne({ where: { id, tenantId } });

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
        const tenantId = req.tenantId!;
        const { id } = req.params;
        const { platform, targetAudience, additionalContext } = req.body; // 'LINKEDIN' or 'TWITTER'
        console.log(`[Idea Generate] id=${id}, platform=${platform}, additionalContext="${additionalContext || 'none'}"`);
        const idea = await Idea.findOne({ where: { id, tenantId } });

        if (!idea) {
            return res.status(404).json({ error: 'Idea not found or unauthorized' });
        }

        const { content } = await AIService.generateForIdea(
            tenantId,
            idea,
            platform,
            additionalContext
        );

        res.json({ content });
    } catch (error: any) {
        console.error('Generate error:', error);
        res.status(500).json({ error: 'Failed to generate post' });
    }
});

export default router;
