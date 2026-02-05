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
        const { count = 1, platform = 'LINKEDIN', focus = 'auto', context = '' } = req.body;

        // Validate settings exist
        const settings = await Settings.findOne({ where: { tenantId } });
        if (!settings) {
            return res.status(400).json({ error: 'Please complete your profile settings first' });
        }

        const contentPillars = JSON.parse(settings.contentPillars || '[]');
        if (contentPillars.length === 0) {
            return res.status(400).json({ error: 'Please set up content pillars in settings first' });
        }

        // Get recent posts to identify topics to AVOID
        const recentPosts = await Post.findAll({
            where: { tenantId, status: { [Op.in]: ['PUBLISHED', 'SCHEDULED', 'DRAFT'] } },
            order: [['createdAt', 'DESC']],
            limit: 5,
            attributes: ['content']
        });

        // Get recent drafts to also avoid those topics
        const recentDrafts = await AgentDraft.findAll({
            where: { tenantId },
            order: [['createdAt', 'DESC']],
            limit: 5,
            attributes: ['content']
        });

        // Extract key topics from recent content to avoid
        const recentTopics = [...recentPosts, ...recentDrafts]
            .map(p => p.content.substring(0, 100))
            .join('\n- ');

        // Build STRONG focus instruction
        let focusInstruction = '';
        let sourcePreference = '';
        if (focus === 'trends') {
            focusInstruction = `⚠️ MANDATORY: You MUST base your post on a SAVED TREND. Do NOT use ideas or general topics.`;
            sourcePreference = 'TREND';
        } else if (focus === 'ideas') {
            focusInstruction = `⚠️ MANDATORY: You MUST base your post on a SAVED IDEA from the idea board. Do NOT use trends.`;
            sourcePreference = 'IDEA';
        } else if (focus === 'case-studies') {
            focusInstruction = `⚠️ MANDATORY: You MUST base your post on a CASE STUDY. Use generate-from-case-study tool.`;
            sourcePreference = 'CASE_STUDY';
        } else {
            focusInstruction = `You may choose from trends, ideas, case studies, or content pillars - but MUST pick something DIFFERENT from recent posts.`;
            sourcePreference = 'ANY';
        }

        // Generate a random seed to encourage variety
        const randomSeed = Math.floor(Math.random() * 1000);

        // Build completely different tasks based on whether user provided context
        let agentTask: string;

        if (context && context.trim()) {
            // TYPE 1: User provided specific topic
            agentTask = `TYPE 1: DIRECT TOPIC POST

═══════════════════════════════════════════════════════════════════════════════
TOPIC: "${context.trim()}"
TENANT: ${tenantId}
PLATFORM: ${platform}
═══════════════════════════════════════════════════════════════════════════════

Create a ${platform} post about "${context.trim()}" that sounds like a real professional wrote it.

**Your goal:** Create a post that:
- Is specifically about "${context.trim()}" (don't change the topic)
- Quality score ≥ 7
- Authenticity score ≥ 7 (doesn't sound like AI)
- Sounds like the professional wrote it themselves

**Context you'll need:**
- Call get-user-context to understand who you're ghostwriting for
- Call get-recent-posts to see what angles to AVOID (don't repeat)

**Your judgment calls:**
- Would fresh stats/data strengthen this? → use web-search
- Is this a complex topic that needs planning? → use create-plan
- Does the first draft score < 7? → use improvise-post and re-evaluate
- Does it sound too AI-like? → use self-critique to fix it

**Don't use:** get-saved-trends, get-saved-ideas, get-case-studies (topic is already given)

**Output JSON:**
{
  "posts": [{
    "content": "final post ready to publish",
    "explanation": "why this angle works",
    "hooks": ["hook1", "hook2", "hook3"],
    "hashtags": ["#tag1", "#tag2"],
    "qualityScore": 8,
    "authenticityScore": 8,
    "basedOn": "${context.trim()}",
    "toolsUsedAndWhy": ["tool: reason"]
  }]
}`;
        } else {
            // TYPE 2: No user context, agent selects from sources
            agentTask = `TYPE 2: SELECT TOPIC & CREATE POST

═══════════════════════════════════════════════════════════════════════════════
TENANT: ${tenantId}
PLATFORM: ${platform}
COUNT: ${count} post(s)
SOURCE PREFERENCE: ${sourcePreference}
SESSION: ${randomSeed}
═══════════════════════════════════════════════════════════════════════════════

Create ${count} ${platform} post(s) that sound like a real professional wrote them.

**Your goal:** Create post(s) that:
- Quality score ≥ 7
- Authenticity score ≥ 7 (doesn't sound like AI)
- Are DIFFERENT from recent posts (variety is key)
- Sound like the professional wrote them

**Source guidance:**
${focusInstruction}

**Recent content to AVOID repeating:**
${recentTopics ? `- ${recentTopics}` : '(No recent posts - you have freedom to choose)'}

**Finding a topic:**
- Use get-saved-trends, get-saved-ideas, get-case-studies to explore options
- Each tool returns RANDOMIZED results with a selectionHint - consider following it
- Use get-recent-posts to see what to AVOID (don't repeat similar topics)
- Pick something FRESH and DIFFERENT

**Your judgment calls:**
- Complex topic? → use create-plan to think through the angle
- Need current data? → use web-search
- First draft scores < 7? → use improvise-post based on feedback
- Too similar to recent posts? → change the angle, not just words
- Sounds too AI-like? → use self-critique to humanize it

**Quality gates before returning:**
- Verify uniqueness with check-similarity
- Quality score must be ≥ 7
- Post should sound human, not like AI generated it

**Output JSON:**
{
  "posts": [
    {
      "content": "final post ready to publish",
      "explanation": "why you chose this topic and angle",
      "hooks": ["hook1", "hook2", "hook3"],
      "hashtags": ["#tag1", "#tag2"],
      "qualityScore": 8,
      "authenticityScore": 8,
      "basedOn": "the trend/idea/case study you used",
      "toolsUsedAndWhy": ["tool: reason"]
    }
  ]
}`;
        }

        // Call the Mastra agent
        console.log('[Agent Route] ═══════════════════════════════════════════════════');
        console.log('[Agent Route] Starting Mastra agent for tenant:', tenantId);
        console.log('[Agent Route] Platform:', platform, '| Count:', count, '| Focus:', focus);
        console.log('[Agent Route] USER CONTEXT:', context || '(none provided)');
        console.log('[Agent Route] ═══════════════════════════════════════════════════');
        console.log('[Agent Route] Full Task:\n', agentTask);

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
                // Build explanation with quality metrics
                const qualityInfo = [];
                if (post.qualityScore) qualityInfo.push(`Quality: ${post.qualityScore}/10`);
                if (post.authenticityScore) qualityInfo.push(`Authenticity: ${post.authenticityScore}/10`);
                if (post.selfCritiqueApplied) qualityInfo.push('Self-critique applied');
                const explanation = post.explanation || `${qualityInfo.join(' | ')}. Based on: ${post.basedOn || 'content strategy'}`;

                const draft = await AgentDraft.create({
                    tenantId,
                    content: post.content,
                    explanation,
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
                    authenticityScore: post.authenticityScore,
                    selfCritiqueApplied: post.selfCritiqueApplied,
                    changesFromCritique: post.changesFromCritique || [],
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
// List drafts (pending, approved, rejected) with pagination
// ============================================================================
router.get('/drafts', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const { status } = req.query;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 10;
        const offset = (page - 1) * limit;

        const where: any = { tenantId };
        if (status && ['pending', 'approved', 'rejected'].includes(status as string)) {
            where.status = status;
        }

        const { count: totalCount, rows: drafts } = await AgentDraft.findAndCountAll({
            where,
            order: [['createdAt', 'DESC']],
            limit,
            offset
        });

        // Also get counts for each status (for tab badges)
        const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
            AgentDraft.count({ where: { tenantId, status: 'pending' } }),
            AgentDraft.count({ where: { tenantId, status: 'approved' } }),
            AgentDraft.count({ where: { tenantId, status: 'rejected' } })
        ]);

        const totalPages = Math.ceil(totalCount / limit);

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
            })),
            totalCount,
            page,
            limit,
            totalPages,
            hasMore: page < totalPages,
            counts: {
                pending: pendingCount,
                approved: approvedCount,
                rejected: rejectedCount
            }
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
