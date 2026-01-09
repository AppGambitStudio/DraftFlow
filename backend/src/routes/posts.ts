import express, { Response } from 'express';
import { Post } from '../db';
import { linkedinService } from '../services/linkedin';
import { markdownToUnicode } from '../utils/markdownToUnicode';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';

const router = express.Router();

// Get all posts
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const allPosts = await Post.findAll({
            where: { tenantId },
            order: [['scheduledTime', 'ASC']]
        });
        res.json(allPosts);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch posts' });
    }
});

// Create a post
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const tenantId = req.tenantId!;
        const { content, scheduledTime, platforms, status, mediaUrls } = req.body;

        console.log('Creating post for tenant:', tenantId, 'Status:', status);

        const post = await Post.create({
            userId,
            tenantId,
            content,
            scheduledTime: scheduledTime ? new Date(scheduledTime) : null,
            status: status || (scheduledTime ? 'SCHEDULED' : 'DRAFT'),
            platforms: platforms ? JSON.stringify(platforms) : JSON.stringify(['LINKEDIN']),
            mediaUrls: mediaUrls ? JSON.stringify(mediaUrls) : null,
            authorUrn: req.body.authorUrn,
            authorName: req.body.authorName,
        });
        res.json(post);
    } catch (error: any) {
        console.error('CREATE POST ERROR:', error);
        if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
            const messages = error.errors?.map((e: any) => e.message).join(', ') || 'No specific messages';
            return res.status(400).json({ error: `Validation error: ${messages}` });
        }
        res.status(500).json({ error: 'Failed to create post: ' + error.message });
    }
});

// Update a post
router.put('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    const { content, scheduledTime, mediaUrls, status } = req.body;
    try {
        const post = await Post.findOne({ where: { id, tenantId } });
        if (!post) {
            return res.status(404).json({ error: 'Post not found or unauthorized' });
        }

        post.content = content !== undefined ? content : post.content;
        post.scheduledTime = scheduledTime ? new Date(scheduledTime) : post.scheduledTime;
        post.mediaUrls = mediaUrls !== undefined ? JSON.stringify(mediaUrls) : post.mediaUrls;
        post.authorUrn = req.body.authorUrn !== undefined ? req.body.authorUrn : post.authorUrn;
        post.authorName = req.body.authorName !== undefined ? req.body.authorName : post.authorName;

        const oldStatus = post.status;
        // If status is provided, use it. Otherwise, if it was FAILED and we're updating, reset to SCHEDULED.
        if (status !== undefined) {
            post.status = status;
        }

        // Auto-transition logic: ensure we don't stay in DRAFT if we have a scheduled time
        if (post.status === 'FAILED' && (scheduledTime || content)) {
            post.status = 'SCHEDULED';
            post.error = null; // Clear error
        } else if (post.status === 'DRAFT' && post.scheduledTime && post.scheduledTime > new Date()) {
            // Only auto-upgrade if we didn't JUST explicitly move it TO draft from something else (like SCHEDULED)
            // If the user clicks "Save Changes" on an existing draft, status is 'DRAFT' and oldStatus is 'DRAFT'.
            // If the user clicks "Move to Draft", status is 'DRAFT' and oldStatus is 'SCHEDULED'.
            if (status === undefined || (status === 'DRAFT' && oldStatus === 'DRAFT')) {
                post.status = 'SCHEDULED';
            }
        }

        await post.save();
        res.json(post);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update post' });
    }
});

// Delete a post
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    try {
        const post = await Post.findOne({ where: { id, tenantId } });
        if (post) {
            await post.destroy();
        }
        res.json({ message: 'Post deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete post' });
    }
});

// Publish a post immediately
router.post('/:id/publish', authMiddleware, async (req: AuthRequest, res: Response) => {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    try {
        const post = await Post.findOne({ where: { id, tenantId } });
        if (!post) {
            return res.status(404).json({ error: 'Post not found or unauthorized' });
        }

        const contentToPublish = markdownToUnicode(post.content);
        const attachments = post.mediaUrls ? JSON.parse(post.mediaUrls) : [];
        const linkedinId = await linkedinService.publishPost(tenantId, contentToPublish, post.authorUrn || undefined, attachments);

        post.linkedinPostId = linkedinId;

        post.status = 'PUBLISHED';
        post.error = null;
        await post.save();

        res.json(post);
    } catch (error: any) {
        console.error('Publish Now Error:', error);
        try {
            const post = await Post.findOne({ where: { id, tenantId } });
            if (post) {
                post.status = 'FAILED';
                post.error = error.message;
                await post.save();
            }
        } catch (dbError) {
            console.error('Failed to update post status:', dbError);
        }

        res.status(500).json({ error: error.message || 'Failed to publish post' });
    }
});

export default router;
