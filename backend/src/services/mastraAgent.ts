import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { z } from 'zod';
import { AIService } from './ai';
import { Settings, Idea, SavedTrend, Post } from '../db';
import { Op } from 'sequelize';

// Helper to create OpenRouter provider with tenant's API key
function createOpenRouterForTenant(apiKey: string) {
    return createOpenRouter({ apiKey });
}

// ============================================================================
// Tools wrapping existing AIService methods
// ============================================================================

/**
 * Tool: Improvise/Refine an existing post draft
 */
export const improvisePostTool = createTool({
    id: 'improvise-post',
    description: 'Refines and enhances an existing LinkedIn or Twitter post draft while preserving the core message and author voice. Use this when the user wants to improve an existing draft.',
    inputSchema: z.object({
        tenantId: z.string().describe('The tenant ID for the user'),
        content: z.string().describe('The post content to improve'),
        authorUrn: z.string().optional().describe('LinkedIn author URN for personalization'),
        targetAudience: z.string().optional().describe('The target audience for the post'),
        direction: z.string().optional().describe('Specific improvement direction from the user'),
        platform: z.enum(['LINKEDIN', 'TWITTER', 'X']).optional().describe('Target platform (affects character limits)')
    }),
    outputSchema: z.object({
        content: z.string().describe('The improved post content')
    }),
    execute: async (inputData) => {
        const { tenantId, content, authorUrn, targetAudience, direction, platform } = inputData;
        const improvedContent = await AIService.improvise(
            tenantId!,
            content!,
            authorUrn,
            targetAudience,
            undefined, // manualToneOverride
            direction,
            platform
        );
        return { content: improvedContent };
    }
});

/**
 * Tool: Generate a new post from scratch
 */
export const generatePostTool = createTool({
    id: 'generate-post',
    description: 'Creates a compelling, high-performing LinkedIn or Twitter post from scratch based on a topic, idea, or prompt. Use this when the user wants to create new content.',
    inputSchema: z.object({
        tenantId: z.string().describe('The tenant ID for the user'),
        prompt: z.string().describe('The topic or idea to write about'),
        targetAudience: z.string().optional().describe('The target audience for the post'),
        additionalContext: z.string().optional().describe('Additional instructions or context from the user'),
        authorUrn: z.string().optional().describe('LinkedIn author URN for personalization'),
        postShape: z.enum(['Hot take', 'Breakdown (step-by-step)', 'Story / anecdote', 'Checklist', 'Before vs After', 'Diagram-first', 'Question-led', 'Myth vs Reality', 'auto']).optional().describe('The structure/format of the post'),
        effortLevel: z.enum(['Quick', 'Medium', 'Deep']).optional().describe('How detailed the post should be'),
        keyTakeaway: z.string().optional().describe('The main point or conclusion the post should drive towards'),
        antiGoals: z.string().optional().describe('Things to avoid in the post'),
        platform: z.enum(['LINKEDIN', 'TWITTER', 'X']).optional().describe('Target platform')
    }),
    outputSchema: z.object({
        content: z.string().describe('The generated post content'),
        summary: z.string().describe('A brief summary of the post angle')
    }),
    execute: async (inputData) => {
        const { tenantId, prompt, targetAudience, additionalContext, authorUrn, postShape, effortLevel, keyTakeaway, antiGoals, platform } = inputData;
        const result = await AIService.generate(
            tenantId!,
            prompt!,
            targetAudience,
            [], // previousSummaries
            additionalContext,
            authorUrn,
            postShape,
            effortLevel ? `${effortLevel === 'Quick' ? '⚡' : effortLevel === 'Medium' ? '🧠' : '🧩'} ${effortLevel}` : undefined,
            keyTakeaway,
            antiGoals,
            undefined, // manualToneOverride
            platform
        );
        return { content: result.content, summary: result.summary };
    }
});

/**
 * Tool: Generate post from an existing Idea
 */
