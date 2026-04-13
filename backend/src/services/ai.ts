import axios from 'axios';
import { Settings, Idea, Post, WeeklyDigest } from '../db';
import fs from 'fs';
import path from 'path';
import { getMCPManager, MCPServerConfig } from './mcpManager';

export interface AIContext {
    apiKey: string | null;
    modelId: string | null;
    aiPersona: string | null;
    toneInstructions?: string;
    maxHistoryItems: number;
}

export class AIService {
    private static async getUnifiedConfig(tenantId: string, authorUrn?: string | null): Promise<AIContext> {
        const settings = await Settings.findOne({ where: { tenantId } });

        let toneInstructions = settings?.globalTone || undefined;
        if (settings?.accountTones && authorUrn) {
            try {
                const accountTones = JSON.parse(settings.accountTones);
                if (accountTones[authorUrn]) {
                    toneInstructions = accountTones[authorUrn];
                }
            } catch (e) {
                console.error('[AIService] Error parsing accountTones:', e);
            }
        }

        return {
            apiKey: settings?.openRouterApiKey || null,
            modelId: settings?.openRouterModelId || null,
            aiPersona: settings?.aiPersona || null,
            toneInstructions,
            maxHistoryItems: settings?.maxHistoryItems ?? 5
        };
    }

    private static async callOpenRouter(config: AIContext, systemPrompt: string, userContent: string, useWebPlugin: boolean = true): Promise<string> {
        if (!config.apiKey) {
            throw new Error('OpenRouter API Key not found. Please configure it in Settings.');
        }

        try {
            const body: any = {
                model: config.modelId || 'anthropic/claude-sonnet-4.5',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userContent }
                ]
            };
            if (useWebPlugin) {
                body.plugins = [{ id: 'web' }];
            }

            const response = await axios.post(
                'https://openrouter.ai/api/v1/chat/completions',
                body,
                {
                    headers: {
                        'Authorization': `Bearer ${config.apiKey}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'http://localhost:3000',
                        'X-Title': 'LinkedIn Post Scheduler',
                    }
                }
            );

            const content = response.data.choices?.[0]?.message?.content;
            if (!content) {
                console.error('[AIService] callOpenRouter: null/empty content from API. Response:', JSON.stringify(response.data.choices?.[0]));
                throw new Error('AI returned empty response');
            }
            return content.trim();
        } catch (error: any) {
            console.error('AI Service Error:', error.response?.data || error.message);
            throw new Error('Failed to generate AI response: ' + (error.response?.data?.error?.message || error.message));
        }
    }

    /**
     * Public entry point for Visual Builder — calls AI without web plugin or MCP tools.
     */
    static async callForVisualBuilder(tenantId: string, systemPrompt: string, userContent: string): Promise<string> {
        const config = await this.getUnifiedConfig(tenantId);
        return this.callOpenRouter(config, systemPrompt, userContent, false);
    }

    /**
     * Fetch voice samples from Settings for a tenant.
     */
    private static async getVoiceSamples(tenantId: string): Promise<string | null> {
        try {
            const settings = await Settings.findOne({ where: { tenantId } });
            return settings?.voiceSamples || null;
        } catch {
            return null;
        }
    }

    /**
     * Self-review and revise: takes a generated draft and runs it through
     * a critique-and-rewrite pass to improve quality, voice, and originality.
     */
    private static async selfReviewAndRevise(
        config: AIContext,
        generatedPost: string,
        voiceSamples: string | null
    ): Promise<string> {
        const reviewPrompt = `You are an editor. Read this draft and ask: "Would a real engineer/founder actually post this, or does it sound like AI content?"

FIX these if present:
- Opens with "Your X is broken/wrong" or "Most teams do X wrong" → rewrite the opener with something specific and concrete
- Follows the template: provocative claim → bullet list → "the real issue" → CTA question → hashtags → BREAK this structure
- Too long (over 200 words) without a compelling story → CUT aggressively
- Fabricated anecdotes ("I watched a team...") → remove or replace with the user's actual context
- Generic advice anyone could give → sharpen to something only someone with real experience would say
- Over-formatted (bold + bullets + arrows everywhere) → simplify, use plain paragraphs
- Dramatic framing ("silent killer", "ticking time bomb") → tone it down to normal human language
- Generic CTA ("What's your experience?") → either cut or replace with something specific
${voiceSamples ? `
**THE AUTHOR'S ACTUAL VOICE — match this:**
${voiceSamples}
` : ''}
${config.toneInstructions ? `**TONE:** ${config.toneInstructions}\n` : ''}
RULES:
- Preserve core facts, URLs, and hashtags
- Make it SHORTER, not longer
- The bar: would you scroll past this or actually read it?

Return ONLY the revised post. No explanations.`;

        console.log('[AIService] Running self-review pass on generated post');
        return this.callOpenRouter(config, reviewPrompt, `Draft to revise:\n\n${generatedPost}`, false);
    }

    /**
     * Get MCP server configs for a tenant.
     */
    private static async getMCPServers(tenantId: string): Promise<MCPServerConfig[]> {
        try {
            const settings = await Settings.findOne({ where: { tenantId } });
            const servers: MCPServerConfig[] = JSON.parse(settings?.mcpServers || '[]');
            return servers.filter(s => s.enabled);
        } catch {
            return [];
        }
    }

    /**
     * Calls OpenRouter with MCP tool support. If MCP tools are available,
     * runs a tool-calling loop. Otherwise falls back to regular callOpenRouter.
     * Uses context-aware server selection to only connect relevant MCPs.
     */
    private static async callOpenRouterWithTools(
        config: AIContext,
        systemPrompt: string,
        userContent: string,
        tenantId: string,
        maxIterations: number = 5
    ): Promise<string> {
        const mcpServers = await this.getMCPServers(tenantId);
        if (mcpServers.length === 0 || !config.apiKey) {
            return this.callOpenRouter(config, systemPrompt, userContent);
        }

        const mcpManager = getMCPManager();
        const modelId = config.modelId || 'anthropic/claude-sonnet-4';
        const { tools: toolDefs, cacheKey } = await mcpManager.getToolDefinitionsForContext(
            tenantId, mcpServers, userContent, config.apiKey, modelId
        );
        if (toolDefs.length === 0) {
            return this.callOpenRouter(config, systemPrompt, userContent);
        }

        if (!config.apiKey) {
            throw new Error('OpenRouter API Key not found. Please configure it in Settings.');
        }

        const messages: any[] = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
        ];

        for (let i = 0; i < maxIterations; i++) {
            const response = await axios.post(
                'https://openrouter.ai/api/v1/chat/completions',
                {
                    model: config.modelId || 'anthropic/claude-sonnet-4',
                    messages,
                    tools: toolDefs,
                },
                {
                    headers: {
                        'Authorization': `Bearer ${config.apiKey}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'http://localhost:3000',
                        'X-Title': 'LinkedIn Post Scheduler',
                    },
                }
            );

            const message = response.data.choices[0].message;

            // If no tool calls, return the text
            if (!message.tool_calls || message.tool_calls.length === 0) {
                const text = message.content?.trim() || '';
                if (!text) {
                    console.warn('[AIService] callOpenRouterWithTools: AI returned empty content (no tool calls). Full response:', JSON.stringify(response.data.choices[0]));
                }
                return text;
            }

