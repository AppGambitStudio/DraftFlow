import express, { Response } from 'express';
import { Idea, Post, Settings } from '../db';
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

// Batch create ideas
router.post('/batch', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const tenantId = req.tenantId!;
        const { ideas } = req.body;

        if (!ideas || !Array.isArray(ideas) || ideas.length === 0) {
            return res.status(400).json({ error: 'Ideas array is required' });
        }

        const ideaRecords = ideas.map((ideaData: any) => ({
            userId,
            tenantId,
            title: ideaData.title,
            description: ideaData.description || null,
            tags: JSON.stringify(ideaData.tags || []),
            status: 'NEW',
            isRecurring: false,
            frequency: null,
            lastGeneratedAt: null,
            authorUrn: ideaData.authorUrn || null,
            authorName: ideaData.authorName || null,
            targetAudience: ideaData.targetAudience || null,
            generatedSummaries: '[]',
            sourceLinks: JSON.stringify(ideaData.sourceLinks || []),
            attachments: '[]',
            scheduleTime: null,
            scheduleDayOfWeek: null,
            scheduleDayOfMonth: null,
            postShape: ideaData.postShape || null,
            effortLevel: ideaData.effortLevel || null,
            keyTakeaway: ideaData.keyTakeaway || null,
            antiGoals: ideaData.antiGoals || null
        }));

        const createdIdeas = await Idea.bulkCreate(ideaRecords);

        res.json(createdIdeas);
    } catch (error) {
        console.error('Batch create error:', error);
        res.status(500).json({ error: 'Failed to batch create ideas' });
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

// Generate post from idea (async — returns immediately, post appears in drafts when ready)
router.post('/:id/generate', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const tenantId = req.tenantId!;
        const { id } = req.params;
        const { platform, targetAudience, additionalContext } = req.body;
        console.log(`[Idea Generate] id=${id}, platform=${platform}, additionalContext="${additionalContext || 'none'}"`);

        const idea = await Idea.findOne({ where: { id, tenantId } });
        if (!idea) {
            return res.status(404).json({ error: 'Idea not found or unauthorized' });
        }

        // Create a placeholder post with GENERATING status
        const post = await Post.create({
            userId,
            tenantId,
            content: `Generating post from idea: ${idea.title}...`,
            status: 'GENERATING',
            platforms: JSON.stringify([platform || 'LINKEDIN']),
            authorUrn: idea.authorUrn,
            authorName: idea.authorName,
        });

        // Mark idea as DRAFTED
        await idea.update({ status: 'DRAFTED' });

        // Respond immediately so the user can navigate away
        res.json({ postId: post.id, status: 'GENERATING' });

        // Run AI generation in the background
        (async () => {
            try {
                console.log(`[Idea Generate] Background generation started for post ${post.id}`);
                const { content } = await AIService.generateForIdea(
                    tenantId,
                    idea,
                    platform,
                    additionalContext
                );

                await post.update({
                    content,
                    status: 'DRAFT',
                });
                console.log(`[Idea Generate] Post ${post.id} generated successfully`);
            } catch (error: any) {
                console.error(`[Idea Generate] Background generation failed for post ${post.id}:`, error.message);
                await post.update({
                    status: 'FAILED',
                    error: error.message || 'AI generation failed',
                });
            }
        })();
    } catch (error: any) {
        console.error('Generate error:', error);
        res.status(500).json({ error: 'Failed to generate post' });
    }
});

export default router;