export const generateFromIdeaTool = createTool({
    id: 'generate-from-idea',
    description: 'Generates a post from an existing saved Idea in the system. Use this when the user references an idea by ID or wants to turn an idea into a post.',
    inputSchema: z.object({
        tenantId: z.string().describe('The tenant ID for the user'),
        ideaId: z.number().describe('The ID of the idea to generate from'),
        platform: z.enum(['LINKEDIN', 'TWITTER', 'X']).optional().default('LINKEDIN').describe('Target platform'),
        additionalContext: z.string().optional().describe('Additional instructions')
    }),
    outputSchema: z.object({
        content: z.string().describe('The generated post content'),
        summary: z.string().describe('A brief summary of the post'),
        ideaTitle: z.string().describe('The title of the idea used')
    }),
    execute: async (inputData) => {
        const { tenantId, ideaId, platform, additionalContext } = inputData;
        const idea = await Idea.findOne({ where: { id: ideaId, tenantId } });
        if (!idea) {
            throw new Error(`Idea with ID ${ideaId} not found`);
        }
        const result = await AIService.generateForIdea(tenantId!, idea, platform, additionalContext);
        return { content: result.content, summary: result.summary, ideaTitle: idea.title };
    }
});

/**
 * Tool: Generate multiple hook variations
 */
export const generateHooksTool = createTool({
    id: 'generate-hooks',
    description: 'Creates multiple attention-grabbing hook variations for a post. Use this when the user wants different opening line options.',
    inputSchema: z.object({
        tenantId: z.string().describe('The tenant ID for the user'),
        content: z.string().describe('The post content to generate hooks for'),
        count: z.number().min(1).max(10).optional().default(5).describe('Number of hook variations to generate'),
        authorUrn: z.string().optional().describe('LinkedIn author URN for personalization'),
        platform: z.enum(['LINKEDIN', 'TWITTER', 'X']).optional().describe('Target platform')
    }),
    outputSchema: z.object({
        hooks: z.array(z.object({
            hook: z.string(),
            style: z.string()
        })).describe('Array of hook variations with their styles')
    }),
    execute: async (inputData) => {
        const { tenantId, content, count, authorUrn, platform } = inputData;
        const hooks = await AIService.generateHooks(tenantId!, content!, count, authorUrn, platform);
        return { hooks };
    }
});

/**
 * Tool: Generate post variations in different formats
 */
export const generateVariationsTool = createTool({
    id: 'generate-variations',
    description: 'Creates 3 different format variations of a post while preserving the same core message. Use this when the user wants to see the same content in different styles.',
    inputSchema: z.object({
        tenantId: z.string().describe('The tenant ID for the user'),
        content: z.string().describe('The post content to create variations of'),
        authorUrn: z.string().optional().describe('LinkedIn author URN for personalization'),
        targetAudience: z.string().optional().describe('The target audience'),
        platform: z.enum(['LINKEDIN', 'TWITTER', 'X']).optional().describe('Target platform')
    }),
    outputSchema: z.object({
        variations: z.array(z.object({
            content: z.string(),
            format: z.string()
        })).describe('Array of post variations with their format types')
    }),
    execute: async (inputData) => {
        const { tenantId, content, authorUrn, targetAudience, platform } = inputData;
        const variations = await AIService.generateVariations(tenantId!, content!, authorUrn, targetAudience, platform);
        return { variations };
    }
});

/**
 * Tool: Suggest hashtags for a post
 */
export const suggestHashtagsTool = createTool({
    id: 'suggest-hashtags',
    description: 'Suggests relevant and effective hashtags for a post. Use this when the user needs hashtag recommendations.',
    inputSchema: z.object({
        tenantId: z.string().describe('The tenant ID for the user'),
        content: z.string().describe('The post content to suggest hashtags for'),
        count: z.number().min(1).max(10).optional().default(5).describe('Number of hashtags to suggest'),
        platform: z.enum(['LINKEDIN', 'TWITTER', 'X']).optional().describe('Target platform')
    }),
    outputSchema: z.object({
        hashtags: z.array(z.string()).describe('Array of suggested hashtags')
    }),
    execute: async (inputData) => {
        const { tenantId, content, count, platform } = inputData;
        const hashtags = await AIService.suggestHashtags(tenantId!, content!, count, platform);
        return { hashtags };
    }
});