            // Execute tool calls and add results
            messages.push(message);
            for (const toolCall of message.tool_calls) {
                try {
                    const args = JSON.parse(toolCall.function.arguments);
                    const result = await mcpManager.executeToolCall(cacheKey, toolCall.function.name, args);
                    messages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: typeof result === 'string' ? result : JSON.stringify(result),
                    });
                } catch (error: any) {
                    console.error(`[AIService] MCP tool call failed (${toolCall.function.name}):`, error.message);
                    messages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        content: `Error: ${error.message}`,
                    });
                }
            }
        }

        // Max iterations reached, return last assistant message
        const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
        return lastAssistant?.content?.trim() || '';
    }

    private static async getTopPerformingPosts(tenantId: string, authorUrn?: string | null, limit: number = 3): Promise<string[]> {
        try {
            const where: any = { tenantId, status: 'PUBLISHED' };
            if (authorUrn) {
                where.authorUrn = authorUrn;
            }

            const posts = await Post.findAll({
                where,
                order: [['likesCount', 'DESC']],
            });

            // Sort by engagement score: likes + comments*3 + reposts*2
            const scored = posts.map(p => ({
                content: p.content,
                score: (p.likesCount || 0) + (p.commentsCount || 0) * 3 + (p.repostsCount || 0) * 2,
            }));
            scored.sort((a, b) => b.score - a.score);

            return scored
                .filter(p => p.score > 0)
                .slice(0, limit)
                .map(p => p.content);
        } catch (e: any) {
            console.error('[AIService] Failed to fetch top posts:', e.message);
            return [];
        }
    }

    static async improvise(tenantId: string, content: string, authorUrn?: string, targetAudience?: string, manualToneOverride?: string, direction?: string, platform?: string): Promise<string> {
        const config = await this.getUnifiedConfig(tenantId, authorUrn);

        let SYSTEM_PROMPT = config.aiPersona || `You are an expert LinkedIn content editor specializing in software development, cloud technologies, and AI content.`;
        SYSTEM_PROMPT += `\n\nYour task is to refine and enhance an existing LinkedIn post draft while preserving the author's core message and voice. If first line has the exact instructions from the author, then follow them.\n`;

        if (direction) {
            SYSTEM_PROMPT = `PRIORITY INSTRUCTION: The user wants you to specifically: ${direction}. Focus on this above all other refinement guidelines.\n\n` + SYSTEM_PROMPT;
        }

        if (platform) {
            const platformUpper = platform.toUpperCase();
            if (platformUpper === 'TWITTER' || platformUpper === 'X') {
                SYSTEM_PROMPT += `\n**PLATFORM CHARACTER LIMIT:** This is a Twitter/X post. MAXIMUM 270 characters (hard limit, leave room for hashtags). This overrides all other length guidelines.\n`;
            } else {
                SYSTEM_PROMPT += `\n**PLATFORM CHARACTER LIMIT:** This is a LinkedIn post. MAXIMUM 2800 characters (hard limit).\n`;
            }
        }

        // Inject top-performing posts as style reference (STYLE ONLY)
        const topPosts = await this.getTopPerformingPosts(tenantId, authorUrn);
        if (topPosts.length > 0) {
            SYSTEM_PROMPT += `\n**STYLE REFERENCE (DO NOT COPY TOPICS):**
Study the WRITING STYLE only (tone, structure, hooks) - DO NOT copy their topics or subject matter.\n`;
            topPosts.forEach((post, i) => {
                SYSTEM_PROMPT += `[Style Example ${i + 1}]: ${post}\n`;
            });
        }

        // Voice samples — author's actual writing for style matching
        const voiceSamples = await this.getVoiceSamples(tenantId);
        if (voiceSamples) {
            SYSTEM_PROMPT += `\n**VOICE SAMPLES — THE AUTHOR'S ACTUAL WRITING:**
Match this voice — the rhythm, personality, and directness. This overrides generic style guidelines.
${voiceSamples}\n`;
        }

        if (targetAudience) {
            SYSTEM_PROMPT += `\n**Post Audience:** ${targetAudience}\nEnsure the tone, complexity, and value proposition resonate specifically with this audience.\n`;
        }

        const effectiveTone = manualToneOverride || config.toneInstructions;
        if (effectiveTone) {
            SYSTEM_PROMPT += `\n**Tone & Writing Style Instructions:**\n${effectiveTone}\nYou MUST strictly follow these specific style guidelines.\n`;
        }

        SYSTEM_PROMPT += `
**Refinement goals:**
- Make it sound more human and less like AI content
- Cut unnecessary words — shorter is better
- If it follows the "provocative claim → bullet list → CTA question" template, restructure it
- Remove dramatic framing ("silent killer", "ticking time bomb") — use normal language
- Remove fabricated anecdotes unless they came from the user's actual input
- Keep the core message, specific examples, and metrics

${effectiveTone ? `**TONE (STRICTLY FOLLOW):**\n${effectiveTone}` : `Write like a smart colleague sharing something interesting — not a thought leader broadcasting wisdom.`}

${(effectiveTone?.toLowerCase().includes('use "we"') || effectiveTone?.toLowerCase().includes('collective reference') || effectiveTone?.toLowerCase().includes('instead of "i"'))
                ? '**CRITICAL:** Use "We" instead of "I" throughout.'
                : ''}

**Do NOT:**
- Change the fundamental message
- Add information not in the original
- Make it longer

Return ONLY the refined post. No explanations.
`;

        console.log(`[AIService] Improving LinkedIn post:\n\n${content}`);

        return this.callOpenRouterWithTools(config, SYSTEM_PROMPT, `Improve this LinkedIn post:\n\n${content}`, tenantId);
    }

    static async generate(
        tenantId: string,
        prompt: string,
        targetAudience?: string,
        previousSummaries: string[] = [],
        additionalContext?: string,
        authorUrn?: string,
        postShape?: string,
        effortLevel?: string,
        keyTakeaway?: string,
        antiGoals?: string,
        manualToneOverride?: string,
        platform?: string
    ): Promise<{ content: string; summary: string }> {
        const config = await this.getUnifiedConfig(tenantId, authorUrn);
        let SYSTEM_PROMPT = config.aiPersona || `You are an expert LinkedIn content strategist specializing in software development, cloud technologies, and AI.`;

        SYSTEM_PROMPT += `\n\nYour task is to create a compelling, high-performing LinkedIn post from scratch based on the provided idea or topic.\n`;

        if (targetAudience) {
            SYSTEM_PROMPT += `\n**Post Audience:** ${targetAudience}\nEnsure the content, examples, and takeaways are highly relevant to this group.\n`;
        }

        SYSTEM_PROMPT += `\n### MANDATORY CONSTRAINTS & INSTRUCTIONS ###\n`;
        SYSTEM_PROMPT += `You MUST strictly adhere to the following constraints. They take precedence over all other general guidelines.\n`;

        if (additionalContext) {
            SYSTEM_PROMPT += `\n**SPECIFIC USER INSTRUCTIONS (CRITICAL SOURCE OF TRUTH):**\n"${additionalContext}"\n-> You MUST incorporate these specific details, use cases, or stylistic requests accurately. These are your primary instructions.\n`;
        }

        if (antiGoals) {
            SYSTEM_PROMPT += `\n**ANTI-GOALS (STRICTLY AVOID):**\n"${antiGoals}"\n-> You must ensure the post does NOT violate these constraints.\n`;
        }

        // Platform character limits
        if (platform) {
            const platformUpper = platform.toUpperCase();
            if (platformUpper === 'TWITTER' || platformUpper === 'X') {
                SYSTEM_PROMPT += `\n**PLATFORM CHARACTER LIMIT (HARD CONSTRAINT):** This is a Twitter/X post. MAXIMUM 270 characters (hard limit, leave room for hashtags). This overrides all effort-level word limits.\n`;
            } else {
                SYSTEM_PROMPT += `\n**PLATFORM CHARACTER LIMIT:** This is a LinkedIn post. MAXIMUM 2800 characters (hard limit).\n`;
            }
        }

        // Top-performing posts as style reference (STYLE ONLY, NOT TOPIC)
        const topPosts = await this.getTopPerformingPosts(tenantId, authorUrn);
        if (topPosts.length > 0) {
            SYSTEM_PROMPT += `\n**STYLE REFERENCE (DO NOT COPY TOPICS):**
⚠️ IMPORTANT: These are style examples ONLY. Study the WRITING STYLE (tone, structure, hooks, formatting) but DO NOT copy or reference their TOPICS.
- DO study: sentence structure, hook style, formatting, tone, call-to-action style
- DO NOT use: the same topics, technologies, or subject matter from these examples
Your post must be about the PROMPT TOPIC, not about what these examples discuss.\n`;
            topPosts.forEach((post, i) => {
                SYSTEM_PROMPT += `[Style Example ${i + 1}]: ${post}\n`;
            });
        }

        // Voice samples — the author's actual writing for style matching
        const voiceSamples = await this.getVoiceSamples(tenantId);
        if (voiceSamples) {
            SYSTEM_PROMPT += `\n**VOICE SAMPLES — THE AUTHOR'S ACTUAL WRITING (HIGHEST PRIORITY FOR STYLE):**
These are real posts written by the author. Your generated post MUST match this voice — the rhythm, personality, argument style, hook patterns, and level of directness. This is MORE important than any generic style guideline below.
${voiceSamples}\n`;
        }

        SYSTEM_PROMPT += `\n### CONTENT STRATEGY ###\n`;

        const effectiveTone = manualToneOverride || config.toneInstructions;
        if (effectiveTone) {
            SYSTEM_PROMPT += `\n**TONE & WRITING STYLE:**\n${effectiveTone}\n`;
        }

        // Auto Post Shape: when no shape specified or "auto", let the AI choose
        const isAutoShape = !postShape || postShape.toLowerCase() === 'auto';
        if (isAutoShape) {
            SYSTEM_PROMPT += `\n**Post Shape/Format Strategy (AUTO-SELECT):**\nAnalyze the idea/topic and choose the BEST post shape from these options: "Hot take", "Breakdown (step-by-step)", "Story / anecdote", "Checklist", "Before vs After", "Diagram-first", "Question-led", "Myth vs Reality".\nIn your themeAnalysis field, include which shape you chose and why.\n`;
        } else if (postShape) {
            SYSTEM_PROMPT += `\n**Post Shape/Format Strategy:**\nYou must structure the post as a "${postShape}".\n`;
            if (postShape === 'Hot take') SYSTEM_PROMPT += `Be bold, controversial, and start with a strong opinion.\n`;
            else if (postShape === 'Breakdown (step-by-step)') SYSTEM_PROMPT += `Use a clear, step-by-step numbered list logic.\n`;
            else if (postShape === 'Story / anecdote') SYSTEM_PROMPT += `Use a narrative arc (Situation -> Complication -> Resolution).\n`;
            else if (postShape === 'Checklist') SYSTEM_PROMPT += `Provide a practical, actionable checklist.\n`;
            else if (postShape === 'Before vs After') SYSTEM_PROMPT += `Contrast the old way (Before) with the better new way (After).\n`;
            else if (postShape === 'Diagram-first') SYSTEM_PROMPT += `Write the post to accompany a visual diagram (describe the visual context).\n`;
            else if (postShape === 'Question-led') SYSTEM_PROMPT += `Start with a provocative question and answer it through the post.\n`;
            else if (postShape === 'Myth vs Reality') SYSTEM_PROMPT += `Debunk a common myth and present the reality.\n`;
        }

        const isTwitter = platform && (platform.toUpperCase() === 'TWITTER' || platform.toUpperCase() === 'X');
        if (isTwitter) {
            SYSTEM_PROMPT += `\n**STRICT LENGTH CONSTRAINT - YOU MUST OBEY THIS:**\nMAXIMUM 270 characters. This is a Twitter/X post. The character limit overrides all word-based effort levels. Keep it extremely concise.\n`;
        } else if (effortLevel) {
            SYSTEM_PROMPT += `\n**STRICT LENGTH CONSTRAINT - YOU MUST OBEY THIS:**\n`;
            if (effortLevel === '⚡ Quick') {
                SYSTEM_PROMPT += `MAXIMUM 80 WORDS. This is a HARD LIMIT. Use exactly ONE short paragraph or 3-4 very brief bullet points. NO intros, NO outros, NO "Here is your post". Just the punchy content. If you exceed 80 words, you have FAILED.\n`;
            }
            else if (effortLevel === '🧠 Medium') {
                SYSTEM_PROMPT += `MAXIMUM 150 WORDS. Hard limit. Keep it concise and impactful.\n`;
            }
            else if (effortLevel === '🧩 Deep') {
                SYSTEM_PROMPT += `MAXIMUM 300 WORDS. Detail is good but keep it tight.\n`;
            }
        }

        if (keyTakeaway) {
            SYSTEM_PROMPT += `\n**Mandatory Key Takeaway (THEMATIC GUIDE):**\nThe post must drive towards this core message: "${keyTakeaway}".\nIMPORTANT: This is a THEMATIC DIRECTION, not literal text. Paraphrase and weave this insight naturally into the post's conclusion using your own words. DO NOT copy-paste this text verbatim into the post.\n`;
        }

        if (previousSummaries.length > 0) {
            SYSTEM_PROMPT += `
### DEDUPLICATION & RADICAL FRESHNESS (MANDATORY) ###
The following are summaries of posts already generated for this exact topic. 
Previous Content Summaries:
${previousSummaries.map((s, i) => `[Post ${i + 1}] ${s}`).join('\n')}

**Deduplication Strategy (Chain-of-Thought):**
Before generating the post, you MUST identify the "Primary Arguments" and "Key Keywords" used in the previous posts.
You are PROHIBITED from using these same arguments or focal points. 
*Example: If previous posts focused on "Cost Scaling" and "Auto-provisioning", you MUST pivot to "Developer Burnout", "Security Simplification", or "Legacy Migration Challenges" even if the source text heavily mentions cost.*

**Negative Constraints - DO NOT USE THESE CONCEPTS IF THEY APPEAR ABOVE:**
- Identifying repeated themes... (AI must do this internally)
- Do NOT use the exact same hook structure as any previous post.
- Do NOT use the same "Key Takeaway" if it has been used >2 times.

**Suggested Fresh Angles:**
- **The "Contrarian"**: Argue against a common assumption in the source material.
- **The "Case Study"**: Zoom in on one tiny, specific technical detail or human error.
- **The "Strategic Pivot"**: How this changes the 5-year outlook for a company.
- **The "Developer POV"**: Focus on the tools, the IDE experience, or the debugging pain.
`;
        }

        // Randomly select a structure to force variety across generations
        const structures = [
            { name: 'cold-open-story', instruction: 'Start mid-scene — drop the reader into a specific moment. "The deploy went out at 2am. By 2:07, three dashboards were red." Build the narrative from there. No introduction, no setup — just the moment.' },
            { name: 'single-thesis', instruction: 'One clear argument in flowing prose. No bullets, no lists, no bold. Just well-paced paragraphs making a single compelling point. Think op-ed, not listicle.' },
            { name: 'observation', instruction: 'Start with something you literally noticed or experienced. "I reviewed 40 PRs last month and noticed something weird." Be specific and concrete — no hypotheticals or generic claims.' },
            { name: 'contrarian-take', instruction: 'State a belief most people in the industry hold, then explain why you think differently. Be specific about WHY, not just that you disagree.' },
            { name: 'short-lesson', instruction: 'Under 100 words. One sharp insight, no fluff. Think fortune cookie meets engineering wisdom. Every word must earn its place.' },
            { name: 'before-after', instruction: 'Describe a specific real-world before state and after state. Not generic "before: chaos, after: peace" — concrete, measurable differences someone actually experienced.' },
            { name: 'question-answer', instruction: 'Open with a genuine question someone actually asks. Answer it directly and concisely. No rhetorical tricks — just a useful answer.' },
            { name: 'list-of-specifics', instruction: 'A short list (3-5 items) where each item is hyper-specific and opinionated, not generic advice. "Use caching" is bad. "Cache your auth token refresh — it saved us 340ms per request" is good.' },
        ];
        const chosenStructure = structures[Math.floor(Math.random() * structures.length)]!;

        SYSTEM_PROMPT += `
**MANDATORY POST STRUCTURE — "${chosenStructure.name}":**
${chosenStructure.instruction}

**Topics & Focus:**
- Focus on the topics provided in the "Idea Title", "Creative Brief / Description", and "Topic Tags".
- If "SPECIFIC USER INSTRUCTIONS" were provided above, they are your primary source of truth.
- Pick ONE specific angle and go deep rather than covering everything superficially.

**Tone & Style**:
${effectiveTone ? `**IMPORTANT: You MUST strictly follow these specific style guidelines:**\n${effectiveTone}` : `- Write like you're texting a smart friend about something interesting — not presenting at a conference.
- Use your natural vocabulary. If you wouldn't say "leverage" or "paradigm shift" at lunch, don't write it.
- Have a point of view. Bland, agreeable posts get scrolled past.`}

${(effectiveTone?.toLowerCase().includes('use "we"') || effectiveTone?.toLowerCase().includes('collective reference') || effectiveTone?.toLowerCase().includes('instead of "i"'))
                ? '**CRITICAL PERSPECTIVE RULE:** You MUST use "We" (collective reference) instead of "I" (individual reference) throughout the post. This is a hard constraint.'
                : ''}

**Formatting:**
- Short paragraphs (1-3 lines). Use whitespace to let the post breathe.
- Bold text, bullets, and numbered lists are OPTIONAL — use them only when they genuinely help. Many great posts use none of these.
- Do NOT over-format. A clean paragraph is often better than a bulleted list.

**URLs & Links (HARD CONSTRAINT):**
- DO NOT fabricate URLs. Only include URLs explicitly provided in the input.

**Hashtags (REQUIRED):**
- End with 3-6 specific hashtags (e.g., #Kubernetes, #DevOps). No generic tags like #Innovation.

**BANNED PATTERNS — your post will be REJECTED if it contains any of these:**
- Opening with "Your [X] is [negative adjective]" (e.g., "Your API is a ticking time bomb")
- Opening with "Most [teams/CTOs/engineers] [do X wrong]"
- The skeleton: provocative claim → "here's what's wrong" → bullet list → "the real issue" → CTA question
- Filler openings: "Here's the thing:", "Let me explain:", "The truth is:", "Hot take:", "Unpopular opinion:"
- Generic CTAs: "What's your experience with X?", "How do you handle Y?", "Agree or disagree?"
- Dramatic framing: "silent killer", "ticking time bomb", "gaslighting you", "holding it hostage"
- Fabricated anecdotes: "I watched a team...", "A company I know...", "Six months ago, I watched..."
- Starting with "Stop [doing X]" or "Nobody talks about [X]"
- Arrow bullet points (→) in every post — use them rarely if at all

**LENGTH:**
- Default target: 80-200 words. Quality over quantity.
- Shorter is almost always better. Only go longer if the story genuinely needs it.

**Response Format:**
Return a JSON object:
{
    "themeAnalysis": "1 sentence: what angle am I taking and why it's different from typical content on this topic",
    "postContent": "The complete post content...",
    "summary": "2-line summary of the unique angle used"
}
**CRITICAL:** RETURN ONLY VALID JSON. No markdown blocks, no filler text. Escape newlines as "\\n" in postContent.
`;


        console.log("[AIService] Prompt length:", prompt.length);

        const response = await this.callOpenRouterWithTools(config, SYSTEM_PROMPT, prompt, tenantId);

        console.log("[AIService] Raw response length:", response?.length, "preview:", response?.substring(0, 200));

        if (!response || response.trim().length === 0) {
            console.error("[AIService] AI returned empty response");
            throw new Error('AI returned empty response. Please try again.');
        }

        try {
            const parsed = this.extractAndParseJson(response);
            const finalContent = parsed.postContent || parsed.content || response;

            return {
                content: this.sanitizePostContent(finalContent, prompt),
                summary: parsed.summary || "Summary generation failed or returned empty"
            };
        } catch (e: any) {
            console.error("[AIService] Failed to parse AI response as JSON:", e.message, "Response preview:", response.substring(0, 300));
            // Fallback - try to extract anything that looks like a post if parsing fails
            return {
                content: this.sanitizePostContent(response.length > 100 ? response : "Failed to generate valid post content.", prompt),
                summary: "Summary parsing failed"
            };
        }
    }

    /**
     * Strip hallucinated URLs from generated content.
     * Only keeps URLs that were present in the original prompt (source links, reference material).
     */
    private static sanitizePostContent(content: string, originalPrompt: string): string {
        // Extract all URLs from the original prompt to build an allowlist
        const urlRegex = /https?:\/\/[^\s\])"',]+/g;
        const allowedUrls = new Set<string>();
        let match;
        while ((match = urlRegex.exec(originalPrompt)) !== null) {
            // Store the domain as allowed
            try {
                const domain = new URL(match[0]).hostname;
                allowedUrls.add(domain);
            } catch { /* skip malformed URLs */ }
        }

        // Remove markdown links [text](url) where the URL domain is not in the allowlist
        let sanitized = content.replace(/\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g, (fullMatch, text, url) => {
            try {
                const domain = new URL(url).hostname;
                if (allowedUrls.has(domain)) {
                    return fullMatch; // Keep — domain was in the prompt
                }
            } catch { /* malformed URL */ }
            console.warn(`[AIService] Stripped hallucinated link: ${url}`);
            return text; // Strip the link, keep the text
        });

        // Also remove bare URLs that aren't from allowed domains
        sanitized = sanitized.replace(/(?<!\()(https?:\/\/[^\s\])"',]+)/g, (fullMatch, url) => {
            try {
                const domain = new URL(url).hostname;
                if (allowedUrls.has(domain)) {
                    return fullMatch;
                }
            } catch { /* malformed URL */ }
            console.warn(`[AIService] Stripped hallucinated bare URL: ${url}`);
            return '';
        });

        // Clean up any leftover empty parentheses or extra whitespace from removals
        sanitized = sanitized.replace(/\(\s*\)/g, '').replace(/\n{3,}/g, '\n\n').trim();

        return sanitized;
    }


    private static extractAndParseJson(response: string): any {
        let cleanText = response.trim();

        // Remove markdown code blocks if present
        cleanText = cleanText.replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/g, '$1').trim();

        // LLM sometimes prepends text before the JSON or appends after it
        // We look for the first '{' and the last '}'
        const firstBrace = cleanText.indexOf('{');
        const lastBrace = cleanText.lastIndexOf('}');

        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            cleanText = cleanText.substring(firstBrace, lastBrace + 1);
        }

        try {
            // Attempt 1: Direct parse
            return JSON.parse(cleanText);
        } catch (e) {
            try {
                // Attempt 2: Heuristic newline escaping for poorly formatted LLM output
                // Many LLMs fail to escape \n and instead produce literal newlines inside strings
                const lines = cleanText.split('\n');
                let reconstructed = '';
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i]?.trim() ?? '';
                    // If line doesn't look like the start of a new key-value pair or a bracket, it's likely a continuation
                    if (i > 0 && !line.startsWith('"') && !line.startsWith('}') && !line.startsWith(']')) {
                        reconstructed += '\\n' + lines[i];
                    } else {
                        reconstructed += (i > 0 ? '\n' : '') + lines[i];
                    }
                }
                return JSON.parse(reconstructed);
            } catch (innerE) {
                // Attempt 3: Aggressive cleanup of control characters and common JSON syntax errors
                try {
                    let extraClean = cleanText
                        .replace(/\n/g, '\\n') // Escape actual newlines
                        .replace(/\r/g, '\\r')
                        .replace(/\t/g, '\\t');

                    // Fix single quotes to double quotes for keys and values if it looks like invalid JSON
                    // This is heuristic and might break content with apostrophes, but it's a fallback
                    if (extraClean.includes("'")) {
                        // Replace 'key': with "key":
                        extraClean = extraClean.replace(/'([^']+?)'\s*:/g, '"$1":');
                        // Replace : 'value' with : "value"
                        extraClean = extraClean.replace(/:\s*'([^']+?)'/g, ': "$1"');
                        // Replace array elements 'value',
                        extraClean = extraClean.replace(/['"]?topics['"]?\s*:\s*\[([\s\S]*?)\]/g, (match, arrayContent) => {
                            const fixedArray = arrayContent.replace(/'([^']+?)'/g, '"$1"');
                            return `"topics": [${fixedArray}]`;
                        });
                    }

                    extraClean = extraClean
                        .replace(/\\"/g, '"') // Unescape all quotes (start fresh)
                        .replace(/"/g, '\\"') // Escape all quotes
                        .replace(/^\\"/, '"') // Unescape first quote
                        // .replace(/\\"$/, '"') // Unescape last quote - removed because it might be wrong if last char is }
                        .replace(/\\":\\"/g, '":"') // Fix key-value separator
                        .replace(/\\",\\"/g, '","') // Fix comma separator
                        .replace(/{\\"/g, '{"') // Fix start
                        .replace(/\\"}/g, '"}') // Fix end
                        .replace(/\\":\[/g, '":[') // Fix array start
                        .replace(/],\\"/g, '],"'); // Fix array end comma

                    return JSON.parse(extraClean);
                } catch (lastE) {
                    console.warn("[AIService] JSON.parse failed all attempts, falling back to regex extraction.");
                    const extractedContent = this.extractRegexField(cleanText, "postContent") || this.extractRegexField(cleanText, "content");
                    const extractedSummary = this.extractRegexField(cleanText, "summary");

                    if (extractedContent) {
                        return {
                            postContent: extractedContent,
                            summary: extractedSummary || "Summary extraction failed"
                        };
                    }

                    // Specific fallback for trending topics
                    const extractedTopics = this.extractRegexArray(cleanText, "topics");
                    if (extractedTopics) {
                        return { topics: extractedTopics };
                    }

                    throw lastE;
                }
            }
        }
    }


    private static extractRegexField(text: string, fieldName: string): string | null {
        // Look for "fieldName": "..." handling some variations in spacing and trailing commas
        const regex = new RegExp(`"${fieldName}"\\s*:\\s*"([\\s\\S]*?)"(?:\\s*,|\\s*})`);
        const match = text.match(regex);
        if (match && match[1]) {
            // Clean up common LLM "escaping" that isn't valid in JS strings but helpful in raw text
            return match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim();
        }
        return null;
    }

    private static extractRegexArray(text: string, fieldName: string): any[] | null {
        // Look for "fieldName": [...] 
        const regex = new RegExp(`"${fieldName}"\\s*:\\s*\\[([\\s\\S]*?)\\]`);
        const match = text.match(regex);
        if (match && match[1]) {
            try {
                // Try to parse just the array part by wrapping it in braces
                const arrayContent = match[1];
                // basic cleanup of single quotes inside the array if needed, though cleanText might have handled it
                // heuristic: if it looks like 'item', 'item', replace with "item", "item"
                const fixedContent = arrayContent.replace(/'([^']+?)'/g, '"$1"');
                return JSON.parse(`[${fixedContent}]`);
            } catch (e) {
                return null;
            }
        }
        return null;
    }

    static async suggestContentPillars(tenantId: string, companyName?: string, companyDescription?: string, industry?: string, expertiseAreas?: string[]): Promise<string[]> {
        const config = await this.getUnifiedConfig(tenantId);

        const SYSTEM_PROMPT = `You are an expert content strategist. Given a business profile, suggest 5-6 content pillars (core recurring themes) that this person/company should consistently post about on LinkedIn.

Content pillars should be:
- Specific enough to guide content creation
- Broad enough to generate many post ideas
- Relevant to the business's industry and expertise
- A mix of educational, thought leadership, and engagement-driven themes

Return a JSON object: { "pillars": ["Pillar 1", "Pillar 2", ...] }
**CRITICAL:** Return ONLY valid JSON. No markdown blocks, no explanations.`;

        const userContent = `${companyName ? `Company: ${companyName}` : ''}
${industry ? `Industry: ${industry}` : ''}
${companyDescription ? `What they do: ${companyDescription}` : ''}
${expertiseAreas && expertiseAreas.length > 0 ? `Expertise areas: ${expertiseAreas.join(', ')}` : ''}`;

        const response = await this.callOpenRouter(config, SYSTEM_PROMPT, userContent);

        try {
            const parsed = this.extractAndParseJson(response);
            return parsed?.pillars || [];
        } catch (e) {
            console.error('[AIService] Failed to parse pillars response:', e);
            return [];
        }
    }

    static async generateIdeaBatch(
        tenantId: string,
        params: {
            companyName?: string; industry?: string; companyDescription?: string;
            expertiseAreas?: string[]; contentPillars: string[];
            targetAudience?: string; audiencePainPoints?: string; toneOverride?: string;
            batchTheme?: string; trendingTopics?: string;
            count: number; authorUrn?: string; excludeTitles?: string[];
        }
    ): Promise<Array<{ title: string; description: string; tags: string[]; suggestedPostShape: string; suggestedEffortLevel: string }>> {
        const config = await this.getUnifiedConfig(tenantId, params.authorUrn);
        const { companyName, industry, companyDescription, expertiseAreas, contentPillars,
            targetAudience, audiencePainPoints, toneOverride, batchTheme, trendingTopics,
            count, authorUrn, excludeTitles } = params;

        let SYSTEM_PROMPT = `You are a strategic content planning assistant for LinkedIn and Twitter.

CONTEXT ABOUT THE AUTHOR/BRAND:
${companyName ? `Company: ${companyName}` : ''}
${industry ? `Industry: ${industry}` : ''}
${companyDescription ? `What they do: ${companyDescription}` : ''}
${expertiseAreas && expertiseAreas.length > 0 ? `Expertise: ${expertiseAreas.join(', ')}` : ''}

Content Pillars: ${contentPillars.join(', ')}

AUDIENCE:
${targetAudience ? `Target: ${targetAudience}` : 'General professional audience'}
${audiencePainPoints ? `Their pain points: ${audiencePainPoints}` : ''}`;

        if (toneOverride && toneOverride !== 'Use Default') {
            SYSTEM_PROMPT += `\n\nTONE: Write in a ${toneOverride} tone.`;
        } else if (config.toneInstructions) {
            SYSTEM_PROMPT += `\n\nTONE: ${config.toneInstructions}`;
        }

        if (batchTheme) {
            SYSTEM_PROMPT += `\n\nBATCH FOCUS: The user wants ideas around this theme: "${batchTheme}"`;
        }
        if (trendingTopics) {
            SYSTEM_PROMPT += `\nTRENDING CONTEXT: Consider these current events/trends: "${trendingTopics}"`;
        }

        // Add top performing posts as style reference (STYLE ONLY, NOT TOPICS)
        const topPosts = await this.getTopPerformingPosts(tenantId, authorUrn);
        if (topPosts.length > 0) {
            SYSTEM_PROMPT += `\n\n**STYLE REFERENCE (DO NOT COPY TOPICS):**
Study the WRITING STYLE only (tone, structure, formatting) - generate ideas on DIFFERENT topics than these examples:`;
            topPosts.forEach((post, i) => { SYSTEM_PROMPT += `\n[Style Example ${i + 1}]: ${post}`; });
        }

        if (excludeTitles && excludeTitles.length > 0) {
            SYSTEM_PROMPT += `\n\nALREADY GENERATED (DO NOT REPEAT):\n${excludeTitles.map(t => `- ${t}`).join('\n')}`;
        }

        SYSTEM_PROMPT += `\n\nYOUR TASK: Generate exactly ${count} unique content idea concepts.

REQUIREMENTS FOR EACH IDEA:
1. title: A compelling, specific title (max 80 chars)
2. description: 2-3 sentences explaining the angle and key argument (content brief, NOT the final post)
3. tags: 2-4 relevant topic tags
4. suggestedPostShape: Pick from: "Hot take", "Breakdown (step-by-step)", "Story / anecdote", "Checklist", "Before vs After", "Question-led", "Myth vs Reality"
5. suggestedEffortLevel: "Quick" for simple observations, "Medium" for standard arguments, "Deep" for comprehensive analyses

DIVERSITY RULES:
- Spread ideas across different content pillars
- Vary the post shapes (max 2 of same shape)
- Mix effort levels
- Include at least one contrarian/hot take and one practical how-to

RESPONSE FORMAT:
Return a JSON object:
{
  "ideas": [
    { "title": "...", "description": "...", "tags": ["..."], "suggestedPostShape": "...", "suggestedEffortLevel": "..." }
  ]
}
CRITICAL: Return ONLY valid JSON. No markdown blocks.`;

        console.log('[AIService] Generating idea batch, count:', count);
        const response = await this.callOpenRouterWithTools(config, SYSTEM_PROMPT, `Generate ${count} content ideas now.`, tenantId);

        try {
            const parsed = this.extractAndParseJson(response);
            return parsed?.ideas || [];
        } catch (e) {
            console.error('[AIService] Failed to parse idea batch response:', e);
            return [];
        }
    }

    static async generateVariations(
        tenantId: string,
        content: string,
        authorUrn?: string,
        targetAudience?: string,
        platform?: string
    ): Promise<Array<{ content: string; format: string }>> {
        const config = await this.getUnifiedConfig(tenantId, authorUrn);

        // Determine character limit based on platform
        const isTwitter = platform && (platform.toUpperCase() === 'TWITTER' || platform.toUpperCase() === 'X');
        const charLimit = isTwitter ? 270 : 2800;
        const platformName = isTwitter ? 'Twitter/X' : 'LinkedIn';

        let SYSTEM_PROMPT = config.aiPersona || `You are an expert social media content strategist specializing in creating engaging posts.`;

        SYSTEM_PROMPT += `\n\nYour task is to rewrite the provided content in 3 DIFFERENT post formats while preserving the SAME core message.\n`;

        SYSTEM_PROMPT += `\n**PLATFORM:** ${platformName}`;
        SYSTEM_PROMPT += `\n**CHARACTER LIMIT:** Maximum ${charLimit} characters per variation. This is a HARD LIMIT.\n`;

        // Add top-performing posts as style reference (STYLE ONLY)
        const topPosts = await this.getTopPerformingPosts(tenantId, authorUrn);
        if (topPosts.length > 0) {
            SYSTEM_PROMPT += `\n**STYLE REFERENCE (study style and hooks only, not topics):**\n`;
            topPosts.forEach((post, i) => {
                SYSTEM_PROMPT += `[Style Example ${i + 1}]: ${post}\n`;
            });
        }

        if (targetAudience) {
            SYSTEM_PROMPT += `\n**TARGET AUDIENCE:** ${targetAudience}\nEnsure all variations resonate with this audience.\n`;
        }

        if (config.toneInstructions) {
            SYSTEM_PROMPT += `\n**TONE & STYLE:**\n${config.toneInstructions}\n`;
        }

        SYSTEM_PROMPT += `
**AVAILABLE FORMATS (choose 3 different ones):**
1. Hot take - Bold, controversial opinion that grabs attention
2. Breakdown (step-by-step) - Numbered steps or logical progression
3. Story/anecdote - Narrative arc with situation, challenge, resolution
4. Checklist - Actionable items the reader can use
5. Before vs After - Contrast the old way with the better new way
6. Question-led - Start with a provocative question, then answer it
7. Myth vs Reality - Debunk a common misconception

**REQUIREMENTS:**
- Each variation MUST convey the SAME core message/insight from the original content
- Each variation MUST use a DIFFERENT format from the list above
- Each variation MUST be under ${charLimit} characters
- Maintain the author's voice and authenticity
- Make each variation engaging and ready to publish

**RESPONSE FORMAT:**
Return a JSON object:
{
    "variations": [
        { "content": "The full post text...", "format": "Hot take" },
        { "content": "The full post text...", "format": "Breakdown (step-by-step)" },
        { "content": "The full post text...", "format": "Question-led" }
    ]
}

**CRITICAL:** Return ONLY valid JSON. No markdown blocks, no explanations.
`;

        console.log('[AIService] Generating variations for content');

        const response = await this.callOpenRouter(config, SYSTEM_PROMPT, `Generate 3 variations of this content:\n\n${content}`);

        try {
            const parsed = this.extractAndParseJson(response);
            const variations = parsed?.variations || [];

            // Validate and filter variations
            return variations
                .filter((v: any) => v.content && v.format)
                .map((v: any) => ({
                    content: v.content.substring(0, charLimit),
                    format: v.format
                }));
        } catch (e: any) {
            console.error('[AIService] Failed to parse variations response:', e.message);
            return [];
        }
    }

    static async generateHooks(
        tenantId: string,
        content: string,
        count: number = 5,
        authorUrn?: string,
        platform?: string
    ): Promise<Array<{ hook: string; style: string }>> {
        const config = await this.getUnifiedConfig(tenantId, authorUrn);

        const isTwitter = platform && (platform.toUpperCase() === 'TWITTER' || platform.toUpperCase() === 'X');
        const platformName = isTwitter ? 'Twitter/X' : 'LinkedIn';
        const charLimit = isTwitter ? 100 : 200;

        let SYSTEM_PROMPT = config.aiPersona || `You are an expert social media content strategist specializing in creating attention-grabbing hooks.`;

        SYSTEM_PROMPT += `\n\nYour task is to generate ${count} compelling hook variations for the provided content.\n`;

        SYSTEM_PROMPT += `\n**PLATFORM:** ${platformName}`;
        SYSTEM_PROMPT += `\n**HOOK CHARACTER LIMIT:** Maximum ${charLimit} characters per hook. This is a HARD LIMIT.\n`;

        // Add top-performing posts as style reference (STYLE ONLY)
        const topPosts = await this.getTopPerformingPosts(tenantId, authorUrn);
        if (topPosts.length > 0) {
            SYSTEM_PROMPT += `\n**HOOK STYLE REFERENCE (study hook structure, not topics):**\n`;
            topPosts.forEach((post, i) => {
                const firstLine = post.split('\n')[0] || post.substring(0, 100);
                SYSTEM_PROMPT += `[Hook Style ${i + 1}]: ${firstLine}\n`;
            });
        }

        if (config.toneInstructions) {
            SYSTEM_PROMPT += `\n**TONE & STYLE:**\n${config.toneInstructions}\n`;
        }

        SYSTEM_PROMPT += `
**HOOK STYLES TO USE (generate variety across these):**
1. Question - Start with a provocative or relatable question
2. Bold Statement - Lead with a controversial or surprising claim
3. Story Opener - Begin with "I..." or a personal anecdote teaser
4. Statistic/Number - Open with a compelling data point or number
5. Pain Point - Address a common frustration or challenge
6. Contrarian - Challenge conventional wisdom
7. Curiosity Gap - Create intrigue without revealing everything

**REQUIREMENTS:**
- Each hook MUST be under ${charLimit} characters
- Each hook should make the reader want to continue reading
- Hooks should capture the ESSENCE of the content's main message
- Vary the styles - do not repeat the same style twice
- Hooks should be ready to use as the first 1-2 lines of a post

**RESPONSE FORMAT:**
Return a JSON object:
{
    "hooks": [
        { "hook": "The attention-grabbing opening line...", "style": "Question" },
        { "hook": "Another compelling hook...", "style": "Bold Statement" }
    ]
}

**CRITICAL:** Return ONLY valid JSON. No markdown blocks, no explanations.
`;

        console.log('[AIService] Generating hooks for content');

        const response = await this.callOpenRouter(config, SYSTEM_PROMPT, `Generate ${count} hook variations for this content:\n\n${content}`);

        try {
            const parsed = this.extractAndParseJson(response);
            const hooks = parsed?.hooks || [];

            return hooks
                .filter((h: any) => h.hook && h.style)
                .map((h: any) => ({
                    hook: h.hook.substring(0, charLimit),
                    style: h.style
                }));
        } catch (e: any) {
            console.error('[AIService] Failed to parse hooks response:', e.message);
            return [];
        }
    }

    static async suggestHashtags(
        tenantId: string,
        content: string,
        count: number = 5,
        platform?: string
    ): Promise<string[]> {
        const config = await this.getUnifiedConfig(tenantId);

        const isTwitter = platform && (platform.toUpperCase() === 'TWITTER' || platform.toUpperCase() === 'X');
        const platformName = isTwitter ? 'Twitter/X' : 'LinkedIn';

        let SYSTEM_PROMPT = `You are an expert social media strategist specializing in hashtag optimization for ${platformName}.`;

        SYSTEM_PROMPT += `\n\nYour task is to suggest ${count} relevant and effective hashtags for the provided content.\n`;

        SYSTEM_PROMPT += `
**HASHTAG GUIDELINES FOR ${platformName.toUpperCase()}:**
${isTwitter ? `
- Twitter hashtags should be concise and trending-aware
- Mix of broad reach (#Tech, #AI) and niche (#DevOps, #CloudNative)
- 2-3 hashtags is optimal for Twitter engagement
- Avoid overly long hashtags
` : `
- LinkedIn hashtags should be professional and industry-relevant
- Mix of broad (#Leadership, #Technology) and specific (#SaaS, #ProductManagement)
- 3-5 hashtags is optimal for LinkedIn
- Include at least one high-volume hashtag for reach
`}

**REQUIREMENTS:**
- Return exactly ${count} hashtags
- Each hashtag must start with #
- Hashtags should be relevant to the content's main topics
- Include a mix of:
  - High-volume hashtags (for reach)
  - Niche hashtags (for targeted audience)
  - Industry-specific hashtags
- Avoid generic hashtags like #post or #content
- No spaces in hashtags (use CamelCase for multi-word tags)

**RESPONSE FORMAT:**
Return a JSON object:
{
    "hashtags": ["#Hashtag1", "#Hashtag2", "#Hashtag3"]
}

**CRITICAL:** Return ONLY valid JSON. No markdown blocks, no explanations.
`;

        console.log('[AIService] Suggesting hashtags for content');

        const response = await this.callOpenRouter(config, SYSTEM_PROMPT, `Suggest ${count} hashtags for this content:\n\n${content}`);

        try {
            const parsed = this.extractAndParseJson(response);
            const hashtags = parsed?.hashtags || [];

            return hashtags
                .filter((h: any) => typeof h === 'string' && h.startsWith('#'))
                .slice(0, count);
        } catch (e: any) {
            console.error('[AIService] Failed to parse hashtags response:', e.message);
            return [];
        }
    }

    static async searchWithTavily(
        tavilyApiKey: string,
        query: string,
        options: { topic?: string; timeRange?: string; maxResults?: number } = {}
    ): Promise<Array<{ title: string; url: string; content: string; score: number }>> {
        const { topic = 'news', timeRange = 'day', maxResults = 5 } = options;

        try {
            const response = await axios.post(
                'https://api.tavily.com/search',
                {
                    query,
                    topic,
                    time_range: timeRange,
                    max_results: maxResults,
                    search_depth: 'basic',
                    include_answer: true,
                },
                {
                    headers: {
                        'Authorization': `Bearer ${tavilyApiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log(`[AIService] Tavily search for "${query}" returned ${response.data.results?.length || 0} results`);
            return response.data.results || [];
        } catch (error: any) {
            console.error('[AIService] Tavily search error:', error.response?.data || error.message);
            return [];
        }
    }

    static async getTrendingTopics(
        tenantId: string,
        params: {
            industry?: string;
            contentPillars?: string[];
            targetAudience?: string;
            count?: number;
        }
    ): Promise<Array<{ topic: string; description: string; relevance: string; suggestedAngles: string[]; sources: string[]; trendType: string }>> {
        const config = await this.getUnifiedConfig(tenantId);
        const settings = await Settings.findOne({ where: { tenantId } });
        const tavilyApiKey = settings?.tavilyApiKey;
        const { industry, contentPillars, targetAudience, count = 5 } = params;

        // Include current date for accurate trending topics
        const currentDate = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // If Tavily is configured, use two-step flow: search first, then analyze
        let tavilyContext = '';
        if (tavilyApiKey) {
            console.log('[AIService] Using Tavily for fresh web search results');
            const searchQuery = industry
                ? `latest trending news and developments in ${industry}`
                : 'latest trending technology business news today';

            const results = await this.searchWithTavily(tavilyApiKey, searchQuery, {
                topic: 'news',
                timeRange: 'day',
                maxResults: 10,
            });

            if (results.length > 0) {
                tavilyContext = `\n\n**REAL-TIME SEARCH RESULTS (fetched just now via web search):**\nUse these fresh search results as your PRIMARY source for identifying trends. These are verified, real-time results:\n\n`;
                results.forEach((r, i) => {
                    tavilyContext += `${i + 1}. **${r.title}**\n   URL: ${r.url}\n   ${r.content}\n\n`;
                });
                tavilyContext += `\nAnalyze these search results to identify the most significant trending topics. You MUST use the actual URLs from the search results above as sources. Do NOT fabricate URLs.`;
            }
        }

        const useTavilyResults = !!tavilyContext;

        let SYSTEM_PROMPT = `You are a social media trend analyst with expertise in identifying trending topics and conversations relevant to professional content creation.

**TODAY'S DATE:** ${currentDate}

Your task is to identify ${count} current trending topics that would be relevant for LinkedIn/Twitter content creation.

${useTavilyResults
    ? `**IMPORTANT:** You have been provided with real-time web search results below. Analyze them to identify trending topics. Use the actual source URLs provided in the results.`
    : `**IMPORTANT:** You have access to web search. Use it to find CURRENT trending topics, news, and discussions from the past 7 days (as of ${currentDate}). Search for recent news and trends.`
}`;

        if (industry) {
            SYSTEM_PROMPT += `\n\n**INDUSTRY FOCUS:** ${industry}\nPrioritize trends relevant to this industry.`;
        }

        if (contentPillars && contentPillars.length > 0) {
            SYSTEM_PROMPT += `\n\n**CONTENT PILLARS:** ${contentPillars.join(', ')}\nFind trends that align with these content themes.`;
        }

        if (targetAudience) {
            SYSTEM_PROMPT += `\n\n**TARGET AUDIENCE:** ${targetAudience}\nEnsure trends would resonate with this audience.`;
        }

        SYSTEM_PROMPT += `

**TREND TYPES TO LOOK FOR (as of ${currentDate}):**
- "breaking" - Major news or announcements from the last 24-48 hours
- "emerging" - Growing conversations and topics gaining momentum this week
- "evergreen-surge" - Established topics seeing renewed interest recently
- "seasonal" - Time-sensitive or event-related trends happening now
- "controversy" - Current debates or polarizing discussions (handle professionally)

**FOR EACH TREND, PROVIDE:**
1. topic: Clear, specific topic name (not generic)
2. description: 2-3 sentences explaining what's happening and why it's trending
3. relevance: Why this matters for professional content creators
4. suggestedAngles: 3-4 specific content angles to cover this trend
5. sources: 1-3 URLs to articles, announcements, or discussions that support this trend (REQUIRED - these help verify the trend and provide reference material for content creation)
6. trendType: One of the types listed above

**RESPONSE FORMAT:**
Return a JSON object:
{
    "topics": [
        {
            "topic": "Specific Trend Name",
            "description": "What's happening and why it's trending...",
            "relevance": "Why content creators should care...",
            "suggestedAngles": ["Angle 1", "Angle 2", "Angle 3"],
            "sources": ["https://example.com/article1", "https://example.com/article2"],
            "trendType": "breaking|emerging|evergreen-surge|seasonal|controversy"
        }
    ]
}

**CRITICAL:**
- Return ONLY valid JSON. No markdown blocks, no explanations.
- Topics must be CURRENT and REAL - use web search to verify.
- Be specific - avoid generic topics like "AI" or "Technology".
- ALWAYS include source URLs - these are essential for fact-checking and content creation.
- **DO NOT** use single quotes for keys or string values. Use double quotes only.
- **DO NOT** leave trailing commas.`;

        console.log(`[AIService] Fetching trending topics${useTavilyResults ? ' (with Tavily search results)' : ' (via OpenRouter web plugin)'}`);

        let userPrompt = `Search for and identify ${count} trending topics${industry ? ` in the ${industry} industry` : ''} that would make great professional content. Focus on what's happening as of ${currentDate} - search for news and discussions from the past 7 days. Include source URLs for each trend.`;

        if (tavilyContext) {
            userPrompt += tavilyContext;
        }

        // When Tavily provides results, skip OpenRouter's web plugin to avoid redundant/stale search
        const response = await this.callOpenRouterWithTools(config, SYSTEM_PROMPT, userPrompt, tenantId);

        try {
            const parsed = this.extractAndParseJson(response);
            const topics = parsed?.topics || [];

            return topics
                .filter((t: any) => t.topic && t.description && t.relevance && t.suggestedAngles && t.trendType)
                .slice(0, count)
                .map((t: any) => ({
                    topic: t.topic,
                    description: t.description,
                    relevance: t.relevance,
                    suggestedAngles: Array.isArray(t.suggestedAngles) ? t.suggestedAngles : [t.suggestedAngles],
                    sources: Array.isArray(t.sources) ? t.sources.filter((s: any) => typeof s === 'string' && s.startsWith('http')) : [],
                    trendType: t.trendType
                }));
        } catch (e: any) {
            console.error('[AIService] Failed to parse trending topics response:', e.message);
            return [];
        }
    }

    /**
     * Generate a weekly digest post curating the biggest stories of the week.
     * Searches Tavily for each topic, then has the LLM curate top stories into a formatted post.
     */
    static async generateWeeklyDigest(
        tenantId: string,
        params: {
            topics: string[];
            platform?: string;
            authorUrn?: string;
            storyCount?: number;
            additionalContext?: string;
        }
    ): Promise<{ content: string; stories: Array<{ headline: string; summary: string; url: string }>; digestId: number }> {
        const config = await this.getUnifiedConfig(tenantId, params.authorUrn);
        const settings = await Settings.findOne({ where: { tenantId } });
        const tavilyApiKey = settings?.tavilyApiKey;
        const { topics, platform, storyCount = 5, additionalContext } = params;

        if (!tavilyApiKey) {
            throw new Error('Tavily API key is required for Weekly Digest. Configure it in Settings.');
        }

        const currentDate = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        // Search Tavily for each topic with week-long timeRange
        console.log(`[AIService] Weekly Digest: searching ${topics.length} topics via Tavily`);
        const allResults: Array<{ topic: string; results: Array<{ title: string; url: string; content: string; score: number }> }> = [];

        for (const topic of topics) {
            const results = await this.searchWithTavily(tavilyApiKey, `latest news and developments: ${topic}`, {
                topic: 'news',
                timeRange: 'week',
                maxResults: 8,
            });
            allResults.push({ topic, results });
        }

        // Build context from all search results
        let searchContext = '';
        allResults.forEach(({ topic, results }) => {
            searchContext += `\n### Topic: "${topic}" (${results.length} results)\n`;
            results.forEach((r, i) => {
                searchContext += `${i + 1}. **${r.title}**\n   URL: ${r.url}\n   ${r.content}\n\n`;
            });
        });

        const SYSTEM_PROMPT = `You are an expert content curator who creates compelling weekly digest posts for LinkedIn/Twitter.

**TODAY'S DATE:** ${currentDate}

Your task is to curate the ${storyCount} BIGGEST and most impactful stories from the past week into a short, punchy digest post.

**FORMAT RULES:**
1. Start with a bold, opinionated opening line (1-2 sentences) that ties the stories together with a theme or insight. This should feel like a hot take or observation, NOT a generic "here's what happened this week."
2. Then list each story as a separate block:
   - Story headline in bold (use unicode bold characters like 𝐁𝐨𝐥𝐝 𝐓𝐞𝐱𝐭)
   - 1-2 sentence description of what happened and why it matters. Be specific, not generic.
   - Include the source URL in markdown format: [domain.com](url)
3. End with a one-line pattern observation or takeaway (what ties these stories together)
4. End with 3-5 relevant hashtags

**STYLE GUIDELINES:**
- Be opinionated and insightful, not just reporting facts
- Each story description should explain the "so what" — why should the reader care
- Use conversational, professional tone
- Keep it scannable — readers should get the gist in 10 seconds
- Don't use emojis excessively (0-2 max)
- ONLY use URLs from the search results provided. NEVER fabricate URLs.
${platform?.toUpperCase() === 'TWITTER' || platform?.toUpperCase() === 'X'
    ? '\n**PLATFORM:** Twitter/X — Keep total post under 270 characters. You may need to reduce to 2-3 stories max.'
    : '\n**PLATFORM:** LinkedIn — Keep total post under 2800 characters.'}

${additionalContext ? `\n**ADDITIONAL INSTRUCTIONS:** ${additionalContext}` : ''}

**RESPONSE FORMAT:**
Return a JSON object:
{
    "content": "The full formatted post text ready to publish",
    "stories": [
        {
            "headline": "Story headline",
            "summary": "Brief description",
            "url": "https://actual-source-url.com/article"
        }
    ]
}

**CRITICAL:**
- Return ONLY valid JSON. No markdown blocks, no explanations.
- Use ONLY real URLs from the search results.
- Select stories by IMPACT and RELEVANCE, not just recency.
- Stories should be diverse — don't pick 3 stories about the same sub-topic.`;

        const userPrompt = `Here are the web search results from the past week for the topics: ${topics.join(', ')}

${searchContext}

Curate the ${storyCount} biggest, most impactful stories from these results into a weekly digest post. Pick stories that would resonate with a professional audience interested in these topics.`;

        console.log(`[AIService] Weekly Digest: sending ${allResults.reduce((sum, r) => sum + r.results.length, 0)} search results to LLM for curation`);

        const response = await this.callOpenRouter(config, SYSTEM_PROMPT, userPrompt, false);

        let content: string;
        let stories: Array<{ headline: string; summary: string; url: string }> = [];

        try {
            const parsed = this.extractAndParseJson(response);
            content = parsed.content || response;
            stories = Array.isArray(parsed.stories) ? parsed.stories : [];
        } catch (e: any) {
            console.error('[AIService] Failed to parse weekly digest response, returning raw:', e.message);
            content = response;
        }

        // Save to history
        const digest = await WeeklyDigest.create({
            tenantId,
            content,
            topics: JSON.stringify(topics),
            stories: JSON.stringify(stories),
            platform: platform || 'linkedin',
            storyCount,
            status: 'GENERATED',
        });

        return { content, stories, digestId: digest.id };
    }

    static async enhanceIdeaDescription(tenantId: string, title: string, description: string): Promise<string> {
        const SYSTEM_PROMPT = `
            You are an expert content strategist. Your goal is to create a **Content Brief/Outline** for a future LinkedIn post.

            **STRICT RULES:**
            1. **DO NOT** write the actual LinkedIn post.
            2. **DO NOT** use "Hook", "CTA", or emojis typical of a final post.
            3. **DO NOT** change the original intent. If the idea is specific (e.g., "analyze this link"), keep that specific instruction.

            **Your Task:**
            Take the user's raw thoughts and expand them into a structured set of notes. Flesh out the arguments, add necessary context, and structure the logic.

            **Output Format:**
            - **Core Concept:** [Clear, 1-sentence summary of the idea]
            - **Key Points to Cover:**
              - [Point 1: Expanded reasoning]
              - [Point 2: Evidence or context]
              - [Point 3: Why this matters]
            - **Suggested Angle:** [Professional, Storytelling, Contrarian, etc.]

            Return ONLY this structured brief.
        `;

        const userContent = `
            Idea Title: ${title}
            Raw Notes:
            "${description}"
        `;

        const config = await this.getUnifiedConfig(tenantId);
        return this.callOpenRouter(config, SYSTEM_PROMPT, userContent);
    }

    private static async gatherContextFromLinks(links: string[]): Promise<string> {
        if (links.length === 0) return '';
        const linkContents = await Promise.all(links.map(async (link: string) => {
            if (!link) return '';
            try {
                const response = await axios.get(link, { timeout: 10000 });
                let text = response.data;
                if (typeof text !== 'string') text = JSON.stringify(text);

                // Try Readability for clean article extraction (dynamic import to avoid ESM issues)
                try {
                    const { JSDOM } = await import('jsdom');
                    const { Readability } = await import('@mozilla/readability');
                    const dom = new JSDOM(text, { url: link });
                    const reader = new Readability(dom.window.document);
                    const article = reader.parse();
                    if (article && article.textContent) {
                        const cleanText = article.textContent.replace(/\s+/g, " ").trim();
                        return `[Content from ${link}]:\n${cleanText.substring(0, 2000)}...\n`;
                    }
                } catch (readabilityErr) {
                    // Fall through to regex fallback
                }

                // Fallback: regex-based HTML stripping
                text = text.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gm, "");
                text = text.replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gm, "");
                text = text.replace(/<[^>]+>/g, "\n");
                text = text.replace(/\s+/g, " ").trim();
                return `[Content from ${link}]:\n${text.substring(0, 2000)}...\n`;
            } catch (err: any) {
                console.error(`[AIService] Failed to fetch context from ${link}:`, err.message);
                return `[Failed to fetch content from ${link}]\n`;
            }
        }));
        return '\n\nAdditional Context from Reference Links:\n' + linkContents.join('\n');
    }

    private static async gatherContextFromAttachments(attachments: any[]): Promise<string> {
        if (attachments.length === 0) return '';
        const attachmentContents = await Promise.all(attachments.map(async (att: any) => {
            if (!att.url) return '';
            try {
                const relativePath = att.url.startsWith('/') ? att.url.slice(1) : att.url;
                const absolutePath = path.join(process.cwd(), relativePath);

                if (fs.existsSync(absolutePath)) {
                    const ext = path.extname(att.name).toLowerCase();
                    if (['.md', '.txt'].includes(ext)) {
                        const text = fs.readFileSync(absolutePath, 'utf8');
                        return `[Content from Attachment: ${att.name}]:\n${text.substring(0, 5000)}...\n`;
                    } else {
                        return `[Attachment ${att.name} is not a text file, skipping content extraction]\n`;
                    }
                } else {
                    return `[Attachment ${att.name} not found on server]\n`;
                }
            } catch (err: any) {
                console.error(`[AIService] Failed to read attachment ${att.name}:`, err.message);
                return `[Failed to read attachment ${att.name}]\n`;
            }
        }));
        return '\n\nAdditional Context from Attachments:\n' + attachmentContents.join('\n');
    }

    static async generateForIdea(
        tenantId: string,
        idea: Idea,
        platform: string = 'LinkedIn',
        additionalContext?: string,
        postId?: number
    ): Promise<{ content: string; summary: string }> {
        // Build a structured, rich prompt from all idea metadata
        const tags = JSON.parse(idea.tags || '[]');
        const links = JSON.parse(idea.sourceLinks || '[]');
        const attachments = JSON.parse(idea.attachments || '[]');

        let prompt = `Create a ${platform} post based on the following creative brief.\n\n`;
        prompt += `**Idea Title:** ${idea.title}\n`;

        if (idea.description) {
            prompt += `\n**Creative Brief / Description:**\n${idea.description}\n`;
            prompt += `\nIMPORTANT: The description above contains the creative direction — specific angles, story arcs, examples, and framing instructions. Follow them closely. Pick ONE specific angle from the description if multiple are listed.\n`;
        }

        if (tags.length > 0) {
            prompt += `\n**Topic Tags:** ${tags.join(', ')}\n`;
        }

        const contextFromLinks = await this.gatherContextFromLinks(links);
        const contextFromAttachments = await this.gatherContextFromAttachments(attachments);

        if (contextFromLinks) {
            prompt += `\n**Reference Material (use to add depth, specifics, and credibility — cite insights but do NOT summarize the entire article):**${contextFromLinks}\n`;
        }
        if (contextFromAttachments) {
            prompt += `\n**Attached Reference Material:**${contextFromAttachments}\n`;
        }

        const fullPrompt = prompt;
        const config = await this.getUnifiedConfig(tenantId, idea.authorUrn);

        // Parse existing summaries — supports both old format (string[]) and new format ({summary, postId}[])
        let existingEntries: { summary: string; postId?: number }[] = [];
        try {
            const raw = JSON.parse(idea.generatedSummaries || '[]');
            existingEntries = raw.map((entry: any) =>
                typeof entry === 'string' ? { summary: entry } : entry
            );
        } catch (e) {
            existingEntries = [];
        }

        const previousSummaries = existingEntries.map(e => e.summary);

        const { content, summary } = await this.generate(
            tenantId,
            fullPrompt,
            idea.targetAudience || undefined,
            previousSummaries,
            additionalContext,
            idea.authorUrn || undefined,
            idea.postShape || undefined,
            idea.effortLevel || undefined,
            idea.keyTakeaway || undefined,
            idea.antiGoals || undefined,
            undefined,
            platform
        );

        if (summary && summary !== "Summary parsing failed") {
            const newEntry = { summary, postId: postId || undefined };
            const newEntries = config.maxHistoryItems > 0
                ? [...existingEntries, newEntry].slice(-config.maxHistoryItems)
                : [];
            idea.generatedSummaries = JSON.stringify(newEntries);
            idea.lastGeneratedAt = new Date();
            await idea.save();
        }

        return { content, summary };
    }
}
