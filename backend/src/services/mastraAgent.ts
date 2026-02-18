import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { z } from 'zod';
import { AIService } from './ai';
import { Settings, Idea, SavedTrend, Post, CaseStudy } from '../db';
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
        console.log('[generatePostTool] ⚠️ GENERATING POST WITH PROMPT:', prompt?.substring(0, 200));
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
    description: 'Retrieves previously saved trending topics from the database. Results are RANDOMIZED to encourage variety. Use this to find inspiration from current trends relevant to the business.',
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
        })),
        selectionHint: z.string().describe('Hint for which trend to prioritize')
    }),
    execute: async (inputData) => {
        const { tenantId, limit } = inputData;
        const trends = await SavedTrend.findAll({
            where: { tenantId },
            order: [['fetchedAt', 'DESC']],
            limit: (limit || 10) * 2 // Fetch more to allow shuffling
        });

        console.log('[getSavedTrendsTool] Found', trends.length, 'trends. Topics:', trends.map(t => t.topic).join(', '));

        // Shuffle array to randomize order (Fisher-Yates)
        const shuffled = [...trends];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = shuffled[i]!;
            shuffled[i] = shuffled[j]!;
            shuffled[j] = temp;
        }

        // Take the requested limit after shuffling
        const selected = shuffled.slice(0, limit || 10);

        // Pick a random trend to suggest
        const suggestedIndex = Math.floor(Math.random() * Math.min(3, selected.length));
        const suggestedTrend = selected[suggestedIndex]?.topic || 'any available trend';

        console.log('[getSavedTrendsTool] Suggesting:', suggestedTrend);

        return {
            trends: selected.map(t => ({
                id: t.id,
                topic: t.topic,
                description: t.description,
                relevance: t.relevance,
                suggestedAngles: JSON.parse(t.suggestedAngles || '[]'),
                trendType: t.trendType,
                industry: t.industry,
                fetchedAt: t.fetchedAt.toISOString()
            })),
            selectionHint: `RECOMMENDED: Consider using "${suggestedTrend}" for variety. Avoid topics you've recently covered.`
        };
    }
});

/**
 * Tool: Get saved content ideas from database
 */
export const getSavedIdeasTool = createTool({
    id: 'get-saved-ideas',
    description: 'Retrieves saved content ideas from the idea board. Results are RANDOMIZED to encourage variety. Use this to find pre-planned content topics to develop into posts.',
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
        })),
        selectionHint: z.string().describe('Hint for which idea to prioritize')
    }),
    execute: async (inputData) => {
        const { tenantId, status, limit } = inputData;
        const ideas = await Idea.findAll({
            where: { tenantId, status: status || 'NEW' },
            order: [['createdAt', 'DESC']],
            limit: (limit || 10) * 2 // Fetch more to allow shuffling
        });

        // Shuffle array to randomize order (Fisher-Yates)
        const shuffled = [...ideas];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = shuffled[i]!;
            shuffled[i] = shuffled[j]!;
            shuffled[j] = temp;
        }

        // Take the requested limit after shuffling
        const selected = shuffled.slice(0, limit || 10);

        // Pick a random idea to suggest
        const suggestedIndex = Math.floor(Math.random() * Math.min(3, selected.length));
        const suggestedIdea = selected[suggestedIndex]?.title || 'any available idea';

        return {
            ideas: selected.map(i => ({
                id: i.id,
                title: i.title,
                description: i.description,
                tags: JSON.parse(i.tags || '[]'),
                status: i.status,
                postShape: i.postShape,
                effortLevel: i.effortLevel,
                keyTakeaway: i.keyTakeaway
            })),
            selectionHint: `RECOMMENDED: Consider developing "${suggestedIdea}" for variety. Pick something you haven't posted about recently.`
        };
    }
});

/**
 * Tool: Get saved case studies
 */
