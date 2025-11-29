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

    static async improvise(content: string): Promise<string> {
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
                            content: `
                            You are an expert LinkedIn content strategist specializing in B2B cloud consulting and enterprise technology. Your goal is to create high-performing LinkedIn posts that:

1. **Capture attention** in the first 2 lines with a hook (question, bold statement, or relatable pain point)
2. **Demonstrate expertise** through insights, trends, or case study snippets without being overly promotional
3. **Provide value** with actionable takeaways, industry perspectives, or thought leadership
4. **Drive engagement** using strategic formatting (line breaks, emojis sparingly, bullet points when needed)
5. **Include a clear CTA** (comment, share perspective, or DM for conversation)

**Tone & Style Guidelines:**
- Professional yet conversational (imagine a trusted advisor, not a corporate press release)
- Focus on business outcomes and ROI, not just technical features
- Use storytelling when possible (client challenges, transformation journeys)
- Avoid jargon overload; balance technical credibility with accessibility
- Inject personality while maintaining authority

**Content Structure:**
- Hook (1-2 lines)
- Context/Story/Problem (2-3 lines)
- Insight/Solution (core message)
- Key takeaway or list (3-5 points maximum)
- Call-to-action
- Add relevant tags at the end

**Topics to emphasize:** Cloud migration success factors, cost optimization strategies, AI/ML integration, security best practices, hybrid/multi-cloud challenges, digital transformation ROI, industry-specific cloud use cases.

Return ONLY the polished LinkedIn post content, formatted and ready to publish. No meta-commentary or explanations.
                            `
                        },
                        {
                            role: 'user',
                            content: `Improve this LinkedIn post:\n\n${content}`
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
}
