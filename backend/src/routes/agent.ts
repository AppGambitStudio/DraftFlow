import express, { Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';
import { getMastraAgentService } from '../services/mastraAgent';
import { AgentDraft, Post, Settings, SavedTrend, Idea } from '../db';
import { Op } from 'sequelize';

const router = express.Router();

// ============================================================================
// Generate posts using the Content Strategist Agent
// ============================================================================
router.post('/generate', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const { count = 1, platform = 'LINKEDIN', focus = 'auto' } = req.body;

        // Validate settings exist
        const settings = await Settings.findOne({ where: { tenantId } });
        if (!settings) {
            return res.status(400).json({ error: 'Please complete your profile settings first' });
        }

        const contentPillars = JSON.parse(settings.contentPillars || '[]');
        if (contentPillars.length === 0) {
            return res.status(400).json({ error: 'Please set up content pillars in settings first' });
        }

        // Build the agent task
        let focusInstruction = '';
        if (focus === 'trends') {
            focusInstruction = 'Prioritize using saved trends as inspiration for the posts.';
        } else if (focus === 'ideas') {
            focusInstruction = 'Prioritize using saved ideas from the idea board.';
        } else {
            focusInstruction = 'Use a mix of trends, ideas, and content pillars for variety.';
        }

        const agentTask = `Generate ${count} unique, high-quality ${platform} post(s) for this business.

TENANT ID: ${tenantId}
PLATFORM: ${platform}
NUMBER OF POSTS: ${count}

INSTRUCTIONS:
1. First, call get-user-context with tenantId "${tenantId}" to understand the business
2. Call get-saved-trends with tenantId "${tenantId}" to see trending topics
3. Call get-saved-ideas with tenantId "${tenantId}" to see content ideas
4. Call get-recent-posts with tenantId "${tenantId}" to avoid repetition
5. ${focusInstruction}

For EACH post:
- Use generate-post to create the initial draft
- Use evaluate-post to check quality (must score >= 7)
- If score < 7, use improvise-post to refine, then re-evaluate
- Use generate-hooks to create alternative openings
- Use suggest-hashtags to add relevant hashtags

After completing all posts, return your final output as JSON with this structure:
{
  "posts": [
    {
      "content": "full post text",
      "explanation": "strategic reasoning",
      "hooks": ["hook1", "hook2", "hook3"],
      "hashtags": ["#tag1", "#tag2"],
      "qualityScore": 8,
      "basedOn": "source name"
    }
  ]
}

Remember: Use the tools. Follow the workflow. Each post must be unique and publication-ready.`;

        // Call the Mastra agent
        console.log('[Agent Route] Starting Mastra agent for tenant:', tenantId);
        console.log('[Agent Route] Task:', agentTask.substring(0, 200) + '...');

        const agentService = getMastraAgentService();
        const result = await agentService.chat({
            tenantId,
            userMessage: agentTask
        });

        console.log('[Agent Route] Agent completed. Tools used:', result.toolsUsed);
        console.log('[Agent Route] Response length:', result.response.length);

        // Parse the agent response to extract posts
        const createdDrafts: any[] = [];

        // Try to extract JSON from the response
        let agentPosts: any[] = [];
        try {
            // Look for JSON in the response
            const jsonMatch = result.response.match(/\{[\s\S]*"posts"[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                agentPosts = parsed.posts || [];
            }
        } catch (e) {
            console.log('Could not parse structured JSON from agent, will extract content directly');
        }

        // If we got structured posts from the agent
        if (agentPosts.length > 0) {
            for (const post of agentPosts) {
                const draft = await AgentDraft.create({
                    tenantId,
                    content: post.content,
                    explanation: post.explanation || `Quality score: ${post.qualityScore || 'N/A'}. Based on: ${post.basedOn || 'content strategy'}`,
                    sources: JSON.stringify([post.basedOn || 'agent strategy']),
                    hooks: JSON.stringify(post.hooks || []),
                    hashtags: JSON.stringify(post.hashtags || []),
                    status: 'pending',
                    platform
                });

                createdDrafts.push({
                    id: draft.id,
                    content: draft.content,
                    explanation: draft.explanation,
                    sources: [post.basedOn || 'agent strategy'],
                    hooks: post.hooks || [],
                    hashtags: post.hashtags || [],
                    qualityScore: post.qualityScore,
                    status: draft.status,
                    platform: draft.platform,
                    createdAt: draft.createdAt
                });
            }
        } else if (result.generatedContent?.type === 'post') {
            // Fallback: extract from tool results
            const postData = result.generatedContent.data as { content: string; summary?: string };
            const draft = await AgentDraft.create({
                tenantId,
                content: postData.content,
                explanation: postData.summary || 'Generated by Content Strategist Agent',
                sources: JSON.stringify(['agent workflow']),
                hooks: JSON.stringify([]),
                hashtags: JSON.stringify([]),
                status: 'pending',
                platform
            });

            createdDrafts.push({
                id: draft.id,
                content: draft.content,
                explanation: draft.explanation,
                sources: ['agent workflow'],
                hooks: [],
                hashtags: [],
                status: draft.status,
                platform: draft.platform,
                createdAt: draft.createdAt
            });
        }

        // If still no drafts, return the raw response for debugging
        if (createdDrafts.length === 0) {
            return res.status(200).json({
                drafts: [],
                agentResponse: result.response,
                toolsUsed: result.toolsUsed,
                message: 'Agent completed but no structured posts were extracted. See agentResponse for details.'
            });
        }

        res.json({
            drafts: createdDrafts,
            toolsUsed: result.toolsUsed
        });

    } catch (error: any) {
        console.error('Agent generate error:', error);
        res.status(500).json({ error: error.message || 'Failed to generate content' });
    }
});

// ============================================================================
// List drafts (pending, approved, rejected)
// ============================================================================
router.get('/drafts', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const { status } = req.query;

        const where: any = { tenantId };
        if (status && ['pending', 'approved', 'rejected'].includes(status as string)) {
            where.status = status;
        }

        const drafts = await AgentDraft.findAll({
            where,
            order: [['createdAt', 'DESC']],
            limit: 50
        });

        res.json({
            drafts: drafts.map(d => ({
                id: d.id,
                content: d.content,
                explanation: d.explanation,
                sources: JSON.parse(d.sources || '[]'),
                hooks: JSON.parse(d.hooks || '[]'),
                hashtags: JSON.parse(d.hashtags || '[]'),
                status: d.status,
                platform: d.platform,
                scheduledFor: d.scheduledFor,
                postId: d.postId,
                createdAt: d.createdAt,
                updatedAt: d.updatedAt
            }))
        });

    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// Get single draft
// ============================================================================
router.get('/drafts/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const { id } = req.params;

        const draft = await AgentDraft.findOne({
            where: { id, tenantId }
        });

        if (!draft) {
            return res.status(404).json({ error: 'Draft not found' });
        }

        res.json({
            id: draft.id,
            content: draft.content,
            explanation: draft.explanation,
            sources: JSON.parse(draft.sources || '[]'),
            hooks: JSON.parse(draft.hooks || '[]'),
            hashtags: JSON.parse(draft.hashtags || '[]'),
            status: draft.status,
            platform: draft.platform,
            scheduledFor: draft.scheduledFor,
            postId: draft.postId,
            createdAt: draft.createdAt,
            updatedAt: draft.updatedAt
        });

    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// Update draft (edit content before approval)
// ============================================================================
router.put('/drafts/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const { id } = req.params;
        const { content, platform, scheduledFor } = req.body;

        const draft = await AgentDraft.findOne({
            where: { id, tenantId }
        });

        if (!draft) {
            return res.status(404).json({ error: 'Draft not found' });
        }

        if (draft.status !== 'pending') {
            return res.status(400).json({ error: 'Can only edit pending drafts' });
        }

        await draft.update({
            content: content || draft.content,
            platform: platform || draft.platform,
            scheduledFor: scheduledFor ? new Date(scheduledFor) : draft.scheduledFor
        });

        res.json({
            id: draft.id,
            content: draft.content,
            explanation: draft.explanation,
            sources: JSON.parse(draft.sources || '[]'),
            hooks: JSON.parse(draft.hooks || '[]'),
            hashtags: JSON.parse(draft.hashtags || '[]'),
            status: draft.status,
            platform: draft.platform,
            scheduledFor: draft.scheduledFor,
            createdAt: draft.createdAt,
            updatedAt: draft.updatedAt
        });

    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// Approve draft (creates a post)
// ============================================================================
router.post('/drafts/:id/approve', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const userId = req.user?.id;
        const { id } = req.params;
        const { scheduledFor, scheduledTime, authorUrn, authorName } = req.body;
        // Support both field names (frontend sends scheduledTime)
        const scheduleDate = scheduledFor || scheduledTime;

        const draft = await AgentDraft.findOne({
            where: { id, tenantId }
        });

        if (!draft) {
            return res.status(404).json({ error: 'Draft not found' });
        }

        if (draft.status !== 'pending') {
            return res.status(400).json({ error: 'Draft has already been processed' });
        }

        // Create the post
        const post = await Post.create({
            tenantId,
            userId,
            content: draft.content,
            platforms: JSON.stringify([draft.platform]),
            status: scheduleDate ? 'SCHEDULED' : 'DRAFT',
            scheduledTime: scheduleDate ? new Date(scheduleDate) : null,
            authorUrn: authorUrn || null,
            authorName: authorName || null
        });

        // Update draft status
        await draft.update({
            status: 'approved',
            postId: post.id,
            scheduledFor: scheduleDate ? new Date(scheduleDate) : null
        });

        res.json({
            draft: {
                id: draft.id,
                status: 'approved',
                postId: post.id
            },
            post: {
                id: post.id,
                content: post.content,
                status: post.status,
                scheduledTime: post.scheduledTime,
                platforms: JSON.parse(post.platforms)
            }
        });

    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// Reject draft
// ============================================================================
router.post('/drafts/:id/reject', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const { id } = req.params;
        const { reason } = req.body;

        const draft = await AgentDraft.findOne({
            where: { id, tenantId }
        });

        if (!draft) {
            return res.status(404).json({ error: 'Draft not found' });
        }

        if (draft.status !== 'pending') {
            return res.status(400).json({ error: 'Draft has already been processed' });
        }

        await draft.update({
            status: 'rejected',
            explanation: reason
                ? `${draft.explanation || ''}\n\nRejection reason: ${reason}`
                : draft.explanation
        });

        res.json({
            id: draft.id,
            status: 'rejected'
        });

    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// Delete draft
// ============================================================================
router.delete('/drafts/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const { id } = req.params;

        const draft = await AgentDraft.findOne({
            where: { id, tenantId }
        });

        if (!draft) {
            return res.status(404).json({ error: 'Draft not found' });
        }

        await draft.destroy();

        res.json({ success: true });

    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