/**
 * Tool: Generate content idea batch
 */
export const generateIdeasTool = createTool({
    id: 'generate-ideas',
    description: 'Generates a batch of content ideas based on content pillars and company context. Use this when the user wants fresh content ideas.',
    inputSchema: z.object({
        tenantId: z.string().describe('The tenant ID for the user'),
        contentPillars: z.array(z.string()).describe('Core themes/pillars for content'),
        count: z.number().min(1).max(20).optional().default(7).describe('Number of ideas to generate'),
        companyName: z.string().optional().describe('Company or brand name'),
        industry: z.string().optional().describe('Industry sector'),
        companyDescription: z.string().optional().describe('What the company does'),
        expertiseAreas: z.array(z.string()).optional().describe('Areas of expertise'),
        targetAudience: z.string().optional().describe('Target audience'),
        audiencePainPoints: z.string().optional().describe('Pain points of the audience'),
        batchTheme: z.string().optional().describe('Specific theme focus for this batch'),
        trendingTopics: z.string().optional().describe('Current trends to consider'),
        authorUrn: z.string().optional().describe('LinkedIn author URN'),
        excludeTitles: z.array(z.string()).optional().describe('Titles to avoid duplicating')
    }),
    outputSchema: z.object({
        ideas: z.array(z.object({
            title: z.string(),
            description: z.string(),
            tags: z.array(z.string()),
            suggestedPostShape: z.string(),
            suggestedEffortLevel: z.string()
        })).describe('Array of generated content ideas')
    }),
    execute: async (inputData) => {
        const ideas = await AIService.generateIdeaBatch(inputData.tenantId!, {
            companyName: inputData.companyName,
            industry: inputData.industry,
            companyDescription: inputData.companyDescription,
            expertiseAreas: inputData.expertiseAreas,
            contentPillars: inputData.contentPillars!,
            targetAudience: inputData.targetAudience,
            audiencePainPoints: inputData.audiencePainPoints,
            batchTheme: inputData.batchTheme,
            trendingTopics: inputData.trendingTopics,
            count: inputData.count || 7,
            authorUrn: inputData.authorUrn,
            excludeTitles: inputData.excludeTitles
        });
        return { ideas };
    }
});

/**
 * Tool: Suggest content pillars
 */
export const suggestPillarsTool = createTool({
    id: 'suggest-pillars',
    description: 'Suggests 5-6 content pillars (core recurring themes) for a business to consistently post about. Use this during onboarding or strategy planning.',
    inputSchema: z.object({
        tenantId: z.string().describe('The tenant ID for the user'),
        companyName: z.string().optional().describe('Company or brand name'),
        companyDescription: z.string().describe('What the company does'),
        industry: z.string().optional().describe('Industry sector'),
        expertiseAreas: z.array(z.string()).optional().describe('Areas of expertise')
    }),
    outputSchema: z.object({
        pillars: z.array(z.string()).describe('Array of suggested content pillars')
    }),
    execute: async (inputData) => {
        const { tenantId, companyName, companyDescription, industry, expertiseAreas } = inputData;
        const pillars = await AIService.suggestContentPillars(tenantId!, companyName, companyDescription!, industry, expertiseAreas);
        return { pillars };
    }
});

/**
 * Tool: Get trending topics
 */
export const getTrendingTopicsTool = createTool({
    id: 'get-trending-topics',
    description: 'Fetches current trending topics relevant for professional content creation. Use this when the user wants inspiration from current events or trends.',
    inputSchema: z.object({
        tenantId: z.string().describe('The tenant ID for the user'),
        industry: z.string().optional().describe('Industry to focus on'),
        contentPillars: z.array(z.string()).optional().describe('Content pillars to align with'),
        targetAudience: z.string().optional().describe('Target audience'),
        count: z.number().min(1).max(10).optional().default(5).describe('Number of topics to fetch')
    }),
    outputSchema: z.object({
        topics: z.array(z.object({
            topic: z.string(),
            description: z.string(),
            relevance: z.string(),
            suggestedAngles: z.array(z.string()),
            trendType: z.string()
        })).describe('Array of trending topics')
    }),
    execute: async (inputData) => {
        const { tenantId, industry, contentPillars, targetAudience, count } = inputData;
        const topics = await AIService.getTrendingTopics(tenantId!, {
            industry,
            contentPillars,
            targetAudience,
            count
        });
        return { topics };
    }
});

