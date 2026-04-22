import { Agent } from '@mastra/core/agent';
import { createTool } from '@mastra/core/tools';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { z } from 'zod';
import { AIService } from './ai';
import { Settings, Idea, SavedTrend, Post, CaseStudy, sequelize } from '../db';
import { Op } from 'sequelize';
import axios from 'axios';
import { getMCPManager, MCPServerConfig } from './mcpManager';
import * as cheerio from 'cheerio';

// Helper to create OpenRouter provider with tenant's API key
function createOpenRouterForTenant(apiKey: string) {
    return createOpenRouter({ apiKey });
}

// ============================================================================
// Tool-level quality guardrail
// ============================================================================

const FABRICATION_PATTERNS = [
    /\bI watched a team\b/i,
    /\bA company I (?:know|worked with)\b/i,
    /\bSix months ago\b/i,
    /\bLast (?:week|month|year),? (?:I|we|our)\b/i,
    /\breduced (?:\w+ )?by \d+%/i,
    /\bsaved (?:us |them )?\d+(?:ms|s|%|hours|days)\b/i,
    /\bcut (?:\w+ )?(?:costs?|time|latency) (?:by |from )\d/i,
    /\bI recently (?:saw|watched|noticed|helped)\b/i,
    /\bA (?:senior |lead )?(?:engineer|developer|CTO|founder) (?:I know|told me)\b/i,
];

const AI_CLICHE_OPENERS = [
    /^Your \w+ is (?:a |)(?:ticking|silent|hidden)/i,
    /^Most (?:teams|CTOs|engineers|developers|companies) /i,
    /^Here'?s the thing/i,
    /^Let me explain/i,
    /^The truth is/i,
    /^Nobody talks about/i,
    /^Stop (?:doing |using |building )/i,
];

