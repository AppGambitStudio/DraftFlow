import express, { Response } from 'express';
import { Post, sequelize } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { Op } from 'sequelize';
import { startOfDay, endOfDay, eachDayOfInterval, format, parseISO } from 'date-fns';

const router = express.Router();

router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const { start, end } = req.query;

        if (!start || !end) {
            res.status(400).json({ error: 'Start and end dates are required' });
            return;
        }

        const startDate = startOfDay(parseISO(start as string));
        const endDate = endOfDay(parseISO(end as string));

        const posts = await Post.findAll({
            where: {
                tenantId,
                status: 'PUBLISHED',
                scheduledTime: {
                    [Op.between]: [startDate, endDate]
                },
                [Op.or]: [
                    { linkedinPostId: { [Op.not]: null } },
                    { twitterPostId: { [Op.not]: null } }
                ]
            },
            order: [['scheduledTime', 'ASC']]
        });

        // Group by day for time-series chart
        const days = eachDayOfInterval({ start: startDate, end: endDate });

        const timeSeries = days.map((day: Date) => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const dayPosts = posts.filter(p => p.scheduledTime && format(new Date(p.scheduledTime), 'yyyy-MM-dd') === dayStr);

            return {
                date: dayStr,
                likes: dayPosts.reduce((sum, p) => sum + (p.likesCount || 0), 0),
                comments: dayPosts.reduce((sum, p) => sum + (p.commentsCount || 0), 0),
                reposts: dayPosts.reduce((sum, p) => sum + (p.repostsCount || 0), 0),
                impressions: dayPosts.reduce((sum, p) => sum + (p.impressionsCount || 0), 0),
                postCount: dayPosts.length
            };
        });

        // Summary totals
        const summary = {
            totalLikes: posts.reduce((sum, p) => sum + (p.likesCount || 0), 0),
            totalComments: posts.reduce((sum, p) => sum + (p.commentsCount || 0), 0),
            totalReposts: posts.reduce((sum, p) => sum + (p.repostsCount || 0), 0),
            totalImpressions: posts.reduce((sum, p) => sum + (p.impressionsCount || 0), 0),
            totalPosts: posts.length
        };

        // Top performing posts
        const topPosts = await Post.findAll({
            where: {
                tenantId,
                status: 'PUBLISHED',
                [Op.or]: [
                    { linkedinPostId: { [Op.not]: null } },
                    { twitterPostId: { [Op.not]: null } }
                ]
            },
            order: [
                [sequelize.literal('(likesCount + commentsCount + repostsCount)'), 'DESC']
            ],
            limit: 5
        });

        res.json({
            timeSeries,
            summary,
            topPosts
        });
    } catch (error: any) {
        console.error('Analytics Error:', error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