/**
 * Tool: Enhance idea description
 */
export const enhanceIdeaTool = createTool({
    id: 'enhance-idea',
    description: 'Expands a raw idea into a structured content brief with key points, suggested angles, and context. Use this to flesh out rough notes into actionable briefs.',
    inputSchema: z.object({
        tenantId: z.string().describe('The tenant ID for the user'),
        title: z.string().describe('The idea title'),
        description: z.string().describe('The raw idea notes to enhance')
    }),
    outputSchema: z.object({
        enhancedDescription: z.string().describe('The structured content brief')
    }),
    execute: async (inputData) => {
        const { tenantId, title, description } = inputData;
        const enhancedDescription = await AIService.enhanceIdeaDescription(tenantId!, title!, description!);
        return { enhancedDescription };
    }
});

/**
 * Tool: Get user settings/context
 */
export const getUserContextTool = createTool({
    id: 'get-user-context',
    description: 'Retrieves user settings including company info, content pillars, target audiences, and tone preferences. ALWAYS call this first to understand the business context.',
    inputSchema: z.object({
        tenantId: z.string().describe('The tenant ID for the user')
    }),
    outputSchema: z.object({
        companyName: z.string().nullable(),
        industry: z.string().nullable(),
        companyDescription: z.string().nullable(),
        expertiseAreas: z.array(z.string()),
        contentPillars: z.array(z.string()),
        targetAudiences: z.array(z.string()),
        globalTone: z.string().nullable(),
        aiPersona: z.string().nullable()
    }),
    execute: async (inputData) => {
        const { tenantId } = inputData;
        const settings = await Settings.findOne({ where: { tenantId } });
        if (!settings) {
            return {
                companyName: null,
                industry: null,
                companyDescription: null,
                expertiseAreas: [],
                contentPillars: [],
                targetAudiences: [],
                globalTone: null,
                aiPersona: null
            };
        }
        return {
            companyName: settings.companyName,
            industry: settings.industry,
            companyDescription: settings.companyDescription,
            expertiseAreas: JSON.parse(settings.expertiseAreas || '[]'),
            contentPillars: JSON.parse(settings.contentPillars || '[]'),
            targetAudiences: settings.targetAudiences ? settings.targetAudiences.split(',').map((a: string) => a.trim()) : [],
            globalTone: settings.globalTone,
            aiPersona: settings.aiPersona
        };
    }
});

/**
 * Tool: Get saved trending topics from database
 */
export const getSavedTrendsTool = createTool({
    id: 'get-saved-trends',
    description: 'Retrieves previously saved trending topics from the database. Use this to find inspiration from current trends relevant to the business.',
    inputSchema: z.object({
        tenantId: z.string().describe('The tenant ID for the user'),
        limit: z.number().optional().default(10).describe('Maximum number of trends to return')
    }),
    outputSchema: z.object({
        trends: z.array(z.object({
            id: z.number(),
            topic: z.string(),
            description: z.string(),
            relevance: z.string(),
            suggestedAngles: z.array(z.string()),
            trendType: z.string(),
            industry: z.string().nullable(),
            fetchedAt: z.string()
        }))
    }),
    execute: async (inputData) => {
        const { tenantId, limit } = inputData;
        const trends = await SavedTrend.findAll({
            where: { tenantId },
            order: [['fetchedAt', 'DESC']],
            limit: limit || 10
        });
        return {
            trends: trends.map(t => ({
                id: t.id,
                topic: t.topic,
                description: t.description,
                relevance: t.relevance,
                suggestedAngles: JSON.parse(t.suggestedAngles || '[]'),
                trendType: t.trendType,
                industry: t.industry,
                fetchedAt: t.fetchedAt.toISOString()
            }))
        };
    }
});

