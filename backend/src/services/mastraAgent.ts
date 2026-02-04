import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { z } from 'zod';
import { AIService } from './ai';
import { Settings, Idea, SavedTrend, Post } from '../db';
import { Op } from 'sequelize';
import axios from 'axios';

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
 * Tool: Web search for fact-checking and finding fresh angles
 */
export const webSearchTool = createTool({
    id: 'web-search',
    description: 'Search the web for current information, statistics, news, or to fact-check claims. Use this to find fresh angles, verify facts, or discover recent developments on a topic.',
    inputSchema: z.object({
        tenantId: z.string().describe('The tenant ID'),
        query: z.string().describe('The search query - be specific and focused'),
        purpose: z.enum(['fact-check', 'find-stats', 'recent-news', 'fresh-angle']).describe('Why you are searching')
    }),
    outputSchema: z.object({
        results: z.array(z.object({
            title: z.string(),
            snippet: z.string(),
            url: z.string()
        })),
        summary: z.string().describe('Brief summary of key findings')
    }),
    execute: async (inputData) => {
        const { tenantId, query, purpose } = inputData;

        // Get API key for web search (using OpenRouter with web plugin)
        const settings = await Settings.findOne({ where: { tenantId } });
        if (!settings?.openRouterApiKey) {
            throw new Error('OpenRouter API Key not configured');
        }

        try {
            // Use OpenRouter with web search enabled
            const response = await axios.post(
                'https://openrouter.ai/api/v1/chat/completions',
                {
                    model: settings.openRouterModelId || 'anthropic/claude-sonnet-4',
                    messages: [
                        {
                            role: 'system',
                            content: `You are a research assistant. Search the web and provide factual, current information. Purpose: ${purpose}`
                        },
                        {
                            role: 'user',
                            content: `Search for: ${query}\n\nProvide 3-5 relevant results with titles, snippets, and a brief summary of key findings. Format as JSON: { "results": [...], "summary": "..." }`
                        }
                    ],
                    plugins: [{ id: 'web' }],
                    temperature: 0.3
                },
                {
                    headers: {
                        'Authorization': `Bearer ${settings.openRouterApiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const responseText = response.data.choices[0]?.message?.content || '';

            // Parse JSON from response
            try {
                const jsonMatch = responseText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[0]);
                }
            } catch (e) {
                // Return raw response as summary if parsing fails
            }

            return {
                results: [],
                summary: responseText.substring(0, 500)
            };
        } catch (error: any) {
            console.error('[webSearchTool] Error:', error.message);
            return {
                results: [],
                summary: `Search failed: ${error.message}`
            };
        }
    }
});

/**
 * Tool: Check content similarity against recent posts
 */
export const checkSimilarityTool = createTool({
    id: 'check-similarity',
    description: 'Check if a draft post is too similar to recent posts. Use this BEFORE finalizing any post to ensure uniqueness.',
    inputSchema: z.object({
        tenantId: z.string().describe('The tenant ID'),
        draftContent: z.string().describe('The draft post content to check'),
        threshold: z.number().optional().default(0.7).describe('Similarity threshold (0-1). Above this = too similar')
    }),
    outputSchema: z.object({
        isTooSimilar: z.boolean(),
        mostSimilarPost: z.string().nullable(),
        similarityScore: z.number(),
        suggestion: z.string()
    }),
    execute: async (inputData) => {
        const { tenantId, draftContent, threshold } = inputData;

        // Get recent posts
        const recentPosts = await Post.findAll({
            where: {
                tenantId,
                status: { [Op.in]: ['PUBLISHED', 'SCHEDULED', 'DRAFT'] }
            },
            order: [['createdAt', 'DESC']],
            limit: 20,
            attributes: ['content']
        });

        if (recentPosts.length === 0) {
            return {
                isTooSimilar: false,
                mostSimilarPost: null,
                similarityScore: 0,
                suggestion: 'No recent posts to compare against'
            };
        }

        // Simple similarity check using word overlap (Jaccard similarity)
        const draftWords = new Set(draftContent.toLowerCase().split(/\s+/).filter(w => w.length > 3));
        let maxSimilarity = 0;
        let mostSimilar = '';

        for (const post of recentPosts) {
            const postWords = new Set(post.content.toLowerCase().split(/\s+/).filter(w => w.length > 3));
            const intersection = new Set([...draftWords].filter(w => postWords.has(w)));
            const union = new Set([...draftWords, ...postWords]);
            const similarity = intersection.size / union.size;

            if (similarity > maxSimilarity) {
                maxSimilarity = similarity;
                mostSimilar = post.content.substring(0, 200);
            }
        }

        const isTooSimilar = maxSimilarity > (threshold || 0.7);

        return {
            isTooSimilar,
            mostSimilarPost: isTooSimilar ? mostSimilar : null,
            similarityScore: Math.round(maxSimilarity * 100) / 100,
            suggestion: isTooSimilar
                ? 'This draft is too similar to existing posts. Try a different angle, use a unique hook, or focus on a different aspect of the topic.'
                : 'Content is sufficiently unique.'
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
    // Research tools
    webSearchTool,
    // Generation tools
    generatePostTool,
    generateFromIdeaTool,
    improvisePostTool,
    generateHooksTool,
    generateVariationsTool,
    // Evaluation & validation tools
    evaluatePostTool,
    checkSimilarityTool,
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

You MUST follow this workflow for EVERY post. Use the tools - NEVER generate content directly.

### STEP 1: GATHER CONTEXT
Call these tools FIRST:
- get-user-context: Get company info, pillars, audience, tone
- get-saved-trends: Get trending topics
- get-saved-ideas: Get content ideas
- get-recent-posts: CRITICAL - see what's been posted (YOU MUST AVOID SIMILARITY)

### STEP 2: RESEARCH & FACT-CHECK
Use web-search to:
- Find fresh statistics or data points for your chosen topic
- Verify any claims or facts you plan to include
- Discover recent news or developments to reference
- Find a unique angle not covered in recent posts

### STEP 3: STRATEGIZE FOR UNIQUENESS
After reviewing recent posts, you MUST create something DIFFERENT:
- Choose a DIFFERENT content pillar than recent posts
- Take a CONTRARIAN or UNEXPECTED angle
- Use a DIFFERENT post format (if recent was story, try hot-take)
- Focus on a DIFFERENT audience pain point
- Add FRESH data/stats from your web research

### STEP 4: GENERATE DRAFT
Use generate-post with a UNIQUE prompt that:
- Combines your fresh research with business expertise
- Takes an angle NOT covered in recent posts
- Includes specific data points or examples
- Has a clearly different tone/format from recent content

### STEP 5: CHECK SIMILARITY (MANDATORY)
Use check-similarity to compare your draft against recent posts:
- If isTooSimilar = true: You MUST use improvise-post with direction "make this completely different - change the angle, examples, and structure" then check again
- If isTooSimilar = false: Proceed to evaluation
- Maximum 3 attempts - if still similar, pick a completely different topic

### STEP 6: EVALUATE QUALITY
Use evaluate-post:
- Score must be >= 7 to proceed
- If < 7: Use improvise-post with suggestions, re-evaluate
- Maximum 2 refinement cycles

### STEP 7: ENHANCE
- generate-hooks: Create 3 DIFFERENT style hooks (question, bold claim, story opener)
- suggest-hashtags: Add 3-5 relevant hashtags

### STEP 8: RETURN RESULT
Return JSON with this EXACT structure:
{
  "posts": [
    {
      "content": "Full post text ready to publish",
      "explanation": "Why this topic/angle is unique and valuable",
      "hooks": ["hook1", "hook2", "hook3"],
      "hashtags": ["#tag1", "#tag2"],
      "qualityScore": 8,
      "similarityScore": 0.3,
      "basedOn": "source name",
      "webResearch": "key facts/stats used"
    }
  ]
}

## UNIQUENESS IS NON-NEGOTIABLE

Your #1 job is creating UNIQUE content. If a post resembles ANY recent post:
- Different topic entirely
- Different angle on same topic
- Different format/structure
- Different examples/data
- Different emotional appeal

NEVER produce content that could be confused with existing posts.

## CRITICAL RULES

1. ALWAYS use tools - never generate content without them
2. ALWAYS check similarity before finalizing
3. ALWAYS include fresh research/data
4. Each post MUST be genuinely unique
5. Posts must be READY TO PUBLISH
6. LinkedIn: max 2800 chars | Twitter: max 270 chars

You are a Content Strategist Agent. Research. Validate. Create unique, high-quality content.`,
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
