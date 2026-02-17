import axios from 'axios';
import { Settings, Idea, Post } from '../db';
import fs from 'fs';
import path from 'path';

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

    private static async callOpenRouter(config: AIContext, systemPrompt: string, userContent: string): Promise<string> {
        if (!config.apiKey) {
            throw new Error('OpenRouter API Key not found. Please configure it in Settings.');
        }

        try {
            const response = await axios.post(
                'https://openrouter.ai/api/v1/chat/completions',
                {
                    model: config.modelId || 'anthropic/claude-sonnet-4.5',
                    "plugins": [{ "id": "web" }],
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userContent }
                    ]
                },
                {
                    headers: {
                        'Authorization': `Bearer ${config.apiKey}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'http://localhost:3000',
                        'X-Title': 'LinkedIn Post Scheduler',
                    }
                }
            );

            return response.data.choices[0].message.content.trim();
        } catch (error: any) {
            console.error('AI Service Error:', error.response?.data || error.message);
            throw new Error('Failed to generate AI response: ' + (error.response?.data?.error?.message || error.message));
        }
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
                .map(p => p.content.substring(0, 300));
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

        if (targetAudience) {
            SYSTEM_PROMPT += `\n**Post Audience:** ${targetAudience}\nEnsure the tone, complexity, and value proposition resonate specifically with this audience.\n`;
        }

        const effectiveTone = manualToneOverride || config.toneInstructions;
        if (effectiveTone) {
            SYSTEM_PROMPT += `\n**Tone & Writing Style Instructions:**\n${effectiveTone}\nYou MUST strictly follow these specific style guidelines.\n`;
        }

        SYSTEM_PROMPT += `
**Your refinement should:**
1. **Strengthen the hook** - Make the first 2 lines more compelling (use questions, bold statements, or relatable pain points)
2. **Enhance clarity** - Simplify complex ideas without losing technical credibility
3. **Improve flow** - Ensure logical progression from hook → context → insight → takeaway → CTA
4. **Optimize formatting** - Add strategic line breaks, emojis (sparingly), and structure for readability
5. **Sharpen the CTA** - Make the call-to-action specific and engaging
6. **Maintain authenticity** - Keep the author's personality and perspective intact

**Keep these elements:**
- The original core message and key points
- The author's unique perspective or story
- Any specific examples, metrics, or anecdotes mentioned

**Enhance these elements:**
- Word choice for impact and professionalism
- Balance between technical depth and accessibility
- Engagement potential (without making it clickbait-y)
- Business value emphasis over pure technical features

**Tone Guidelines:**
${effectiveTone ? `**PRIMARY STYLE (STRICTLY FOLLOW):**\n${effectiveTone}` : `- Professional yet conversational\n- Trusted advisor, not corporate spokesperson\n- Focus on outcomes and ROI\n- Inject personality while maintaining authority\n- Keep the language simple and easy to understand even for non-technical audience`}

${(effectiveTone?.toLowerCase().includes('use "we"') || effectiveTone?.toLowerCase().includes('collective reference') || effectiveTone?.toLowerCase().includes('instead of "i"'))
                ? '**CRITICAL PERSPECTIVE RULE:** You MUST use "We" (collective reference) instead of "I" (individual reference) throughout the post. This is a hard constraint.'
                : ''}

**Do NOT:**
- Change the fundamental message or argument
- Add information that wasn't in the original
- Make it overly promotional or sales-y
- Remove the author's unique voice

Return ONLY the refined LinkedIn post, formatted and ready to publish. No explanations or meta-commentary.
`;

        console.log(`[AIService] Improving LinkedIn post:\n\n${content}`);

        return this.callOpenRouter(config, SYSTEM_PROMPT, `Improve this LinkedIn post:\n\n${content}`);
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
            SYSTEM_PROMPT += `\n**Mandatory Key Takeaway:**\nThe post MUST end with or clearly drive towards this conclusion: "${keyTakeaway}". Ensure the entire argument supports this final point.\n`;
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

        SYSTEM_PROMPT += `
**Post Structure Guidelines:**
Unless the "Post Shape" instruction above dictates otherwise, follow this high-level flow:
1. **Hook** - Grab attention immediately (0-2 seconds to read).
2. **Value/Body** - Deliver the core insight, story, or lesson clearly.
3. **Takeaway** - Summarize the "So what?" (Why does this matter?).
4. **CTA** - Encouraging engagement or reflection.

**Topics & Focus:**
- STRICTLY focus on the topics provided in the "Idea Title", "Core Concept", and "Tags".
- **Primary Anchor:** If "SPECIFIC USER INSTRUCTIONS" were provided above, they are your primary source of truth for the post's angle and content.
- Do NOT force unrelated topics unless they are part of the input.
- If the input is broad, narrow it down to the specific angle requested by the user.

**Tone & Style**:
${effectiveTone ? `**IMPORTANT: You MUST strictly follow these specific style guidelines:**\n${effectiveTone}` : `- Professional yet conversational (like a smart colleague, not a textbook).
- Authentic and human (avoid corporate jargon like "synergy" or "paradigm shift").
- Confident but humble (share expertise without arrogance).`}

${(effectiveTone?.toLowerCase().includes('use "we"') || effectiveTone?.toLowerCase().includes('collective reference') || effectiveTone?.toLowerCase().includes('instead of "i"'))
                ? '**CRITICAL PERSPECTIVE RULE:** You MUST use "We" (collective reference) instead of "I" (individual reference) throughout the post. This is a hard constraint.'
                : ''}

**Formatting Best Practices:**
- Use short paragraphs (1-3 lines max) for readability.
- Use bullet points or numbered lists to break down dense information.
- Use bold text **sparingly** to highlight key phrases (not entire sentences).
- Use clear visual breaks (white space).

**Engagement Optimization:**
- The first line must be a "scroll stopper".
- End with a question or a thought-provoking statement that invites comments.
- Focus on *value* for the reader—why should they care?

**Response Format:**
Return a JSON object with the following structure:
{
    "themeAnalysis": "A 1-sentence reflection: What core themes did I identify in previous posts, and what UNUSUAL angle will I take to avoid them?",
    "postContent": "The complete LinkedIn post content...",
    "summary": "A 2-line summary focusing ONLY on the specific technical/business unique angle used this time."
}
**CRITICAL:** 
1. RETURN ONLY THE VALID JSON. 
2. NO MARKDOWN BLOCKS (e.g., no \`\`\`json). 
3. NO CONVERSATIONAL FILLER. 
4. DO NOT include any text before or after the JSON.
5. If you include newlines in the postContent, you MUST escape them as "\\n" so the JSON remains valid.
`;


        console.log("[AIService] SYSTEM_PROMPT:", SYSTEM_PROMPT);
        console.log("[AIService] Prompt:", prompt);

        const response = await this.callOpenRouter(config, SYSTEM_PROMPT, prompt);

        try {
            const parsed = this.extractAndParseJson(response);
            return {
                content: parsed.postContent || parsed.content || response,
                summary: parsed.summary || "Summary generation failed or returned empty"
            };
        } catch (e: any) {
            console.error("[AIService] Failed to parse AI response as JSON:", e.message);
            // Fallback - try to extract anything that looks like a post if parsing fails
            return {
                content: response.length > 100 ? response : "Failed to generate valid post content.",
                summary: "Summary parsing failed"
            };
        }
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
        const response = await this.callOpenRouter(config, SYSTEM_PROMPT, `Generate ${count} content ideas now.`);

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
        const { industry, contentPillars, targetAudience, count = 5 } = params;

        // Include current date for accurate trending topics
        const currentDate = new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        let SYSTEM_PROMPT = `You are a social media trend analyst with expertise in identifying trending topics and conversations relevant to professional content creation.

**TODAY'S DATE:** ${currentDate}

Your task is to identify ${count} current trending topics that would be relevant for LinkedIn/Twitter content creation.

**IMPORTANT:** You have access to web search. Use it to find CURRENT trending topics, news, and discussions from the past 7 days (as of ${currentDate}). Search for recent news and trends.`;

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

        console.log('[AIService] Fetching trending topics');

        const userPrompt = `Search for and identify ${count} trending topics${industry ? ` in the ${industry} industry` : ''} that would make great professional content. Focus on what's happening as of ${currentDate} - search for news and discussions from the past 7 days. Include source URLs for each trend.`;

        const response = await this.callOpenRouter(config, SYSTEM_PROMPT, userPrompt);

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
        additionalContext?: string
    ): Promise<{ content: string; summary: string }> {
        const prompt = `
            Based on the following idea, write a professional and engaging ${platform} post.
            
            Title: ${idea.title}
            Description: ${idea.description}
            
            The post should be ready to publish, with appropriate hashtags.
        `;

        const links = JSON.parse(idea.sourceLinks || '[]');
        const attachments = JSON.parse(idea.attachments || '[]');

        const contextFromLinks = await this.gatherContextFromLinks(links);
        const contextFromAttachments = await this.gatherContextFromAttachments(attachments);

        const fullPrompt = prompt + contextFromLinks + contextFromAttachments;
        const config = await this.getUnifiedConfig(tenantId, idea.authorUrn);

        let previousSummaries: string[] = [];
        try {
            previousSummaries = JSON.parse(idea.generatedSummaries || '[]');
        } catch (e) {
            previousSummaries = [];
        }

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
            const newSummaries = config.maxHistoryItems > 0
                ? [...previousSummaries, summary].slice(-config.maxHistoryItems)
                : [];
            idea.generatedSummaries = JSON.stringify(newSummaries);
            idea.lastGeneratedAt = new Date();
            await idea.save();
        }

        return { content, summary };
    }
}