/**
 * Tool: Get saved content ideas from database
 */
export const getSavedIdeasTool = createTool({
    id: 'get-saved-ideas',
    description: 'Retrieves saved content ideas from the idea board. Use this to find pre-planned content topics to develop into posts.',
    inputSchema: z.object({
        tenantId: z.string().describe('The tenant ID for the user'),
        status: z.enum(['NEW', 'DRAFTED', 'ARCHIVED']).optional().default('NEW').describe('Filter by idea status'),
        limit: z.number().optional().default(10).describe('Maximum number of ideas to return')
    }),
    outputSchema: z.object({
        ideas: z.array(z.object({
            id: z.number(),
            title: z.string(),
            description: z.string().nullable(),
            tags: z.array(z.string()),
            status: z.string(),
            postShape: z.string().nullable(),
            effortLevel: z.string().nullable(),
            keyTakeaway: z.string().nullable()
        }))
    }),
    execute: async (inputData) => {
        const { tenantId, status, limit } = inputData;
        const ideas = await Idea.findAll({
            where: { tenantId, status: status || 'NEW' },
            order: [['createdAt', 'DESC']],
            limit: limit || 10
        });
        return {
            ideas: ideas.map(i => ({
                id: i.id,
                title: i.title,
                description: i.description,
                tags: JSON.parse(i.tags || '[]'),
                status: i.status,
                postShape: i.postShape,
                effortLevel: i.effortLevel,
                keyTakeaway: i.keyTakeaway
            }))
        };
    }
});

/**
 * Tool: Get recent posts to avoid repetition
 */
export const getRecentPostsTool = createTool({
    id: 'get-recent-posts',
    description: 'Retrieves recent posts to understand what has already been published. Use this to avoid repeating similar content.',
    inputSchema: z.object({
        tenantId: z.string().describe('The tenant ID for the user'),
        limit: z.number().optional().default(10).describe('Maximum number of posts to return')
    }),
    outputSchema: z.object({
        posts: z.array(z.object({
            id: z.number(),
            content: z.string(),
            platform: z.string(),
            status: z.string(),
            createdAt: z.string()
        }))
    }),
    execute: async (inputData) => {
        const { tenantId, limit } = inputData;
        const posts = await Post.findAll({
            where: {
                tenantId,
                status: { [Op.in]: ['PUBLISHED', 'SCHEDULED'] }
            },
            order: [['createdAt', 'DESC']],
            limit: limit || 10,
            attributes: ['id', 'content', 'platforms', 'status', 'createdAt']
        });
        return {
            posts: posts.map(p => ({
                id: p.id,
                content: p.content.substring(0, 500), // Truncate for context
                platform: JSON.parse(p.platforms || '["LINKEDIN"]')[0],
                status: p.status,
                createdAt: p.createdAt.toISOString()
            }))
        };
    }
});

/**
 * Tool: Evaluate a post draft for quality
 */
