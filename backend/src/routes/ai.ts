import express, { Response } from 'express';
import { AIService } from '../services/ai';
import { VisualBuilderService, TEMPLATES, CAROUSEL_TEMPLATES } from '../services/visualBuilder';
import { Settings, SavedTrend, WeeklyDigest, Post } from '../db';
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
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = (page - 1) * limit;

        const { count: totalCount, rows: trends } = await SavedTrend.findAndCountAll({
            where: { tenantId },
            order: [['fetchedAt', 'DESC']],
            limit,
            offset
        });

        const topics = trends.map(t => ({
            id: t.id,
            topic: t.topic,
            description: t.description,
            relevance: t.relevance,
            suggestedAngles: JSON.parse(t.suggestedAngles || '[]'),
            sources: JSON.parse(t.sources || '[]'),
            trendType: t.trendType,
            industry: t.industry,
            fetchedAt: t.fetchedAt
        }));

        const totalPages = Math.ceil(totalCount / limit);

        res.json({
            topics,
            totalCount,
            page,
            limit,
            totalPages,
            hasMore: page < totalPages,
            lastFetchedAt: trends[0]?.fetchedAt || null
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Delete a saved trend
router.delete('/saved-trends/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const { id } = req.params;

        const trend = await SavedTrend.findOne({
            where: { id, tenantId }
        });

        if (!trend) {
            return res.status(404).json({ error: 'Trend not found' });
        }

        await trend.destroy();
        res.json({ message: 'Trend deleted' });
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
                    sources: JSON.stringify(t.sources || []),
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

// Generate weekly digest post
router.post('/weekly-digest', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const { topics, platform, authorUrn, storyCount, additionalContext } = req.body;

        if (!topics || !Array.isArray(topics) || topics.length === 0) {
            res.status(400).json({ error: 'At least one topic is required' });
            return;
        }

        const result = await AIService.generateWeeklyDigest(tenantId, {
            topics,
            platform,
            authorUrn,
            storyCount: storyCount || 5,
            additionalContext
        });

        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Get weekly digest history
router.get('/weekly-digest/history', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = parseInt(req.query.offset as string) || 0;

        const { count, rows } = await WeeklyDigest.findAndCountAll({
            where: { tenantId },
            order: [['createdAt', 'DESC']],
            limit,
            offset,
        });

        const digests = rows.map(d => ({
            id: d.id,
            content: d.content,
            topics: JSON.parse(d.topics || '[]'),
            stories: JSON.parse(d.stories || '[]'),
            platform: d.platform,
            storyCount: d.storyCount,
            status: d.status,
            postId: d.postId,
            createdAt: d.createdAt,
        }));

        res.json({ digests, total: count });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Delete a digest from history
router.delete('/weekly-digest/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const digest = await WeeklyDigest.findOne({ where: { id: req.params.id, tenantId } });
        if (!digest) {
            return res.status(404).json({ error: 'Digest not found' });
        }
        await digest.destroy();
        res.json({ message: 'Digest deleted' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Save digest as draft post
router.post('/weekly-digest/:id/save-draft', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const digest = await WeeklyDigest.findOne({ where: { id: req.params.id, tenantId } });
        if (!digest) {
            return res.status(404).json({ error: 'Digest not found' });
        }

        const { authorUrn, authorName } = req.body;

        const post = await Post.create({
            content: digest.content,
            userId: req.user!.id,
            tenantId,
            platforms: JSON.stringify([digest.platform.toUpperCase()]),
            status: 'DRAFT',
            scheduledTime: new Date(),
            authorUrn: authorUrn || null,
            authorName: authorName || null,
            mediaUrls: '[]',
        });

        await digest.update({ postId: post.id });
        res.json({ postId: post.id });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Get digest config
router.get('/digest-config', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const settings = await Settings.findOne({ where: { tenantId } });
        const config = settings?.digestConfig ? JSON.parse(settings.digestConfig) : null;
        res.json({ config });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Save digest config
router.put('/digest-config', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const { topics, platform, storyCount, additionalContext, scheduleEnabled, scheduleDayOfWeek, scheduleTime, authorUrn } = req.body;

        const config = {
            topics: topics || [],
            platform: platform || 'linkedin',
            storyCount: storyCount || 5,
            additionalContext: additionalContext || '',
            scheduleEnabled: scheduleEnabled || false,
            scheduleDayOfWeek: scheduleDayOfWeek ?? 1, // Monday default
            scheduleTime: scheduleTime || '09:00',
            authorUrn: authorUrn || null,
        };

        await Settings.update(
            { digestConfig: JSON.stringify(config) },
            { where: { tenantId } }
        );

        res.json({ config });
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

        console.log('[generate-from-context] Generating for platform:', platform, 'context length:', context?.length);

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

        console.log('[generate-from-context] Result content length:', result.content?.length, 'summary:', result.summary?.substring(0, 50));

        if (!result.content || result.content.trim().length === 0) {
            console.error('[generate-from-context] Empty content returned from AI');
            return res.status(500).json({ error: 'AI returned empty content. Please try again.' });
        }

        res.json({ content: result.content });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Visual Builder — get available templates
router.get('/visual-builder/templates', authMiddleware, async (_req: AuthRequest, res: Response) => {
    const templates = Object.values(TEMPLATES).map(t => ({
        key: t.key,
        name: t.name,
        description: t.description,
        icon: t.icon,
    }));
    res.json({ templates });
});

// Visual Builder — generate visual from post content
router.post('/visual-builder', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const { content, template, size } = req.body;

        if (!content) {
            return res.status(400).json({ error: 'Post content is required' });
        }

        console.log(`[visual-builder] Generating template="${template || 'infographic'}" size="${size || 'landscape'}" content=${content.length} chars`);

        const result = await VisualBuilderService.generate(tenantId, content, template, size);

        console.log(`[visual-builder] Generated ${result.name} (${result.size} bytes)`);

        res.json(result);
    } catch (error: any) {
        console.error('[visual-builder] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Carousel Builder — get/save branding
router.get('/carousel-builder/branding', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { Settings } = require('../db');
        const settings = await Settings.findOne({ where: { tenantId: req.tenantId! } });
        const branding = settings?.carouselBranding ? JSON.parse(settings.carouselBranding) : { name: '', handle: '', tagline: '', cta: '' };
        res.json(branding);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.put('/carousel-builder/branding', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { Settings } = require('../db');
        const { name, handle, tagline, cta } = req.body;
        const [settings] = await Settings.findOrCreate({ where: { tenantId: req.tenantId! }, defaults: { tenantId: req.tenantId! } });
        settings.carouselBranding = JSON.stringify({ name: name || '', handle: handle || '', tagline: tagline || '', cta: cta || '' });
        await settings.save();
        res.json(JSON.parse(settings.carouselBranding));
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Carousel Builder — saved carousels CRUD
router.get('/carousel-builder/saved', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { SavedCarousel } = require('../db');
        const carousels = await SavedCarousel.findAll({
            where: { tenantId: req.tenantId! },
            order: [['createdAt', 'DESC']],
        });
        res.json(carousels);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/carousel-builder/save', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { SavedCarousel } = require('../db');
        const { title, content, template, slideCount, pdfUrl, fileName, fileSize } = req.body;
        if (!title || !pdfUrl) {
            return res.status(400).json({ error: 'Title and pdfUrl are required' });
        }
        const carousel = await SavedCarousel.create({
            tenantId: req.tenantId!,
            title,
            content: content || '',
            template: template || 'step-guide',
            slideCount: slideCount || 5,
            pdfUrl,
            fileName: fileName || '',
            fileSize: fileSize || 0,
        });
        res.status(201).json(carousel);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.delete('/carousel-builder/saved/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { SavedCarousel } = require('../db');
        const carousel = await SavedCarousel.findOne({
            where: { id: req.params.id, tenantId: req.tenantId! },
        });
        if (!carousel) {
            return res.status(404).json({ error: 'Carousel not found' });
        }
        await carousel.destroy();
        res.json({ success: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Carousel Builder — get available templates
router.get('/carousel-builder/templates', authMiddleware, async (_req: AuthRequest, res: Response) => {
    const templates = Object.values(CAROUSEL_TEMPLATES).map(t => ({
        key: t.key,
        name: t.name,
        description: t.description,
        icon: t.icon,
    }));
    res.json({ templates });
});

// Carousel Builder — generate multi-slide PDF carousel
router.post('/carousel-builder', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const { content, template, slideCount, additionalComments, branding } = req.body;

        if (!content) {
            return res.status(400).json({ error: 'Content is required' });
        }

        const count = Math.max(3, Math.min(10, parseInt(slideCount) || 5));

        console.log(`[carousel-builder] Generating template="${template || 'step-guide'}" slides=${count} content=${content.length} chars${additionalComments ? ` comments="${additionalComments}"` : ''}${branding?.name ? ` brand="${branding.name}"` : ''}`);

        const result = await VisualBuilderService.generateCarousel(tenantId, content, template, count, additionalComments, branding);

        console.log(`[carousel-builder] Generated ${result.name} (${result.size} bytes, ${result.slideCount} slides)`);

        res.json(result);
    } catch (error: any) {
        console.error('[carousel-builder] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Carousel Builder — research topic via Tavily then generate carousel
router.post('/carousel-builder/research', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const { content, template, slideCount, additionalComments, branding } = req.body;

        if (!content) {
            return res.status(400).json({ error: 'Topic is required' });
        }

        const count = Math.max(3, Math.min(10, parseInt(slideCount) || 5));

        // Step 1: Research via Tavily
        const { Settings } = require('../db');
        const settings = await Settings.findOne({ where: { tenantId } });
        const tavilyApiKey = settings?.tavilyApiKey;

        let researchContext = '';
        if (tavilyApiKey) {
            console.log(`[carousel-builder] Researching topic via Tavily: "${content}"`);
            const results = await AIService.searchWithTavily(tavilyApiKey, content, {
                topic: 'general',
                timeRange: 'month',
                maxResults: 5,
            });
            if (results.length > 0) {
                researchContext = '\n\n## RESEARCH RESULTS (use these facts and insights):\n' +
                    results.map((r, i) => `${i + 1}. **${r.title}** (${r.url})\n${r.content}`).join('\n\n');
            }
        } else {
            console.log('[carousel-builder] No Tavily key, falling back to AI knowledge only');
        }

        // Step 2: Generate carousel with research context
        const enrichedContent = content + researchContext;

        console.log(`[carousel-builder] Research+Generate template="${template || 'step-guide'}" slides=${count} content=${enrichedContent.length} chars`);

        const result = await VisualBuilderService.generateCarousel(tenantId, enrichedContent, template, count, additionalComments, branding);

        console.log(`[carousel-builder] Generated ${result.name} (${result.size} bytes, ${result.slideCount} slides)`);

        res.json(result);
    } catch (error: any) {
        console.error('[carousel-builder] Research error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

export default router;
