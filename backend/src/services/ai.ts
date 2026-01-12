import axios from 'axios';
import { Settings, Idea } from '../db';
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

    static async improvise(tenantId: string, content: string, authorUrn?: string, targetAudience?: string, manualToneOverride?: string): Promise<string> {
        const config = await this.getUnifiedConfig(tenantId, authorUrn);

        let SYSTEM_PROMPT = config.aiPersona || `You are an expert LinkedIn content editor specializing in software development, cloud technologies, and AI content.`;
        SYSTEM_PROMPT += `\n\nYour task is to refine and enhance an existing LinkedIn post draft while preserving the author's core message and voice. If first line has the exact instructions from the author, then follow them.\n`;

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
- Professional yet conversational
- Trusted advisor, not corporate spokesperson
- Focus on outcomes and ROI
- Inject personality while maintaining authority
- Keep the language simple and easy to understand even for non-technical audience

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
        manualToneOverride?: string
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

        SYSTEM_PROMPT += `\n### CONTENT STRATEGY ###\n`;

        const effectiveTone = manualToneOverride || config.toneInstructions;
        if (effectiveTone) {
            SYSTEM_PROMPT += `\n**TONE & WRITING STYLE:**\n${effectiveTone}\n`;
        }
        if (postShape) {
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

        if (effortLevel) {
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
**Context to Avoid: **
The following are summaries of posts already generated for this idea. Do NOT generate similar content. Find a fresh angle, a different takeaway, or a unique perspective.
${previousSummaries.map((s, i) => `${i + 1}. ${s}`).join('\n')}
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

**Tone & Style (Default)**:
- Professional yet conversational (like a smart colleague, not a textbook).
- Authentic and human (avoid corporate jargon like "synergy" or "paradigm shift").
- Confident but humble (share expertise without arrogance).
*(Note: If specific "Tone Instructions" were provided above, they override these defaults.)*

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
    "postContent": "The complete LinkedIn post content...",
    "summary": "A 3-5 line summary of the post's core message and angle...",
}
RETURN ONLY THE VALID JSON. NO MARKDOWN BLOCK.
`;

        const response = await this.callOpenRouter(config, SYSTEM_PROMPT, prompt);

        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("No JSON object found in response");
            const cleanResponse = jsonMatch[0];
            const parsed = JSON.parse(cleanResponse);
            return {
                content: parsed.postContent || parsed.content,
                summary: parsed.summary || "Summary not generated"
            };
        } catch (e) {
            console.error("[AIService] Failed to parse AI response as JSON. Raw response:", response);
            return {
                content: response,
                summary: "Summary parsing failed"
            };
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
            idea.antiGoals || undefined
        );

        if (summary) {
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
