import express from 'express';
import { Post } from '../db';
import { linkedinService } from '../services/linkedin';
import { markdownToUnicode } from '../utils/markdownToUnicode';

const router = express.Router();

// Get all posts
router.get('/', async (req, res) => {
    try {
        const allPosts = await Post.findAll({
            order: [['scheduledTime', 'ASC']]
        });
        res.json(allPosts);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch posts' });
    }
});

// Create a post
router.post('/', async (req, res) => {
    const { content, scheduledTime, platforms } = req.body;
    try {
        const post = await Post.create({
            content,
            scheduledTime: new Date(scheduledTime),
            status: 'SCHEDULED',
            platforms: platforms ? JSON.stringify(platforms) : JSON.stringify(['LINKEDIN']),
            authorUrn: req.body.authorUrn,
            authorName: req.body.authorName,
        });
        res.json(post);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create post' });
    }
});

// Update a post
router.put('/:id', async (req, res) => {
    const { id } = req.params;
    const { content, scheduledTime, mediaUrls, status } = req.body;
    try {
        const post = await Post.findByPk(id);
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        post.content = content !== undefined ? content : post.content;
        post.scheduledTime = scheduledTime ? new Date(scheduledTime) : post.scheduledTime;
        post.mediaUrls = mediaUrls ? JSON.stringify(mediaUrls) : post.mediaUrls;
        post.authorUrn = req.body.authorUrn !== undefined ? req.body.authorUrn : post.authorUrn;
        post.authorName = req.body.authorName !== undefined ? req.body.authorName : post.authorName;

        // If status is provided, use it. Otherwise, if it was FAILED and we're updating, reset to SCHEDULED.
        // If status is provided, use it.
        if (status !== undefined) {
            post.status = status;
        } else {
            // Auto-transition logic
            if (post.status === 'FAILED' && (scheduledTime || content)) {
                post.status = 'SCHEDULED';
                post.error = null; // Clear error
            } else if (post.status === 'DRAFT' && post.scheduledTime > new Date()) {
                // If it's a draft and has a future time, automatically schedule it
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
router.delete('/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const post = await Post.findByPk(id);
        if (post) {
            await post.destroy();
        }
        res.json({ message: 'Post deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete post' });
    }
});

// Publish a post immediately
router.post('/:id/publish', async (req, res) => {
    const { id } = req.params;
    try {
        const post = await Post.findByPk(id);
        if (!post) {
            return res.status(404).json({ error: 'Post not found' });
        }

        const contentToPublish = markdownToUnicode(post.content);
        const linkedinId = await linkedinService.publishPost(contentToPublish, post.authorUrn || undefined);

        post.linkedinPostId = linkedinId;

        post.status = 'PUBLISHED';
        post.error = null;
        await post.save();

        res.json(post);
    } catch (error: any) {
        console.error('Publish Now Error:', error);
        // Update post status to FAILED if it fails
        try {
            const post = await Post.findByPk(id);
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