export const evaluatePostTool = createTool({
    id: 'evaluate-post',
    description: 'Evaluates a post draft and provides a quality score with specific feedback. Use this to assess if a generated post meets quality standards before finalizing.',
    inputSchema: z.object({
        tenantId: z.string().describe('The tenant ID'),
        content: z.string().describe('The post content to evaluate'),
        platform: z.enum(['LINKEDIN', 'TWITTER', 'X']).optional().default('LINKEDIN'),
        targetAudience: z.string().optional().describe('The intended audience'),
        contentPillar: z.string().optional().describe('The content pillar this should align with')
    }),
    outputSchema: z.object({
        score: z.number().describe('Quality score from 1-10'),
        strengths: z.array(z.string()).describe('What the post does well'),
        weaknesses: z.array(z.string()).describe('Areas for improvement'),
        suggestions: z.array(z.string()).describe('Specific improvement suggestions'),
        hookStrength: z.number().describe('Hook strength score 1-10'),
        valueClarity: z.number().describe('Value clarity score 1-10'),
        callToAction: z.boolean().describe('Whether it has a clear CTA'),
        shouldRefine: z.boolean().describe('Whether the post needs refinement')
    }),
    execute: async (inputData) => {
        const { tenantId, content, platform, targetAudience, contentPillar } = inputData;

        // Use AIService to evaluate the post
        const config = await Settings.findOne({ where: { tenantId } });
        if (!config?.openRouterApiKey) {
            throw new Error('OpenRouter API Key not configured');
        }

        const axios = (await import('axios')).default;
        const evaluationPrompt = `Evaluate this ${platform || 'LINKEDIN'} post draft and provide a JSON assessment.

POST CONTENT:
${content}

${targetAudience ? `TARGET AUDIENCE: ${targetAudience}` : ''}
${contentPillar ? `CONTENT PILLAR: ${contentPillar}` : ''}

Evaluate on these criteria:
1. Hook strength (does the first line grab attention?)
2. Value delivery (does it provide clear value to the reader?)
3. Structure and readability
4. Authenticity and voice
5. Call to action or engagement prompt
6. Platform appropriateness (length, format)

Return ONLY this JSON (no markdown):
{
  "score": <1-10 overall>,
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1", "weakness2"],
  "suggestions": ["specific suggestion 1", "specific suggestion 2"],
  "hookStrength": <1-10>,
  "valueClarity": <1-10>,
  "callToAction": <true/false>,
  "shouldRefine": <true if score < 7>
}`;

        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: config.openRouterModelId || 'anthropic/claude-sonnet-4',
                messages: [
                    { role: 'system', content: 'You are a social media content quality evaluator. Return only valid JSON.' },
                    { role: 'user', content: evaluationPrompt }
                ],
                temperature: 0.3
            },
            {
                headers: {
                    'Authorization': `Bearer ${config.openRouterApiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const responseText = response.data.choices[0]?.message?.content || '';
        try {
            // Extract JSON from response
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            console.error('Failed to parse evaluation:', e);
        }

        // Default response if parsing fails
        return {
            score: 5,
            strengths: ['Unable to fully evaluate'],
            weaknesses: ['Evaluation parsing failed'],
            suggestions: ['Please review manually'],
            hookStrength: 5,
            valueClarity: 5,
            callToAction: false,
            shouldRefine: true
        };
    }
});

// ============================================================================
// All tools collection
// ============================================================================

export const contentCreatorTools = {
    // Context gathering tools
    getUserContextTool,
    getSavedTrendsTool,
    getSavedIdeasTool,
    getRecentPostsTool,
    // Generation tools
    generatePostTool,
    generateFromIdeaTool,
    improvisePostTool,
    generateHooksTool,
    generateVariationsTool,
    // Evaluation tools
    evaluatePostTool,
    // Enhancement tools
    suggestHashtagsTool,
    generateIdeasTool,
    suggestPillarsTool,
    getTrendingTopicsTool,
    enhanceIdeaTool
};

// ============================================================================
// Content Creator Agent
// ============================================================================

/**
 * Creates a Mastra agent configured for content creation tasks
 * @param apiKey - The OpenRouter API key from tenant settings
 * @param modelId - The model identifier (e.g., 'anthropic/claude-sonnet-4')
 */
export function createContentCreatorAgent(apiKey: string, modelId: string = 'anthropic/claude-sonnet-4') {
    const openrouter = createOpenRouterForTenant(apiKey);

    return new Agent({
        id: 'content-creator-agent',
        name: 'Content Strategist Agent',
        instructions: `You are an expert Content Strategist Agent. Your job is to create HIGH-QUALITY, PUBLISHABLE social media posts through an iterative workflow.

## YOUR MANDATORY WORKFLOW

You MUST follow this workflow for EVERY post generation request. Use the tools - do not generate content directly.

### STEP 1: GATHER CONTEXT (Always do this first)
Call these tools to understand the business:
- get-user-context: Get company info, content pillars, target audience, tone
- get-saved-trends: Get current trending topics for inspiration
- get-saved-ideas: Get pre-planned content ideas
- get-recent-posts: See what's been posted to avoid repetition

### STEP 2: STRATEGIZE (Think before generating)
Based on the context, decide:
- Which content pillar to focus on
- Which trend or idea to build from (if any)
- What unique angle to take
- What post format works best (Hot take, Story, Breakdown, etc.)

### STEP 3: GENERATE INITIAL DRAFT
Use generate-post with:
- A well-crafted prompt combining your strategic choices
- The appropriate post shape/format
- Clear target audience
- Key takeaway you want readers to get

### STEP 4: EVALUATE THE DRAFT
Use evaluate-post to assess quality:
- If score >= 7: Proceed to Step 5
- If score < 7: Use improvise-post with the suggestions, then re-evaluate
- Maximum 2 refinement cycles

### STEP 5: ENHANCE WITH HOOKS & HASHTAGS
- Use generate-hooks to create 3 alternative opening lines
- Use suggest-hashtags to add 3-5 relevant hashtags

### STEP 6: RETURN FINAL RESULT
Return a structured response with:
1. The final post content (ready to publish)
2. Your strategic explanation (why this topic, angle, format)
3. Alternative hooks
4. Suggested hashtags
5. Quality score from evaluation

## OUTPUT FORMAT

After completing the workflow, return your final output in this EXACT JSON format:
{
  "posts": [
    {
      "content": "The full post content here",
      "explanation": "Why I chose this topic and angle",
      "hooks": ["alt hook 1", "alt hook 2", "alt hook 3"],
      "hashtags": ["#hashtag1", "#hashtag2"],
      "qualityScore": 8,
      "basedOn": "trend/idea/pillar name"
    }
  ]
}

## CRITICAL RULES

1. ALWAYS use tools - never generate content directly without tools
2. ALWAYS gather context first - don't skip Step 1
3. ALWAYS evaluate before finalizing - quality matters
4. Each post should be UNIQUE - different angles, different pillars
5. Posts must be READY TO PUBLISH - not drafts or outlines
6. Keep LinkedIn posts under 2800 chars, Twitter under 270 chars

You are an agent. Use your tools. Follow the workflow. Deliver quality.`,
        model: openrouter(modelId),
        tools: contentCreatorTools
    });
}

// ============================================================================
// Agent Draft Model Types
// ============================================================================

export interface AgentDraftInput {
    tenantId: string;
    userMessage: string;
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
    authorUrn?: string;
}

export interface AgentDraftOutput {
    response: string;
    toolsUsed: string[];
    generatedContent?: {
        type: 'post' | 'hooks' | 'variations' | 'ideas' | 'hashtags' | 'pillars' | 'trends';
        data: unknown;
    };
}

// ============================================================================
// Agent Service Class
// ============================================================================

export class MastraAgentService {
    private agentCache: Map<string, ReturnType<typeof createContentCreatorAgent>> = new Map();

    /**
     * Get or create an agent for a specific tenant
     */
    private async getAgentForTenant(tenantId: string): Promise<ReturnType<typeof createContentCreatorAgent>> {
        // Check cache first
        if (this.agentCache.has(tenantId)) {
            return this.agentCache.get(tenantId)!;
        }

        // Fetch tenant settings to get API key
        const settings = await Settings.findOne({ where: { tenantId } });
        if (!settings?.openRouterApiKey) {
            throw new Error('OpenRouter API Key not found. Please configure it in Settings.');
        }

        const modelId = settings.openRouterModelId || 'anthropic/claude-sonnet-4';
        const agent = createContentCreatorAgent(settings.openRouterApiKey, modelId);

        // Cache the agent
        this.agentCache.set(tenantId, agent);
        return agent;
    }

    /**
     * Process a user message through the agent
     */
    async chat(input: AgentDraftInput): Promise<AgentDraftOutput> {
        const { tenantId, userMessage, conversationHistory = [], authorUrn } = input;

        const agent = await this.getAgentForTenant(tenantId);

        // Build messages array with context
        const contextMessage = `[Context: tenantId=${tenantId}${authorUrn ? `, authorUrn=${authorUrn}` : ''}]`;

        // Use string format for messages - Mastra accepts string[] as MessageListInput
        const prompt = [
            ...conversationHistory.map(msg => `${msg.role}: ${msg.content}`),
            `user: ${contextMessage}\n\n${userMessage}`
        ].join('\n\n');

        console.log('[MastraAgent] Calling agent.generate with prompt length:', prompt.length);
        console.log('[MastraAgent] Agent tools:', Object.keys((agent as any).tools || {}));

        // maxSteps > 1 enables tool calling iterations
        // The agent will loop: generate -> tool call -> process result -> generate -> ...
        const response = await agent.generate(prompt, {
            maxSteps: 20,  // Allow up to 10 tool calling iterations
            onStepFinish: (step: any) => {
                console.log('[MastraAgent] Step finished:', step.stepType, step.toolCalls?.length || 0, 'tool calls');
            }
        });

        console.log('[MastraAgent] Response keys:', Object.keys(response));
        console.log('[MastraAgent] toolCalls:', response.toolCalls?.length || 0);
        console.log('[MastraAgent] toolResults:', response.toolResults?.length || 0);

        const toolsUsed = response.toolCalls?.map((tc) => (tc as { toolName?: string }).toolName).filter(Boolean) as string[] || [];

        return {
            response: response.text || '',
            toolsUsed,
            generatedContent: this.extractGeneratedContent(response.toolResults)
        };
    }

    /**
     * Stream a response from the agent
     */
    async *streamChat(input: AgentDraftInput): AsyncGenerator<{ text?: string; toolCall?: string; done?: boolean }> {
        const { tenantId, userMessage, conversationHistory = [], authorUrn } = input;

        const agent = await this.getAgentForTenant(tenantId);

        const contextMessage = `[Context: tenantId=${tenantId}${authorUrn ? `, authorUrn=${authorUrn}` : ''}]`;

        const prompt = [
            ...conversationHistory.map(msg => `${msg.role}: ${msg.content}`),
            `user: ${contextMessage}\n\n${userMessage}`
        ].join('\n\n');

        const stream = await agent.stream(prompt);

        for await (const chunk of stream.textStream) {
            yield { text: chunk };
        }

        yield { done: true };
    }

    /**
     * Clear cached agent for a tenant (call when settings change)
     */
    clearCache(tenantId?: string) {
        if (tenantId) {
            this.agentCache.delete(tenantId);
        } else {
            this.agentCache.clear();
        }
    }

    private extractGeneratedContent(toolResults: unknown): AgentDraftOutput['generatedContent'] | undefined {
        if (!toolResults || !Array.isArray(toolResults)) return undefined;

        for (const result of toolResults) {
            if (!result || typeof result !== 'object') continue;
            const r = result as Record<string, unknown>;

            if ('content' in r && typeof r.content === 'string') {
                return { type: 'post', data: r };
            }
            if ('hooks' in r && Array.isArray(r.hooks)) {
                return { type: 'hooks', data: r.hooks };
            }
            if ('variations' in r && Array.isArray(r.variations)) {
                return { type: 'variations', data: r.variations };
            }
            if ('ideas' in r && Array.isArray(r.ideas)) {
                return { type: 'ideas', data: r.ideas };
            }
            if ('hashtags' in r && Array.isArray(r.hashtags)) {
                return { type: 'hashtags', data: r.hashtags };
            }
            if ('pillars' in r && Array.isArray(r.pillars)) {
                return { type: 'pillars', data: r.pillars };
            }
            if ('topics' in r && Array.isArray(r.topics)) {
                return { type: 'trends', data: r.topics };
            }
        }
        return undefined;
    }
}

// Export singleton instance
let agentServiceInstance: MastraAgentService | null = null;

export function getMastraAgentService(): MastraAgentService {
    if (!agentServiceInstance) {
        agentServiceInstance = new MastraAgentService();
    }
    return agentServiceInstance;
}
