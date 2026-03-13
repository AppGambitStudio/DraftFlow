import express, { Response } from 'express';
import { RssFeed, RssFeedItem } from '../db';
import { RssService } from '../services/rss';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { Op } from 'sequelize';

const router = express.Router();

// List all feeds
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const feeds = await RssFeed.findAll({
            where: { tenantId },
            order: [['createdAt', 'DESC']],
        });

        // Include item counts
        const feedsWithCounts = await Promise.all(
            feeds.map(async (feed) => {
                const totalItems = await RssFeedItem.count({ where: { feedId: feed.id } });
                const unreadItems = await RssFeedItem.count({ where: { feedId: feed.id, isRead: false } });
                return {
                    ...feed.toJSON(),
                    totalItems,
                    unreadItems,
                };
            })
        );

        res.json(feedsWithCounts);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Add a new feed
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const { url } = req.body;

        if (!url) {
            res.status(400).json({ error: 'Feed URL is required' });
            return;
        }

        const feed = await RssService.addFeed(tenantId, url);
        res.json(feed);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// Refresh a single feed
router.post('/:id/refresh', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const feed = await RssFeed.findOne({ where: { id: req.params.id, tenantId } });
        if (!feed) {
            return res.status(404).json({ error: 'Feed not found' });
        }

        const newItems = await RssService.refreshFeed(feed);
        res.json({ newItems, feed: await feed.reload() });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Refresh all feeds
router.post('/refresh-all', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const result = await RssService.refreshAllFeeds(tenantId);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Update feed (pause/resume)
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const feed = await RssFeed.findOne({ where: { id: req.params.id, tenantId } });
        if (!feed) {
            return res.status(404).json({ error: 'Feed not found' });
        }

        const { status } = req.body;
        if (status && ['ACTIVE', 'PAUSED'].includes(status)) {
            await feed.update({ status });
        }
        res.json(feed);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Delete a feed and its items
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const feed = await RssFeed.findOne({ where: { id: req.params.id, tenantId } });
        if (!feed) {
            return res.status(404).json({ error: 'Feed not found' });
        }

        await RssFeedItem.destroy({ where: { feedId: feed.id } });
        await feed.destroy();
        res.json({ message: 'Feed deleted' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Get feed items (with filtering)
router.get('/items', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const limit = parseInt(req.query.limit as string) || 20;
        const offset = parseInt(req.query.offset as string) || 0;
        const feedId = req.query.feedId as string;
        const bookmarked = req.query.bookmarked === 'true';
        const unreadOnly = req.query.unread === 'true';

        const search = req.query.search as string;

        const where: any = { tenantId };
        if (feedId) where.feedId = feedId;
        if (bookmarked) where.isBookmarked = true;
        if (unreadOnly) where.isRead = false;
        if (search) {
            const term = `%${search}%`;
            where[Op.or] = [
                { title: { [Op.like]: term } },
                { description: { [Op.like]: term } },
                { author: { [Op.like]: term } },
                { categories: { [Op.like]: term } },
            ];
        }

        const { count, rows } = await RssFeedItem.findAndCountAll({
            where,
            order: [['pubDate', 'DESC']],
            limit,
            offset,
            include: [{ model: RssFeed, as: 'feed', attributes: ['id', 'title', 'siteUrl', 'imageUrl'] }],
        });

        const items = rows.map((item) => ({
            ...item.toJSON(),
            categories: JSON.parse(item.categories || '[]'),
        }));

        res.json({ items, total: count });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Toggle bookmark
router.put('/items/:id/bookmark', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const item = await RssFeedItem.findOne({ where: { id: req.params.id, tenantId } });
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        await item.update({ isBookmarked: !item.isBookmarked });
        res.json({ isBookmarked: item.isBookmarked });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Mark item(s) as read
router.put('/items/mark-read', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const { ids } = req.body; // array of item ids, or empty to mark all

        if (ids && Array.isArray(ids) && ids.length > 0) {
            await RssFeedItem.update({ isRead: true }, { where: { id: ids, tenantId } });
        } else {
            await RssFeedItem.update({ isRead: true }, { where: { tenantId, isRead: false } });
        }
        res.json({ message: 'Marked as read' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Mark item as used (for post/idea creation)
router.put('/items/:id/mark-used', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const item = await RssFeedItem.findOne({ where: { id: req.params.id, tenantId } });
        if (!item) {
            return res.status(404).json({ error: 'Item not found' });
        }
        await item.update({ isUsed: true, isRead: true });
        res.json({ isUsed: true });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