export const getCaseStudiesTool = createTool({
    id: 'get-case-studies',
    description: 'Retrieves saved case studies (client success stories). Use these to create posts showcasing real results and testimonials.',
    inputSchema: z.object({
        tenantId: z.string().describe('The tenant ID for the user'),
        status: z.enum(['draft', 'published', 'archived']).optional().default('published').describe('Filter by case study status'),
        industry: z.string().optional().describe('Filter by industry'),
        limit: z.number().optional().default(10).describe('Maximum number of case studies to return')
    }),
    outputSchema: z.object({
        caseStudies: z.array(z.object({
            id: z.number(),
            title: z.string(),
            clientName: z.string(),
            industry: z.string().nullable(),
            challenge: z.string(),
            solution: z.string(),
            results: z.string(),
            testimonial: z.string().nullable(),
            tags: z.array(z.string())
        }))
    }),
    execute: async (inputData) => {
        const { tenantId, status, industry, limit } = inputData;
        const where: any = { tenantId };
        if (status) where.status = status;
        if (industry) where.industry = industry;

        const caseStudies = await CaseStudy.findAll({
            where,
            order: [['createdAt', 'DESC']],
            limit: limit || 10
        });
        return {
            caseStudies: caseStudies.map(cs => ({
                id: cs.id,
                title: cs.title,
                clientName: cs.clientName,
                industry: cs.industry,
                challenge: cs.challenge,
                solution: cs.solution,
                results: cs.results,
                testimonial: cs.testimonial,
                tags: JSON.parse(cs.tags || '[]')
            }))
        };
    }
});

/**
 * Tool: Generate post from a case study
 */
