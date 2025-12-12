import axios from 'axios';
import { Settings } from '../db';

export class AIService {
    private static async getSettings(): Promise<{ apiKey: string | null, modelId: string | null }> {
        const settings = await Settings.findOne();
        return {
            apiKey: settings?.openRouterApiKey || null,
            modelId: settings?.openRouterModelId || null
        };
    }

    private static async callOpenRouter(systemPrompt: string, userContent: string): Promise<string> {
        const { apiKey, modelId } = await this.getSettings();
        if (!apiKey) {
            throw new Error('OpenRouter API Key not found. Please configure it in Settings.');
        }

        try {
            const response = await axios.post(
                'https://openrouter.ai/api/v1/chat/completions',
                {
                    model: modelId || 'anthropic/claude-sonnet-4.5',
                    "plugins": [{ "id": "web" }],
                    messages: [
                        {
                            role: 'system',
                            content: systemPrompt
                        },
                        {
                            role: 'user',
                            content: userContent
                        }
                    ]
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'http://localhost:3000', // Required by OpenRouter
                        'X-Title': 'LinkedIn Post Scheduler', // Required by OpenRouter
                    }
                }
            );

            return response.data.choices[0].message.content.trim();
        } catch (error: any) {
            console.error('AI Service Error:', error.response?.data || error.message);
            throw new Error('Failed to generate AI response: ' + (error.response?.data?.error?.message || error.message));
        }
    }

    static async improvise(content: string, targetAudience?: string): Promise<string> {
        let SYSTEM_PROMPT = `
            You are an expert LinkedIn content editor specializing in software development, cloud technologies, and AI content.

Your task is to refine and enhance an existing LinkedIn post draft while preserving the author's core message and voice.
`;

        if (targetAudience) {
            SYSTEM_PROMPT += `\n**Target Audience:** ${targetAudience}\nEnsure the tone, complexity, and value proposition resonate specifically with this audience.\n`;
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

**Do NOT:**
- Change the fundamental message or argument
- Add information that wasn't in the original
- Make it overly promotional or sales-y
- Remove the author's unique voice

Return ONLY the refined LinkedIn post, formatted and ready to publish. No explanations or meta-commentary.
`;
        return this.callOpenRouter(SYSTEM_PROMPT, `Improve this LinkedIn post:\n\n${content}`);
    }

    static async generate(prompt: string, targetAudience?: string, previousSummaries: string[] = []): Promise<{ content: string, summary: string }> {
        let SYSTEM_PROMPT = `
            You are an expert LinkedIn content strategist specializing in software development, cloud technologies, and AI.

Your task is to create a compelling, high-performing LinkedIn post from scratch based on the provided idea or topic.
`;

        if (targetAudience) {
            SYSTEM_PROMPT += `\n**Target Audience:** ${targetAudience}\nEnsure the content, examples, and takeaways are highly relevant to this group.\n`;
        }

        if (previousSummaries.length > 0) {
            SYSTEM_PROMPT += `
**Context to Avoid:**
The following are summaries of posts already generated for this idea. Do NOT generate similar content. Find a fresh angle, a different takeaway, or a unique perspective.
${previousSummaries.map((s, i) => `${i + 1}. ${s}`).join('\n')}
`;
        }

        SYSTEM_PROMPT += `
**Post Structure:**
1. **Hook (1-2 lines)** - Capture attention with a question, bold statement, surprising stat, or relatable pain point
2. **Context/Story (2-3 lines)** - Set up the problem, challenge, or opportunity
3. **Core Insight** - Your main message, perspective, or solution
4. **Value Delivery** - Provide actionable takeaways (3-5 bullet points when appropriate) or a mini-framework
5. **CTA** - Clear call-to-action (ask for comments, perspectives, or engagement)
6. **Hashtags** - 3-5 relevant tags at the end

**Content Angles to Consider:**
- Client transformation stories (problem → solution → results)
- Industry trends and what they mean for businesses
- Common misconceptions or myths in the space
- Cost optimization or ROI frameworks
- Security or compliance insights
- Lessons learned from implementations
- Future predictions with supporting reasoning

**Topics to Emphasize:**
Cloud migration strategies, cost optimization, AI/ML integration, security best practices, hybrid/multi-cloud architectures, digital transformation ROI, DevOps culture, scalability patterns, industry-specific solutions.

**Tone & Style:**
- Professional yet conversational (like a trusted advisor)
- Lead with business outcomes, not just technical features
- Use storytelling when possible (make it relatable)
- Balance technical credibility with accessibility
- Demonstrate expertise without being preachy
- Inject personality while maintaining authority

**Formatting Best Practices:**
- Use line breaks for scanability (1-2 sentences per paragraph)
- Emojis sparingly for visual breaks (1-3 maximum)
- Numbered lists or bullets for key points
- Keep total length 150-250 words (LinkedIn sweet spot)

**Engagement Optimization:**
- Start with something that makes people pause scrolling
- Include a perspective that sparks discussion
- Ask a question or request input in the CTA
- Make it shareable (valuable insights others want to pass along)

**Response Format:**
Return a JSON object with the following structure:
{
    "postContent": "The complete LinkedIn post content...",
    "summary": "A 3-5 line summary of the post's core message and angle...",
}
RETURN ONLY THE VALID JSON. NO MARKDOWN BLOCK.
        `;

        const response = await this.callOpenRouter(SYSTEM_PROMPT, prompt);

        try {
            // Attempt to parse JSON response. 
            // In case the model returns markdown code block, strip it.
            const cleanResponse = response.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(cleanResponse);
            return {
                content: parsed.postContent || parsed.content, // Fallback just in case
                summary: parsed.summary || "Summary not generated"
            };
        } catch (e) {
            console.error("Failed to parse AI response as JSON", response);
            // Fallback: assume the entire response is the post content
            return {
                content: response,
                summary: "Summary parsing failed" // Not ideal but keeps the feature working
            };
        }
    }
}
