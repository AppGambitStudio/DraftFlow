import express, { Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { WikiService } from '../services/wiki';

const router = express.Router();

// ============================================================================
// List all wiki pages
// ============================================================================
router.get('/pages', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const pages = WikiService.listPages(tenantId);
        res.json({ pages });
    } catch (error: any) {
        console.error('[Wiki] Error listing pages:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// Get single page
// ============================================================================
router.get('/pages/:slug', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const slug = req.params.slug as string;

        const page = WikiService.getPage(tenantId, slug);
        if (!page) {
            return res.status(404).json({ error: 'Page not found' });
        }

        res.json(page);
    } catch (error: any) {
        console.error('[Wiki] Error getting page:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// Create new page
// ============================================================================
router.post('/pages', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const { title, content, category } = req.body;

        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content are required' });
        }

        const slug = title
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 80);

        const page = await WikiService.savePage(tenantId, slug, content, category, title, [], 'created');
        res.status(201).json(page);
    } catch (error: any) {
        console.error('[Wiki] Error creating page:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// Update page
// ============================================================================
router.put('/pages/:slug', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const slug = req.params.slug as string;
        const { content, category, title } = req.body;

        const existing = WikiService.getPage(tenantId, slug);
        if (!existing) {
            return res.status(404).json({ error: 'Page not found' });
        }

        const page = await WikiService.savePage(
            tenantId,
            slug,
            content || existing.content,
            category || existing.category,
            title || existing.title,
            existing.sources,
            'edited'
        );
        res.json(page);
    } catch (error: any) {
        console.error('[Wiki] Error updating page:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// Delete page
// ============================================================================
router.delete('/pages/:slug', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const slug = req.params.slug as string;

        const deleted = await WikiService.deletePage(tenantId, slug);
        if (!deleted) {
            return res.status(404).json({ error: 'Page not found' });
        }

        res.json({ success: true });
    } catch (error: any) {
        console.error('[Wiki] Error deleting page:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// Ingest source (URL, text, RSS item)
// ============================================================================
router.post('/ingest', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const { type, content, title, url } = req.body;

        if (!type || !content) {
            return res.status(400).json({ error: 'Type and content are required' });
        }

        if (!['url', 'text', 'rss_item'].includes(type)) {
            return res.status(400).json({ error: 'Type must be url, text, or rss_item' });
        }

        const result = await WikiService.ingestSource(tenantId, { type, content, title, url });
        res.json(result);
    } catch (error: any) {
        console.error('[Wiki] Error ingesting source:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// Search wiki
// ============================================================================
router.post('/query', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const { query } = req.body;

        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        const results = WikiService.queryWiki(tenantId, query);
        res.json(results);
    } catch (error: any) {
        console.error('[Wiki] Error querying wiki:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// Get activity log
// ============================================================================
router.get('/log', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const limit = parseInt(req.query.limit as string) || 50;
        const entries = WikiService.getLog(tenantId, limit);
        res.json({ entries });
    } catch (error: any) {
        console.error('[Wiki] Error getting log:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// Get wiki stats
// ============================================================================
router.get('/stats', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const stats = WikiService.getStats(tenantId);
        res.json(stats);
    } catch (error: any) {
        console.error('[Wiki] Error getting stats:', error.message);
        res.status(500).json({ error: error.message });
    }
});

export default router;