function checkPostQuality(content: string): string[] {
    const issues: string[] = [];
    const lines = content.split('\n').filter(l => l.trim().length > 0);
    const words = content.split(/\s+/).length;

    // Wall of text: single paragraph, >80 words
    if (lines.length <= 2 && words > 80) {
        issues.push('wall-of-text (no line breaks)');
    }

    // Fabrication patterns
    for (const pattern of FABRICATION_PATTERNS) {
        if (pattern.test(content)) {
            issues.push(`possible fabrication: "${content.match(pattern)?.[0]}"`);
            break; // one is enough to flag
        }
    }

    // AI cliché openers
    const firstLine = lines[0] || '';
    for (const pattern of AI_CLICHE_OPENERS) {
        if (pattern.test(firstLine)) {
            issues.push(`AI cliché opener: "${firstLine.substring(0, 60)}..."`);
            break;
        }
    }

    // Too long without reason
    if (words > 300) {
        issues.push(`too long (${words} words, target is 80-200)`);
    }

    return issues;
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

        // Tool-level quality guardrail: catch obvious issues before editor phase
        const issues = checkPostQuality(result.content);
        if (issues.length > 0) {
            console.warn(`[generatePostTool] Quality guardrail flagged: ${issues.join(', ')}`);
            return {
                content: result.content,
                summary: result.summary + ` [QUALITY WARNING: ${issues.join('; ')}]`
            };
        }

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

        // Tool-level quality guardrail
        const issues = checkPostQuality(result.content);
        if (issues.length > 0) {
            console.warn(`[generateFromIdeaTool] Quality guardrail flagged: ${issues.join(', ')}`);
            return {
                content: result.content,
                summary: result.summary + ` [QUALITY WARNING: ${issues.join('; ')}]`,
                ideaTitle: idea.title
            };
        }

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
 * Tool: Get saved user preferences (Episodic Memory)
 */
export const getUserPreferencesTool = createTool({
    id: 'get-user-preferences',
    description: 'Retrieves explicitly saved rules, formatting preferences, and instructions for the user (e.g., "Do not use emojis", "Always use short sentences"). ALWAYS check these before generating content.',
    inputSchema: z.object({
        tenantId: z.string().describe('The tenant ID for the user')
    }),
    outputSchema: z.object({
        preferences: z.array(z.string()).describe('List of stylistic rules and preferences')
    }),
    execute: async (inputData) => {
        const { tenantId } = inputData;
        const settings = await Settings.findOne({ where: { tenantId } });
        try {
            return {
                preferences: settings?.userPreferences ? JSON.parse(settings.userPreferences) : []
            };
        } catch (e) {
            return { preferences: [] };
        }
    }
});

/**
 * Tool: Save user preference (Episodic Memory)
 */
export const saveUserPreferenceTool = createTool({
    id: 'save-user-preference',
    description: 'Saves a new stylistic rule, preference, or instruction based on user feedback (e.g., if the user says "Stop writing like that", save a rule so you do not do it again).',
    inputSchema: z.object({
        tenantId: z.string().describe('The tenant ID for the user'),
        preference: z.string().describe('The rule or preference to save (e.g., "Never use the word \'synergy\'")')
    }),
    outputSchema: z.object({
        success: z.boolean(),
        preferences: z.array(z.string()).describe('The updated list of preferences')
    }),
    execute: async (inputData) => {
        const { tenantId, preference } = inputData;
        let settings = await Settings.findOne({ where: { tenantId } });

        if (!settings) {
            // Create default settings if they don't exist yet
            settings = await Settings.create({ tenantId, userPreferences: '[]' } as any);
        }

        let preferences: string[] = [];
        try {
            preferences = settings.userPreferences ? JSON.parse(settings.userPreferences) : [];
        } catch (e) {
            preferences = [];
        }

        // Avoid exact duplicates
        if (!preferences.includes(preference)) {
            preferences.push(preference);
            settings.userPreferences = JSON.stringify(preferences);
            await settings.save();
        }

        return { success: true, preferences };
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
        const draftWords: Set<string> = new Set((draftContent as string).toLowerCase().split(/\s+/).filter((w: string) => w.length > 3));
        let maxSimilarity = 0;
        let mostSimilar = '';

        for (const post of recentPosts) {
            const postWords: Set<string> = new Set(post.content.toLowerCase().split(/\s+/).filter(w => w.length > 3));
            const intersection = new Set(Array.from(draftWords).filter(w => postWords.has(w)));
            const union: Set<string> = new Set([...draftWords, ...postWords]);
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

/**
 * Tool: Read Webpage Content (Deep URL Analysis)
 */
export const readWebpageContentTool = createTool({
    id: 'read-webpage-content',
    description: 'Fetches and reads the full text content of a specific URL. Use this when the user provides a link to an article, documentation, or blog post and wants you to analyze or generate content based on it.',
    inputSchema: z.object({
        url: z.string().url().describe('The full URL to read')
    }),
    outputSchema: z.object({
        title: z.string().describe('The title of the webpage'),
        content: z.string().describe('The main text content extracted from the webpage'),
        error: z.string().optional().describe('Any error encountered during fetching')
    }),
    execute: async (inputData) => {
        const { url } = inputData;
        try {
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                },
                timeout: 10000 // 10 seconds timeout
            });

            const html = response.data;
            const $ = cheerio.load(html);

            // Remove unwanted elements
            $('script, style, noscript, nav, footer, header, aside, .footer, .header, .nav, .sidebar, iframe').remove();

            const title = $('title').text().trim() || 'No Title Found';

            // Try to find the main content article or fall back to body
            let mainContent = $('article, main, .content, .post-content, .article-content').text();
            if (!mainContent || mainContent.trim().length < 200) {
                mainContent = $('body').text();
            }

            // Clean up whitespace
            const cleanContent = mainContent
                .replace(/\s+/g, ' ')
                .replace(/\n+/g, '\n')
                .trim();

            // Truncate to avoid blowing up the context window (~25k chars is a safe limit)
            const MAX_CHARS = 25000;
            const truncatedContent = cleanContent.length > MAX_CHARS
                ? cleanContent.substring(0, MAX_CHARS) + '\n\n[CONTENT TRUNCATED DUE TO LENGTH]'
                : cleanContent;

            return {
                title,
                content: truncatedContent
            };
        } catch (error: any) {
            console.error(`[readWebpageContentTool] Error fetching ${url}:`, error.message);
            return {
                title: 'Error reading URL',
                content: '',
                error: `Failed to read webpage: ${error.message}`
            };
        }
    }
});

/**
 * Tool: Search LLM Wiki knowledge base
 */
export const searchWikiTool = createTool({
    id: 'search-wiki',
    description: 'Search the LLM Wiki knowledge base for accumulated insights from previously ingested sources (articles, RSS feeds, case studies). The wiki contains processed, organized knowledge. Check this BEFORE web search for topics the user has researched before.',
    inputSchema: z.object({
        tenantId: z.string().describe('The tenant ID'),
        query: z.string().describe('Search query — keywords or topic to find in wiki')
    }),
    outputSchema: z.object({
        results: z.array(z.object({
            slug: z.string(),
            title: z.string(),
            excerpt: z.string(),
            relevanceScore: z.number()
        })),
        totalPages: z.number()
    }),
    execute: async (inputData) => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { WikiService } = require('./wiki');
        const { tenantId, query } = inputData;
        return WikiService.queryWiki(tenantId!, query!);
    }
});

// ============================================================================
// All tools collection
// ============================================================================

export const researcherTools = {
    'get-user-context': getUserContextTool,
    'get-user-preferences': getUserPreferencesTool,
    'get-recent-posts': getRecentPostsTool,
    'get-saved-trends': getSavedTrendsTool,
    'get-saved-ideas': getSavedIdeasTool,
    'get-case-studies': getCaseStudiesTool,
    'search-wiki': searchWikiTool,
    'web-search': webSearchTool,
    'read-webpage-content': readWebpageContentTool
};

export const writerTools = {
    'generate-post': generatePostTool,
    'generate-from-idea': generateFromIdeaTool,
    'generate-from-case-study': generateFromCaseStudyTool,
    'generate-hooks': generateHooksTool,
};

export const editorTools = {
    'check-similarity': checkSimilarityTool,
    'improvise-post': improvisePostTool,
    'suggest-hashtags': suggestHashtagsTool,
    'save-user-preference': saveUserPreferenceTool
};

// ============================================================================
// Specialized Sub-Agents
// ============================================================================

export function createResearcherAgent(
    apiKey: string,
    modelId: string = 'anthropic/claude-sonnet-4',
    mcpTools: Record<string, ReturnType<typeof createTool>> = {}
) {
    const openrouter = createOpenRouterForTenant(apiKey);
    const mcpToolNames = Object.keys(mcpTools);
    const mcpInstructions = mcpToolNames.length > 0
        ? `\n\n## EXTERNAL DATA SOURCES (MCP)\n\nYou have access to ${mcpToolNames.length} external tool(s). Available MCP tools: ${mcpToolNames.join(', ')}\n`
        : '';

    return new Agent({
        id: 'researcher-agent',
        name: 'Research Agent',
        description: 'Gathers factual information, user context, preferences, past posts, trends, ideas, case studies, and web research. Returns a detailed markdown summary of all findings.',
        instructions: `You are the Lead Researcher for a Ghostwriting agency. Your job is to gather and synthesize context.

## YOUR GOAL
Gather all necessary facts, user preferences, past posts, and external data so the Strategy team can formulate a plan.
Always call get-user-context and get-user-preferences first to understand who you are working for.

## AVAILABLE TOOLS
- \`get-user-context\` - Who are you ghostwriting for?
- \`get-user-preferences\` - Have they given specific stylistic instructions?
- \`get-recent-posts\` - What have they posted? Avoid repetition.
- \`get-saved-trends\` - Current trends to potentially write about.
- \`get-saved-ideas\` - Pre-saved content ideas.
- \`get-case-studies\` - Client success stories to showcase.
- \`search-wiki\` - Search the LLM Wiki for accumulated knowledge. Check this BEFORE web search.
- \`web-search\` - Find current stats, facts, or fresh angles.
- \`read-webpage-content\` - Extract article content from a specific URL.

Return a detailed markdown summary of all your findings so the next agent can use it.` + mcpInstructions,
        model: openrouter(modelId),
        tools: { ...researcherTools, ...mcpTools }
    });
}

export function createWriterAgent(
    apiKey: string,
    modelId: string = 'anthropic/claude-sonnet-4',
    topPostsContext: string = ''
) {
    const openrouter = createOpenRouterForTenant(apiKey);
    const voiceExamples = topPostsContext ? `\n\n## EXAMPLES OF MY VOICE\n\nHere are some of my best-performing past posts. You MUST analyze these examples for cadence, sentence length, hook structure, and formatting, and proactively replicate my style in your generated draft.\n\n${topPostsContext}\n` : '';

    return new Agent({
        id: 'writer-agent',
        name: 'Writer Agent',
        description: 'Ghostwriter that creates social media posts in the user\'s authentic voice. Generates posts from topics, ideas, or case studies. Returns raw post text ready for editing.',
        instructions: `You are a GHOSTWRITER. You write posts that sound like a real engineer/founder typed them between meetings — not a content strategist polishing thought leadership.${voiceExamples}

## YOUR GOAL
Write a draft that feels like it came from the person's actual keyboard. The bar is: would a colleague read this and think "yeah, that sounds like them" — or would they think "their marketing team wrote this"?

## VOICE PRINCIPLES
- Write like you talk. Short sentences. Fragments are fine. Contractions always.
- Be specific, not generic. "We cut our deploy time from 40min to 6min" beats "We significantly improved our deployment pipeline."
- Have a real opinion. "I think Terraform is overengineered for most startups" is interesting. "Infrastructure as Code has many benefits" is not.
- Imperfection is authenticity. A slightly rough post that says something real outperforms a polished post that says nothing.
- Don't lecture. Share what you learned, saw, built, or broke. The reader is a peer, not a student.
- NEVER start with "Your [X] is [broken/wrong/a trap]" — that's a LinkedIn cliché.
- NEVER fabricate stories. Don't say "I watched a team..." unless the user provided that story. Stick to the user's actual context.
- Keep it SHORT. 80-200 words. Most great posts are under 150 words.

## AVAILABLE TOOLS
- \`generate-post\` - Create the standard post
- \`generate-from-idea\` - Generate from a saved idea
- \`generate-from-case-study\` - Generate from a case study
- \`generate-hooks\` - Generate alternative opening lines

Return the raw generated post text along with 3 hook alternatives. Do not wrap in JSON.`,
        model: openrouter(modelId),
        tools: writerTools
    });
}

export function createEditorAgent(
    apiKey: string,
    modelId: string = 'anthropic/claude-sonnet-4',
    topPostsContext: string = ''
) {
    const openrouter = createOpenRouterForTenant(apiKey);
    const voiceReference = topPostsContext ? `\n\n## VOICE REFERENCE (THE AUTHOR'S ACTUAL POSTS)\n\nThese are the author's top-performing posts. When you call \`improvise-post\`, the rewrite MUST preserve this voice — the rhythm, sentence structure, directness level, and personality. If the draft sounds nothing like these examples, that's a red flag.\n\n${topPostsContext}\n` : '';

    return new Agent({
        id: 'editor-agent',
        name: 'Editor Agent',
        description: 'Chief Editor that evaluates quality, detects AI patterns, refines drafts, and suggests hashtags. Returns the final polished post in JSON format with quality scores.',
        instructions: `You are the Chief Editor. Your job: make this post sound like a real person wrote it, not an AI content mill.${voiceReference}

## THE "COLLEAGUE TEST"
Read the draft and ask: "If I saw this on LinkedIn from someone I know, would I think THEY wrote it — or would I immediately think 'AI generated'?"

Signs it's AI-generated (REJECT or rewrite if you see these):
- Opens with "Your [X] is [broken/wrong/a trap/a lie]"
- Opens with "Most [teams/CTOs/engineers] [do X wrong]"
- Uses dramatic framing: "silent killer", "ticking time bomb", "gaslighting you"
- Follows the skeleton: provocative claim → "here's why" → bullet list with → arrows → "the real issue" → CTA question
- Every paragraph has bold text or formatting
- Fabricated anecdotes: "I watched a team...", "A company I know..."
- Generic CTAs: "What's your experience with X?", "Agree or disagree?"
- Over 250 words without a compelling reason
- Reads like a blog post summary, not a social post
- Uses "leverage", "paradigm shift", "game-changer", "delve into"
- Starts with filler: "Here's the thing:", "Let me explain:", "The truth is:"

## WHAT GOOD LOOKS LIKE
- Specific and concrete (numbers, tools, real situations)
- Has a point of view, not just information
- Short enough that you'd actually read it while scrolling
- Sounds like one human talking to another
- Doesn't try to be impressive — just tries to be useful or interesting

## TOOLS (use only when needed)
- \`check-similarity\` - Verify uniqueness against recent posts
- \`improvise-post\` - ONLY if the post fails the colleague test
- \`suggest-hashtags\` - Add relevant hashtags
- \`save-user-preference\` - Save rules if user complained about style

## WORKFLOW
1. Apply the colleague test. Score quality (1-10) and authenticity (1-10)
2. If authenticity < 7: call \`improvise-post\` with SPECIFIC feedback about what sounds fake
3. Call \`suggest-hashtags\` and return

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
      "toolsUsedAndWhy": ["tool: reason"]
    }
  ]
}`,
        model: openrouter(modelId),
        tools: editorTools
    });
}

// ============================================================================
// Supervisor Agent
// ============================================================================

export function createSupervisorAgent(
    apiKey: string,
    modelId: string = 'anthropic/claude-sonnet-4',
    subAgents: {
        researcherAgent: Agent;
        writerAgent: Agent;
        editorAgent: Agent;
    }
) {
    const openrouter = createOpenRouterForTenant(apiKey);

    return new Agent({
        id: 'content-supervisor',
        name: 'Content Supervisor',
        description: 'Supervises the content creation pipeline by coordinating Researcher, Writer, and Editor agents. Handles strategy directly.',
        instructions: `You are the Content Director. You coordinate 3 agents to produce posts that sound like a real person wrote them.

## YOUR TEAM
- **researcherAgent**: Gathers user profile, preferences, past posts, trends, ideas, case studies. Delegate here FIRST.
- **writerAgent**: Writes the post in the user's voice. Delegate with your strategy brief.
- **editorAgent**: Quality gate — checks authenticity, polishes. Delegate here LAST.

## YOUR ROLE AS STRATEGIST
After research returns, formulate the strategy. Your brief to the writer MUST include:
- The specific angle (not generic — "how we debugged a memory leak in our Kafka consumer" not "Kafka best practices")
- The post structure to use (vary between: cold-open story, single-thesis essay, observation, contrarian take, short lesson, before-after, question-answer, list of specifics)
- Target length: usually 80-200 words. Short is better. Only go longer for genuine stories.
- What makes this post DIFFERENT from typical LinkedIn content on this topic

## CRITICAL: AVOID MONOTONY
The #1 complaint is that posts feel monotonous and detached. When briefing the writer:
- NEVER brief the same structure twice in a row
- NEVER brief a "provocative claim → bullet list → CTA question" post — that structure is banned
- Prefer posts that share a specific experience, observation, or lesson over posts that lecture or advise
- The reader should feel like they're hearing from a peer, not being talked down to
- Shorter posts (under 150 words) with one sharp insight beat longer posts with many points

## WORKFLOW — YOU MUST COMPLETE ALL 4 STEPS
⚠️ CRITICAL: Do NOT stop after research. You MUST delegate to ALL three agents in sequence.

1. **Research** → Delegate to researcherAgent → get back context data
2. **Strategy** → YOU formulate the angle based on research (no delegation needed)
3. **Write** → Delegate to writerAgent with research context + your strategy brief
4. **Edit** → Delegate to editorAgent with the writer's draft

You are NOT done until the editorAgent returns the final JSON with the posts array. If you only have research data, you have NOT completed your job — keep going.

## EFFICIENCY RULES
- If user provided a specific topic, tell researcherAgent to ONLY fetch user context + recent posts
- Maximum 5 total delegations
- If editor rejects, give writer ONE more try with specific feedback

## OUTPUT
Your FINAL response MUST be the editorAgent's JSON output with the posts array. Pass it through exactly. Do NOT return research summaries or strategy notes as your final output.`,
        model: openrouter(modelId),
        agents: subAgents,
    });
}

// ============================================================================
// Agent Draft Model Types
// ============================================================================

export type ProgressCallback = (event: { stage: string; detail?: string; agentId?: string; duration?: number }) => void;

export interface AgentDraftInput {
    tenantId: string;
    userMessage: string;
    conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
    authorUrn?: string;
    onProgress?: ProgressCallback;
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

    /**
     * Process a user message through the supervisor-orchestrated multi-agent workflow
     */
    async chat(input: AgentDraftInput): Promise<AgentDraftOutput> {
        const { tenantId, userMessage, conversationHistory = [], authorUrn, onProgress } = input;
        const progress = onProgress || (() => {});

        // 1. Setup Models and Top Posts Context
        const settings = await Settings.findOne({ where: { tenantId } });
        if (!settings?.openRouterApiKey) {
            throw new Error('OpenRouter API Key not found. Please configure it in Settings.');
        }
        const modelId = settings.openRouterModelId || 'anthropic/claude-sonnet-4';
        const apiKey = settings.openRouterApiKey;

        const topPosts = await Post.findAll({
            where: { tenantId, status: 'PUBLISHED' },
            order: [[sequelize.literal('likesCount + commentsCount + repostsCount'), 'DESC']],
            limit: 3,
            attributes: ['content']
        });
        const topPostsContext = topPosts.map(p => p.content).join('\n---\n');

        // 2. Select MCP Tools
        let mcpTools: Record<string, ReturnType<typeof createTool>> = {};
        try {
            const mcpServers: MCPServerConfig[] = JSON.parse(settings?.mcpServers || '[]');
            const enabledServers = mcpServers.filter(s => s.enabled);
            if (enabledServers.length > 0) {
                const mcpManager = getMCPManager();
                mcpTools = await mcpManager.getToolsForContext(
                    tenantId, enabledServers, userMessage, apiKey, modelId
                );
            }
        } catch (error: any) {
            console.error(`[MastraAgent] MCP server selection failed:`, error.message);
        }

        // 3. Create sub-agents
        const researcherAgent = createResearcherAgent(apiKey, modelId, mcpTools);
        const writerAgent = createWriterAgent(apiKey, modelId, topPostsContext);
        const editorAgent = createEditorAgent(apiKey, modelId, topPostsContext);

        // 4. Create supervisor (handles strategy directly)
        const supervisor = createSupervisorAgent(apiKey, modelId, {
            researcherAgent,
            writerAgent,
            editorAgent,
        });

        // 5. Build the prompt
        const contextMessage = `[Context: tenantId=${tenantId}${authorUrn ? `, authorUrn=${authorUrn}` : ''}]`;
        const historyText = conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n\n');

        const supervisorPrompt = `${historyText ? historyText + '\n\n' : ''}${contextMessage}\n\n${userMessage}\n\nIMPORTANT: When delegating to any agent, always include the tenantId (${tenantId}) in the context so tools can access the correct data.${authorUrn ? ` AuthorURN: ${authorUrn}` : ''}`;

        console.log('[MastraAgent] ═══════════════════════════════════════════════════');
        console.log('[MastraAgent] Starting Supervisor pipeline for tenant:', tenantId);
        console.log('[MastraAgent] ═══════════════════════════════════════════════════');
        progress({ stage: 'starting', detail: 'Initializing content pipeline' });

        // 6. Run supervisor
        const allToolCalls: any[] = [];
        const allToolResults: any[] = [];
        let stepCount = 0;
        const onStepFinish = (step: any) => {
            stepCount++;
            console.log(`[Supervisor] Step ${stepCount}: toolCalls=${step.toolCalls?.length || 0}, text=${step.text?.substring(0, 200) || '(none)'}`);
            if (step.toolCalls?.length) {
                allToolCalls.push(...step.toolCalls);
                for (const tc of step.toolCalls) {
                    const toolName = (tc as { toolName?: string }).toolName;
                    if (toolName) {
                        console.log(`[Supervisor] Tool call: ${toolName}`);
                        progress({ stage: 'tool', detail: toolName });
                    }
                }
            }
            if (step.toolResults?.length) allToolResults.push(...step.toolResults);
            if (step.finishReason) {
                console.log(`[Supervisor] Step ${stepCount} finishReason: ${step.finishReason}`);
            }
        };

        const result = await supervisor.generate(supervisorPrompt, {
            maxSteps: 25,
            onStepFinish,
            delegation: {
                onDelegationStart: async (context) => {
                    console.log(`[Supervisor] Delegating to ${context.primitiveId} (iteration ${context.iteration})`);
                    const agentLabels: Record<string, string> = {
                        'researcher-agent': 'Researching context and data',
                        'writer-agent': 'Writing the post draft',
                        'editor-agent': 'Editing and quality check',
                    };
                    progress({
                        stage: 'delegating',
                        detail: agentLabels[context.primitiveId] || `Running ${context.primitiveId}`,
                        agentId: context.primitiveId,
                    });

                    if (context.iteration > 12) {
                        return {
                            proceed: false,
                            rejectionReason: 'Maximum iterations reached. Return the best content you have so far in the required JSON format.',
                        };
                    }
                    return { proceed: true };
                },
                onDelegationComplete: async (context) => {
                    if (context.error) {
                        console.error(`[Supervisor] Delegation to ${context.primitiveId} failed:`, context.error);
                        progress({ stage: 'error', detail: `${context.primitiveId} failed`, agentId: context.primitiveId });
                        return {
                            feedback: `Agent ${context.primitiveId} encountered an error: ${context.error}. Try a different approach or skip this step.`,
                        };
                    }
                    console.log(`[Supervisor] ${context.primitiveId} completed successfully (${context.duration}ms)`);
                    progress({
                        stage: 'completed',
                        detail: `${context.primitiveId} done`,
                        agentId: context.primitiveId,
                        duration: context.duration,
                    });
                },
            },
        });

        const finalText = result.text;
        console.log('[MastraAgent] Supervisor completed. Response length:', finalText.length);
        progress({ stage: 'finalizing', detail: 'Preparing results' });

        // 7. Collect tools used
        const toolsUsed = [...new Set(allToolCalls.map(tc => (tc as { toolName?: string }).toolName).filter(Boolean))] as string[];
        console.log('[MastraAgent] Tools used:', toolsUsed);

        // 8. Extract generated content
        let generatedContent = this.extractGeneratedContent(allToolResults);

        // Fallback: Look for JSON in the supervisor's response text
        if (!generatedContent || generatedContent.type !== 'post') {
            try {
                const jsonMatch = finalText.match(/\{[\s\S]*"posts"[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    if (parsed.posts && parsed.posts.length > 0) {
                        generatedContent = { type: 'post', data: parsed.posts[0] };
                    }
                }
            } catch (e) {
                console.warn('[MastraAgent] Failed to parse supervisor JSON', e);
            }
        }

        // Clean the response text for UI display
        let cleanResponse = finalText;
        const jsonMatchForCleaning = cleanResponse.match(/\{\s*"posts"[\s\S]*\}/);
        if (jsonMatchForCleaning && generatedContent) {
            cleanResponse = cleanResponse.replace(jsonMatchForCleaning[0], '').replace(/```json/g, '').replace(/```/g, '').trim();
            if (!cleanResponse) cleanResponse = "Content created through the supervisor pipeline. Check out the draft below.";
        }

        return {
            response: cleanResponse || '',
            toolsUsed,
            generatedContent
        };
    }

    /**
     * Stream a response from the agent (Fallback to Writer agent for speed)
     */
    async *streamChat(input: AgentDraftInput): AsyncGenerator<{ text?: string; toolCall?: string; done?: boolean }> {
        const { tenantId, userMessage, conversationHistory = [], authorUrn } = input;

        const settings = await Settings.findOne({ where: { tenantId } });
        if (!settings?.openRouterApiKey) throw new Error('OpenRouter API Key missing');

        const topPosts = await Post.findAll({
            where: { tenantId, status: 'PUBLISHED' },
            order: [[sequelize.literal('likesCount + commentsCount + repostsCount'), 'DESC']],
            limit: 3,
            attributes: ['content']
        });
        const topPostsContext = topPosts.map(p => p.content).join('\\n---\\n');

        const writer = createWriterAgent(settings.openRouterApiKey, settings.openRouterModelId || 'anthropic/claude-sonnet-4', topPostsContext);

        const contextMessage = `[Context: tenantId=${tenantId}${authorUrn ? `, authorUrn=${authorUrn}` : ''}]`;
        const prompt = [
            ...conversationHistory.map(msg => `${msg.role}: ${msg.content}`),
            `user: ${contextMessage}\n\n${userMessage}\n\n(Write the response directly.)`
        ].join('\n\n');

        const stream = await writer.stream(prompt);
        for await (const chunk of stream.textStream) {
            yield { text: chunk };
        }
        yield { done: true };
    }

    clearCache(tenantId?: string) {
        // Multi-agent pipeline is dynamically instantiated per-request now, no-op.
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
