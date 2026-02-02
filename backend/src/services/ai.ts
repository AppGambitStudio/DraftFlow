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

        // Inject top-performing posts as style reference
        const topPosts = await this.getTopPerformingPosts(tenantId, authorUrn);
        if (topPosts.length > 0) {
            SYSTEM_PROMPT += `\n**HIGH-PERFORMING REFERENCE POSTS:** These posts performed well for this author. Study their style, structure, and hooks — but do NOT copy them.\n`;
            topPosts.forEach((post, i) => {
                SYSTEM_PROMPT += `[Example ${i + 1}]: ${post}\n`;
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

        // Top-performing posts as style reference
        const topPosts = await this.getTopPerformingPosts(tenantId, authorUrn);
        if (topPosts.length > 0) {
            SYSTEM_PROMPT += `\n**HIGH-PERFORMING REFERENCE POSTS:** These posts performed well for this author. Study their style, structure, and hooks — but do NOT copy them.\n`;
            topPosts.forEach((post, i) => {
                SYSTEM_PROMPT += `[Example ${i + 1}]: ${post}\n`;
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
                    const extraClean = cleanText
                        .replace(/\n/g, '\\n') // Escape actual newlines
                        .replace(/\r/g, '\\r')
                        .replace(/\t/g, '\\t')
                        .replace(/\\"/g, '"') // Unescape all quotes
                        .replace(/"/g, '\\"') // Escape all quotes
                        .replace(/^\\"/, '"') // Unescape first quote
                        .replace(/\\"$/, '"') // Unescape last quote
                        .replace(/\\":\\"/g, '":"') // Fix key-value separator
                        .replace(/\\",\\"/g, '","') // Fix comma separator
                        .replace(/{\\"/g, '{"') // Fix start
                        .replace(/\\"}/g, '"}'); // Fix end

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
