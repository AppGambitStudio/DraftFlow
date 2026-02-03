import express, { Response } from 'express';
import { AIService } from '../services/ai';
import { Settings, SavedTrend } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { Op } from 'sequelize';

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

router.post('/suggest-pillars', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const { companyName, companyDescription, industry, expertiseAreas } = req.body;

        if (!companyDescription) {
            res.status(400).json({ error: 'Company description is required' });
            return;
        }

        const pillars = await AIService.suggestContentPillars(tenantId, companyName, companyDescription, industry, expertiseAreas);
        res.json({ pillars });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/generate-ideas', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const { companyName, industry, companyDescription, expertiseAreas, contentPillars, targetAudience, audiencePainPoints, toneOverride, batchTheme, trendingTopics, count, authorUrn, excludeTitles } = req.body;

        if (!contentPillars || !Array.isArray(contentPillars) || contentPillars.length === 0) {
            res.status(400).json({ error: 'Content pillars are required' });
            return;
        }

        const ideas = await AIService.generateIdeaBatch(tenantId, {
            companyName, industry, companyDescription, expertiseAreas,
            contentPillars, targetAudience, audiencePainPoints, toneOverride,
            batchTheme, trendingTopics, count: count || 7, authorUrn, excludeTitles
        });
        res.json({ ideas });
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

router.post('/variations', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const { content, authorUrn, targetAudience, platform } = req.body;

        if (!content) {
            res.status(400).json({ error: 'Content is required' });
            return;
        }

        const variations = await AIService.generateVariations(tenantId, content, authorUrn, targetAudience, platform);
        res.json({ variations });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/hooks', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const { content, count, authorUrn, platform } = req.body;

        if (!content) {
            res.status(400).json({ error: 'Content is required' });
            return;
        }

        const hooks = await AIService.generateHooks(tenantId, content, count, authorUrn, platform);
        res.json({ hooks });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/hashtags', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const { content, count, platform } = req.body;

        if (!content) {
            res.status(400).json({ error: 'Content is required' });
            return;
        }

        const hashtags = await AIService.suggestHashtags(tenantId, content, count, platform);
        res.json({ hashtags });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Get saved trending topics
router.get('/saved-trends', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;

        const trends = await SavedTrend.findAll({
            where: { tenantId },
            order: [['fetchedAt', 'DESC']],
            limit: 100 // Keep last 100 trends for reuse
        });

        const topics = trends.map(t => ({
            id: t.id,
            topic: t.topic,
            description: t.description,
            relevance: t.relevance,
            suggestedAngles: JSON.parse(t.suggestedAngles || '[]'),
            trendType: t.trendType,
            industry: t.industry,
            fetchedAt: t.fetchedAt
        }));

        // Group by fetchedAt date for display
        const totalCount = await SavedTrend.count({ where: { tenantId } });

        res.json({ topics, totalCount, lastFetchedAt: trends[0]?.fetchedAt || null });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/trending-topics', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const { industry, contentPillars, targetAudience, count } = req.body;

        const topics = await AIService.getTrendingTopics(tenantId, {
            industry,
            contentPillars,
            targetAudience,
            count
        });

        // Save the fetched trends to database (accumulate over time)
        if (topics && topics.length > 0) {
            const fetchedAt = new Date();

            // Save new trends (keep accumulating)
            await SavedTrend.bulkCreate(
                topics.map(t => ({
                    tenantId,
                    topic: t.topic,
                    description: t.description,
                    relevance: t.relevance,
                    suggestedAngles: JSON.stringify(t.suggestedAngles),
                    trendType: t.trendType,
                    industry: industry || null,
                    fetchedAt
                }))
            );
        }

        res.json({ topics });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Generate post content from context (for trends, topics, etc.)
router.post('/generate-from-context', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const { context, authorUrn, targetAudience, platform } = req.body;

        if (!context) {
            return res.status(400).json({ error: 'Context is required' });
        }

        const result = await AIService.generate(
            tenantId,
            context,
            targetAudience,
            [], // previousSummaries
            undefined, // additionalContext
            authorUrn,
            undefined, // postShape
            undefined, // effortLevel
            undefined, // keyTakeaway
            undefined, // antiGoals
            undefined, // manualToneOverride
            platform
        );

        res.json({ content: result.content });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