export const generateFromCaseStudyTool = createTool({
    id: 'generate-from-case-study',
    description: 'Generates a compelling social media post from a saved case study. Use this to turn client success stories into engaging content.',
    inputSchema: z.object({
        tenantId: z.string().describe('The tenant ID for the user'),
        caseStudyId: z.number().describe('The ID of the case study to generate from'),
        platform: z.enum(['LINKEDIN', 'TWITTER', 'X']).optional().default('LINKEDIN').describe('Target platform'),
        angle: z.enum(['results-focused', 'testimonial-led', 'challenge-solution', 'industry-insight', 'lessons-learned']).optional().default('results-focused').describe('The angle to take for the post'),
        additionalContext: z.string().optional().describe('Additional instructions or context')
    }),
    outputSchema: z.object({
        content: z.string().describe('The generated post content'),
        summary: z.string().describe('A brief summary of the post')
    }),
    execute: async (inputData) => {
        const { tenantId, caseStudyId, platform, angle, additionalContext } = inputData;

        const caseStudy = await CaseStudy.findOne({ where: { id: caseStudyId, tenantId } });
        if (!caseStudy) {
            throw new Error(`Case study with ID ${caseStudyId} not found`);
        }

        // Build a rich prompt from the case study
        let angleInstructions = '';
        switch (angle) {
            case 'results-focused':
                angleInstructions = 'Focus on the impressive results and metrics achieved. Lead with the outcomes.';
                break;
            case 'testimonial-led':
                angleInstructions = 'Lead with the client testimonial (if available) and build the story around their words.';
                break;
            case 'challenge-solution':
                angleInstructions = 'Structure as a problem-solution narrative. Start with the challenge, then reveal the solution.';
                break;
            case 'industry-insight':
                angleInstructions = 'Position this as an industry insight or trend, using the case study as proof.';
                break;
            case 'lessons-learned':
                angleInstructions = 'Extract key lessons or takeaways that the audience can apply to their own situation.';
                break;
        }

        const prompt = `Create a ${platform} post based on this client case study:

CLIENT: ${caseStudy.clientName}${caseStudy.industry ? ` (${caseStudy.industry} industry)` : ''}

CHALLENGE: ${caseStudy.challenge}

SOLUTION: ${caseStudy.solution}

RESULTS: ${caseStudy.results}

${caseStudy.testimonial ? `CLIENT TESTIMONIAL: "${caseStudy.testimonial}"` : ''}

ANGLE: ${angleInstructions}

${additionalContext ? `ADDITIONAL INSTRUCTIONS: ${additionalContext}` : ''}

Create a compelling post that showcases this success story while being authentic and not overly promotional.`;

        const result = await AIService.generate(
            tenantId!,
            prompt,
            undefined, // targetAudience
            [], // previousSummaries
            undefined, // additionalContext (already in prompt)
            undefined, // authorUrn
            'Story / anecdote', // postShape - case studies are naturally stories
            undefined, // effortLevel
            undefined, // keyTakeaway
            undefined, // antiGoals
            undefined, // manualToneOverride
            platform
        );

        return {
            content: result.content,
            summary: `Case study post for ${caseStudy.clientName}: ${result.summary}`
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

        const settings = await Settings.findOne({ where: { tenantId } });
        if (!settings?.openRouterApiKey) {
            throw new Error('OpenRouter API Key not configured');
        }

        try {
            // Use Tavily if configured for fresher, more accurate results
            if (settings.tavilyApiKey) {
                console.log(`[webSearchTool] Using Tavily for query: "${query}"`);
                const tavilyResponse = await axios.post(
                    'https://api.tavily.com/search',
                    {
                        query,
                        topic: purpose === 'recent-news' ? 'news' : 'general',
                        time_range: purpose === 'recent-news' ? 'day' : 'week',
                        max_results: 5,
                        search_depth: 'basic',
                        include_answer: true,
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${settings.tavilyApiKey}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );

                const tavilyResults = tavilyResponse.data.results || [];
                return {
                    results: tavilyResults.map((r: any) => ({
                        title: r.title || '',
                        snippet: r.content || '',
                        url: r.url || ''
                    })),
                    summary: tavilyResponse.data.answer || tavilyResults.map((r: any) => r.content).join(' ').substring(0, 500)
                };
            }

            // Fallback: Use OpenRouter with web search plugin
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

/**
 * Tool: Self-critique for AI patterns, jargon, and authenticity
 */
export const selfCritiqueTool = createTool({
    id: 'self-critique',
    description: 'CRITICAL: Use this AFTER generate-post to detect AI-sounding phrases, remove corporate jargon, ensure authenticity, and verify factual correctness. This is the final quality gate before returning content.',
    inputSchema: z.object({
        tenantId: z.string().describe('The tenant ID'),
        content: z.string().describe('The post content to critique'),
        claimedFacts: z.array(z.string()).optional().describe('Any specific facts/stats claimed in the post'),
        companyTone: z.string().optional().describe('The company\'s tone/voice'),
        platform: z.enum(['LINKEDIN', 'TWITTER', 'X']).optional().default('LINKEDIN')
    }),
    outputSchema: z.object({
        passesCheck: z.boolean().describe('Whether the content passes all checks'),
        aiPhrases: z.array(z.object({
            phrase: z.string(),
            replacement: z.string(),
            reason: z.string()
        })).describe('AI-sounding phrases detected with replacements'),
        jargonFound: z.array(z.object({
            term: z.string(),
            replacement: z.string()
        })).describe('Corporate jargon to replace'),
        authenticityScore: z.number().describe('How authentic/human the content sounds (1-10)'),
        authenticityIssues: z.array(z.string()).describe('Specific authenticity concerns'),
        factualIssues: z.array(z.object({
            claim: z.string(),
            issue: z.string(),
            suggestion: z.string()
        })).describe('Potential factual accuracy issues'),
        revisedContent: z.string().describe('The content with all issues fixed'),
        changesApplied: z.array(z.string()).describe('Summary of changes made')
    }),
    execute: async (inputData) => {
        const { tenantId, content, claimedFacts, companyTone, platform } = inputData;

        const config = await Settings.findOne({ where: { tenantId } });
        if (!config?.openRouterApiKey) {
            throw new Error('OpenRouter API Key not configured');
        }

        // Common AI phrases to detect
        const commonAIPatterns = [
            "In today's fast-paced",
            "In the ever-evolving",
            "Let's dive in",
            "Let's break it down",
            "Here's the thing",
            "Here's why",
            "Buckle up",
            "Game-changer",
            "At the end of the day",
            "It's not just about",
            "The reality is",
            "Think about it",
            "I'm excited to share",
            "I'm thrilled",
            "Delve into",
            "Leverage",
            "Synergy",
            "Circle back",
            "Move the needle",
            "Low-hanging fruit",
            "Best-in-class",
            "World-class",
            "Cutting-edge",
            "Revolutionary",
            "Transformative",
            "Seamless",
            "Robust",
            "Holistic",
            "Paradigm shift",
            "Disruptive",
            "Innovative solution",
            "Value proposition",
            "Scalable",
            "Ecosystem"
        ];

        const axios = (await import('axios')).default;
        const critiquePrompt = `You are a ruthless editor who HATES AI-generated content and corporate jargon.

Analyze this ${platform} post and rewrite it to sound like a REAL HUMAN wrote it.

ORIGINAL POST:
${content}

${companyTone ? `COMPANY TONE/VOICE: ${companyTone}` : ''}
${claimedFacts?.length ? `FACTS CLAIMED: ${claimedFacts.join(', ')}` : ''}

KNOWN AI PATTERNS TO REMOVE:
${commonAIPatterns.join(', ')}

YOUR TASK:
1. Find ALL AI-sounding phrases and suggest natural replacements
2. Find ALL corporate jargon and suggest plain-language alternatives
3. Rate authenticity 1-10 (10 = sounds like a real person with opinions)
4. Flag any claims that seem unverified or exaggerated
5. Rewrite the ENTIRE post to be more authentic, direct, and human

IMPORTANT:
- Real people have opinions, they don't just "share insights"
- Real people use casual language, contractions, sometimes incomplete sentences
- Real people tell stories, not "learnings"
- Remove ALL throat-clearing ("I want to share", "Let me tell you")
- Start strong, not with generic openers

Return ONLY this JSON:
{
  "passesCheck": <true if content is already authentic, false if needs changes>,
  "aiPhrases": [{"phrase": "detected phrase", "replacement": "better version", "reason": "why it sounds AI"}],
  "jargonFound": [{"term": "jargon term", "replacement": "plain english"}],
  "authenticityScore": <1-10>,
  "authenticityIssues": ["issue 1", "issue 2"],
  "factualIssues": [{"claim": "the claim", "issue": "what's wrong", "suggestion": "how to fix"}],
  "revisedContent": "THE COMPLETE REWRITTEN POST - must be ready to publish",
  "changesApplied": ["change 1", "change 2"]
}`;

        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: config.openRouterModelId || 'anthropic/claude-sonnet-4',
                messages: [
                    { role: 'system', content: 'You are a brutal content editor. You hate AI-generated slop. Return only valid JSON.' },
                    { role: 'user', content: critiquePrompt }
                ],
                temperature: 0.4
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
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const result = JSON.parse(jsonMatch[0]);
                // Ensure revisedContent exists
                if (!result.revisedContent) {
                    result.revisedContent = content;
                }
                return result;
            }
        } catch (e) {
            console.error('Failed to parse self-critique:', e);
        }

        // Default response if parsing fails
        return {
            passesCheck: true,
            aiPhrases: [],
            jargonFound: [],
            authenticityScore: 7,
            authenticityIssues: [],
            factualIssues: [],
            revisedContent: content,
            changesApplied: []
        };
    }
});

/**
 * Tool: Create a content plan before execution
 */
export const createPlanTool = createTool({
    id: 'create-plan',
    description: 'FIRST STEP: Create a strategic plan before generating any content. This helps ensure the post is unique, valuable, and aligned with the content strategy.',
    inputSchema: z.object({
        tenantId: z.string().describe('The tenant ID'),
        topic: z.string().describe('The topic or context for the post'),
        contentPillars: z.array(z.string()).optional().describe('Available content pillars'),
        recentPostTopics: z.array(z.string()).optional().describe('Topics of recent posts to avoid'),
        targetAudience: z.string().optional().describe('The target audience'),
        platform: z.enum(['LINKEDIN', 'TWITTER', 'X']).optional().default('LINKEDIN')
    }),
    outputSchema: z.object({
        selectedPillar: z.string().describe('The content pillar this aligns with'),
        uniqueAngle: z.string().describe('What makes this take unique/different'),
        targetEmotion: z.string().describe('What emotion should the reader feel'),
        keyMessage: z.string().describe('The ONE key takeaway'),
        intendedFormat: z.string().describe('Post format (story, list, hot take, etc.)'),
        openingStrategy: z.string().describe('How to hook the reader'),
        proofPoints: z.array(z.string()).describe('Evidence/examples to include'),
        callToAction: z.string().describe('What action readers should take'),
        differentiators: z.array(z.string()).describe('How this differs from recent posts'),
        riskFactors: z.array(z.string()).describe('Potential issues to watch for')
    }),
    execute: async (inputData) => {
        const { tenantId, topic, contentPillars, recentPostTopics, targetAudience, platform } = inputData;

        const config = await Settings.findOne({ where: { tenantId } });
        if (!config?.openRouterApiKey) {
            throw new Error('OpenRouter API Key not configured');
        }

        const axios = (await import('axios')).default;
        const planPrompt = `Create a strategic content plan for a ${platform} post.

TOPIC/CONTEXT: ${topic}

${contentPillars?.length ? `CONTENT PILLARS: ${contentPillars.join(', ')}` : ''}
${recentPostTopics?.length ? `RECENT POSTS (avoid similar topics): ${recentPostTopics.join(', ')}` : ''}
${targetAudience ? `TARGET AUDIENCE: ${targetAudience}` : ''}

Create a plan that ensures:
1. The post has a UNIQUE angle (not generic advice)
2. It aligns with a content pillar
3. It's different from recent posts
4. It has a strong emotional hook
5. It provides real value

Return ONLY this JSON:
{
  "selectedPillar": "which pillar this aligns with",
  "uniqueAngle": "what makes this take fresh/different - be specific",
  "targetEmotion": "curiosity/urgency/relief/surprise/etc",
  "keyMessage": "the ONE thing readers should remember",
  "intendedFormat": "story/list/hot-take/breakdown/question-led/etc",
  "openingStrategy": "specific hook strategy - not generic",
  "proofPoints": ["specific example 1", "stat or fact 2", "personal experience 3"],
  "callToAction": "specific engagement ask",
  "differentiators": ["how it differs from recent post 1", "how it differs from recent post 2"],
  "riskFactors": ["potential issue 1", "potential issue 2"]
}`;

        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: config.openRouterModelId || 'anthropic/claude-sonnet-4',
                messages: [
                    { role: 'system', content: 'You are a content strategist who creates unique, differentiated content plans. Return only valid JSON.' },
                    { role: 'user', content: planPrompt }
                ],
                temperature: 0.6
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
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            console.error('Failed to parse plan:', e);
        }

        // Default plan if parsing fails
        return {
            selectedPillar: contentPillars?.[0] || 'General',
            uniqueAngle: 'Share practical experience',
            targetEmotion: 'curiosity',
            keyMessage: topic,
            intendedFormat: 'breakdown',
            openingStrategy: 'Lead with a surprising insight',
            proofPoints: ['Personal experience', 'Industry observation'],
            callToAction: 'Share your thoughts',
            differentiators: ['Fresh perspective'],
            riskFactors: ['Ensure specificity']
        };
    }
});

/**
 * Tool: Align post with brand voice and previous successful posts
 */
export const alignWithBrandTool = createTool({
    id: 'align-with-brand',
    description: 'Check if a post aligns with the brand voice and matches the style of previously successful posts. Use this in the refinement phase.',
    inputSchema: z.object({
        tenantId: z.string().describe('The tenant ID'),
        content: z.string().describe('The post content to check'),
        platform: z.enum(['LINKEDIN', 'TWITTER', 'X']).optional().default('LINKEDIN')
    }),
    outputSchema: z.object({
        alignsWithBrand: z.boolean().describe('Whether the post aligns with brand voice'),
        brandVoiceScore: z.number().describe('How well it matches brand voice (1-10)'),
        toneMatch: z.string().describe('How the tone compares to brand guidelines'),
        styleConsistency: z.string().describe('How consistent with previous posts'),
        suggestions: z.array(z.string()).describe('Suggestions to better align with brand'),
        topPerformingPatterns: z.array(z.string()).describe('Patterns from top posts that could be applied')
    }),
    execute: async (inputData) => {
        const { tenantId, content, platform } = inputData;

        const config = await Settings.findOne({ where: { tenantId } });
        if (!config?.openRouterApiKey) {
            throw new Error('OpenRouter API Key not configured');
        }

        // Get company settings for brand voice
        const brandTone = config.globalTone || 'professional yet approachable';
        const aiPersona = config.aiPersona || '';

        // Get top performing posts for style reference
        const topPosts = await Post.findAll({
            where: {
                tenantId,
                status: 'PUBLISHED'
            },
            order: [['createdAt', 'DESC']],
            limit: 5,
            attributes: ['content']
        });

        const topPostsText = topPosts.map(p => p.content.substring(0, 300)).join('\n---\n');

        const axios = (await import('axios')).default;
        const alignPrompt = `Analyze if this ${platform} post aligns with the brand voice and style.

NEW POST TO CHECK:
${content}

BRAND VOICE GUIDELINES:
Tone: ${brandTone}
${aiPersona ? `Persona: ${aiPersona}` : ''}

PREVIOUS POSTS (for style reference):
${topPostsText || 'No previous posts'}

Analyze:
1. Does the new post match the established tone?
2. Is it consistent with the style of previous posts?
3. What patterns from successful posts could be applied?

Return ONLY this JSON:
{
  "alignsWithBrand": <true/false>,
  "brandVoiceScore": <1-10>,
  "toneMatch": "description of how tone compares",
  "styleConsistency": "description of style consistency",
  "suggestions": ["suggestion 1", "suggestion 2"],
  "topPerformingPatterns": ["pattern 1 from top posts", "pattern 2"]
}`;

        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: config.openRouterModelId || 'anthropic/claude-sonnet-4',
                messages: [
                    { role: 'system', content: 'You are a brand consistency expert. Return only valid JSON.' },
                    { role: 'user', content: alignPrompt }
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
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            console.error('Failed to parse brand alignment:', e);
        }

        return {
            alignsWithBrand: true,
            brandVoiceScore: 7,
            toneMatch: 'Generally consistent',
            styleConsistency: 'Matches previous style',
            suggestions: [],
            topPerformingPatterns: []
        };
    }
});

// ============================================================================
// All tools collection
// ============================================================================

export const contentCreatorTools = {
    // Planning tools (Phase 1)
    createPlanTool,
    getUserContextTool,
    getSavedTrendsTool,
    getSavedIdeasTool,
    getCaseStudiesTool,
    getRecentPostsTool,
    // Research tools (Phase 1-2)
    webSearchTool,
    // Generation tools (Phase 2 - Execution)
    generatePostTool,
    generateFromIdeaTool,
    generateFromCaseStudyTool,
    improvisePostTool,
    generateHooksTool,
    generateVariationsTool,
    // Evaluation & refinement tools (Phase 3)
    evaluatePostTool,
    checkSimilarityTool,
    alignWithBrandTool,
    // Self-critique tools (Phase 4)
    selfCritiqueTool,
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
        instructions: `You are a GHOSTWRITER for busy professionals. You write in THEIR voice, as if THEY wrote it.

## YOUR IDENTITY

You are NOT an AI assistant sharing insights. You ARE the professional themselves - writing their thoughts, opinions, and experiences. Every post should sound like it came directly from a human expert who has strong opinions and real experience.

## YOUR GOAL

Create a post that meets ALL these criteria:
1. **Authenticity Score ≥ 7** - Sounds like a real human wrote it
2. **Quality Score ≥ 7** - Valuable, well-structured, engaging
3. **Unique** - Different from recent posts (not repetitive)
4. **On-brand** - Matches the professional's voice and style

You have tools to help you achieve this. Use your judgment to decide WHICH tools you need and WHEN.

## AVAILABLE TOOLS (use as needed)

**Understanding Context:**
- \`get-user-context\` - Who are you ghostwriting for? Their company, tone, pillars
- \`get-recent-posts\` - What have they posted? Avoid repetition
- \`get-saved-trends\` - Current trends to potentially write about
- \`get-saved-ideas\` - Pre-saved content ideas
- \`get-case-studies\` - Client success stories to showcase

**Planning & Research:**
- \`create-plan\` - Think through your angle before writing
- \`web-search\` - Find current stats, facts, or fresh angles

**Content Generation:**
- \`generate-post\` - Create the post
- \`generate-from-idea\` - Generate from a saved idea
- \`generate-from-case-study\` - Generate from a case study
- \`improvise-post\` - Refine/improve existing content

**Quality Checks:**
- \`evaluate-post\` - Score quality (aim for ≥ 7)
- \`check-similarity\` - Is it too similar to recent posts?
- \`align-with-brand\` - Does it match their voice?
- \`self-critique\` - Detect AI phrases, jargon, authenticity issues

**Enhancements:**
- \`generate-hooks\` - Alternative opening lines
- \`suggest-hashtags\` - Relevant hashtags

## HOW TO THINK

**Before writing, understand:**
- Who is this person? What do they care about?
- What have they already posted? (Don't repeat)
- What angle would be FRESH and UNIQUE?

**When generating:**
- Would fresh data/stats make this stronger? → web-search
- Is the topic complex? → create-plan first
- Is this based on a trend/idea/case study? → use the appropriate tool

**After generating, verify:**
- Is quality score ≥ 7? If not → improvise and re-check
- Is it too similar to recent posts? If yes → change the angle
- Does it sound like AI wrote it? → self-critique to fix

**Key decision points:**
- If you're unsure about the angle → create-plan
- If claims need backing → web-search
- If first draft scores < 7 → improvise based on feedback
- If authenticity feels off → self-critique

## WHAT MAKES A POST SOUND HUMAN

❌ AI-SOUNDING (the agent should fix these):
- "In today's fast-paced world..."
- "Let me share a valuable insight..."
- "I'm excited to announce..."
- "Leverage", "synergy", "game-changer"
- Perfect grammar, no contractions
- Hedging ("might", "could possibly")
- Generic lists of tips

✅ HUMAN-SOUNDING (what we want):
- "I was wrong about X for years."
- "Most advice about X is backwards."
- "I've made this mistake 3 times."
- Contractions (I'm, don't, can't)
- Strong opinions, not hedging
- Specific stories with details
- ONE clear point, not a listicle

## QUALITY GATES (must pass before returning)

Before returning ANY post, ensure:
1. You understand who you're writing for (called get-user-context)
2. The post is different from recent content
3. Quality score ≥ 7
4. Authenticity score ≥ 7 (use self-critique if unsure)
5. It sounds like the professional wrote it, not an AI

## SELF-CORRECTION

If something isn't working:
- Low quality score → Read the feedback, use improvise-post, re-evaluate
- Too similar to recent posts → Change the angle, not just the words
- Sounds too AI-like → Run self-critique, use the revised version
- Missing context → Call the appropriate tool to get it

You may need multiple iterations. That's fine. Keep refining until quality gates pass.

## OUTPUT FORMAT

Return JSON:
{
  "posts": [
    {
      "content": "The final post (ready to publish)",
      "explanation": "Why this angle works",
      "hooks": ["hook1", "hook2", "hook3"],
      "hashtags": ["#tag1", "#tag2"],
      "qualityScore": 8,
      "authenticityScore": 8,
      "basedOn": "source (trend/idea/topic)",
      "toolsUsedAndWhy": ["tool: reason", ...]
    }
  ]
}

## CONSTRAINTS

- LinkedIn: max 2800 chars
- Twitter/X: max 270 chars
- For TYPE 1 tasks (user provided topic): Write about THAT topic exactly
- For TYPE 2 tasks (select from sources): Pick something DIFFERENT from recent posts`,
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
