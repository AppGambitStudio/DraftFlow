import nodeHtmlToImage from 'node-html-to-image';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { AIService } from './ai';

// --- Template Definitions ---

export interface VisualTemplate {
    key: string;
    name: string;
    description: string;
    icon: string;
    promptHint: string;
}

export const TEMPLATES: Record<string, VisualTemplate> = {
    infographic: {
        key: 'infographic',
        name: 'Infographic',
        description: 'Key points with icons and accent colors',
        icon: '📊',
        promptHint: `Create a visually striking infographic layout:
- Large bold headline at the top
- Extract 3-5 key points from the content and display them with colored icon circles or emoji markers
- Use colored accent bars or gradients to separate sections
- Highlight any numbers, stats, or key terms in a larger/bolder font or accent color
- Add a subtle footer area with hashtags or source attribution if present`,
    },
    comparison: {
        key: 'comparison',
        name: 'Before vs After',
        description: 'Two-column comparison layout',
        icon: '⚡',
        promptHint: `Create a side-by-side comparison layout:
- Split the content into "BEFORE" (left, red/orange accent) and "NOW/AFTER" (right, green accent)
- Each side has a colored header label
- Use a divider or arrow between the two columns
- If the content doesn't have a natural before/after, create one from the core message (old way vs new way, problem vs solution)
- Include a brief conclusion or takeaway below the comparison`,
    },
    checklist: {
        key: 'checklist',
        name: 'Checklist',
        description: 'Visual checklist with markers',
        icon: '✅',
        promptHint: `Create a visual checklist or numbered list layout:
- Bold headline at top
- Extract actionable items or key points as checklist items
- Use colored checkmarks, numbers, or bullet markers
- Each item gets a short 1-2 line description
- Items should have subtle background cards or divider lines between them
- Use green checkmarks or colored number badges`,
    },
    'quote-card': {
        key: 'quote-card',
        name: 'Quote Card',
        description: 'Large quote, minimal design',
        icon: '💬',
        promptHint: `Create an elegant quote card:
- Extract the most impactful sentence or key message as the main quote
- Display the quote in large, elegant typography (use quotation marks)
- Minimal design — lots of whitespace
- Subtle accent line or gradient on one side
- Attribution or context line below the quote in smaller text
- Optional: a subtle pattern or gradient in the background`,
    },
    stats: {
        key: 'stats',
        name: 'Stats & Numbers',
        description: 'Big numbers with supporting context',
        icon: '📈',
        promptHint: `Create a stats/numbers-focused layout:
- Extract any numbers, percentages, metrics, or quantifiable claims from the content
- Display 2-4 key numbers in very large, bold font with accent colors
- Each number gets a short label/description below it
- If no explicit numbers exist, create compelling summary stats (e.g., "5 Key Takeaways", "3 Steps")
- Arrange in a grid or row layout
- Bold headline at top providing context`,
    },
    steps: {
        key: 'steps',
        name: 'Step-by-Step',
        description: 'Numbered steps with visual flow',
        icon: '🔢',
        promptHint: `Create a step-by-step guide layout:
- Bold headline at top
- Extract 3-6 sequential steps from the content
- Each step has a large colored number badge and a title + brief description
- Steps connected by a vertical line or arrow flow
- Use alternating subtle background shades for each step
- Conclusion or result at the bottom`,
    },
};

// --- Size Presets ---

const SIZE_PRESETS: Record<string, { width: number; height: number }> = {
    landscape: { width: 1200, height: 628 },
    square: { width: 1080, height: 1080 },
    portrait: { width: 1080, height: 1350 },
};

// --- Service ---

export class VisualBuilderService {
    /**
     * Generate HTML for the visual using AI, then render to PNG.
     */
    static async generate(
        tenantId: string,
        content: string,
        templateKey: string = 'infographic',
        sizeKey: string = 'landscape'
    ): Promise<{ imageUrl: string; html: string; name: string; type: string; size: number }> {
        const template = (TEMPLATES[templateKey] ?? TEMPLATES.infographic)!;
        const dimensions = (SIZE_PRESETS[sizeKey] ?? SIZE_PRESETS.landscape)!;

        // Step 1: Generate HTML via AI
        const html = await this.generateVisualHTML(tenantId, content, template, dimensions);

        // Step 2: Render HTML to PNG
        const result = await this.renderToImage(html, dimensions);

        return { ...result, html };
    }

    /**
     * Render provided HTML to PNG (for re-renders without AI).
     */
    static async renderOnly(
        html: string,
        sizeKey: string = 'landscape'
    ): Promise<{ imageUrl: string; name: string; type: string; size: number }> {
        const dimensions = (SIZE_PRESETS[sizeKey] ?? SIZE_PRESETS.landscape)!;
        return this.renderToImage(html, dimensions);
    }

    private static async generateVisualHTML(
        tenantId: string,
        content: string,
        template: VisualTemplate,
        dimensions: { width: number; height: number }
    ): Promise<string> {
        const systemPrompt = `You are a visual content designer who creates HTML infographics for social media.

TASK: Generate a self-contained HTML document that creates a visually striking image.

STRICT REQUIREMENTS:
1. Output ONLY the raw HTML — no explanation, no markdown fences, no commentary
2. Complete HTML document: <!DOCTYPE html>, <html>, <head> with <style>, <body>
3. ALL CSS must be in a <style> tag — no external stylesheets
4. The <body> must render at exactly ${dimensions.width}px × ${dimensions.height}px with overflow hidden
5. Use a dark theme: background #0f172a (dark navy), text in #f1f5f9 (light gray) and #ffffff
6. Accent colors: use vibrant gradients or solid accents (#3b82f6 blue, #10b981 green, #f59e0b amber, #ef4444 red, #8b5cf6 purple)
7. Typography: use font-family: 'Inter', 'Segoe UI', system-ui, sans-serif
8. Add <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap" rel="stylesheet"> in <head>
9. NO external images, JavaScript, or other external resources
10. Use CSS for all visual elements (borders, backgrounds, gradients, shadows, border-radius)
11. Ensure text is readable — minimum 16px body text, 28px+ for headlines
12. Add padding (32-48px) so content doesn't touch edges

VISUAL STYLE:
- Clean, modern, professional
- Subtle gradients and shadows for depth
- Rounded corners (8-16px) on cards and containers
- Good whitespace between elements
- Use Unicode symbols or CSS shapes for icons (●, ▶, ✓, →, ★, etc.)

TEMPLATE: "${template.name}"
${template.promptHint}

DIMENSIONS: ${dimensions.width}px wide × ${dimensions.height}px tall

Set this on the body:
body { margin: 0; padding: 0; width: ${dimensions.width}px; height: ${dimensions.height}px; overflow: hidden; }`;

        const userMessage = `Convert this social media post content into a "${template.name}" visual:\n\n${content}`;

        const response = await AIService.callForVisualBuilder(tenantId, systemPrompt, userMessage);

        // Strip markdown fences if AI wrapped the HTML
        let html = response.trim();
        html = html.replace(/^```html?\s*/i, '').replace(/\s*```$/i, '').trim();

        return html;
    }

    private static async renderToImage(
        html: string,
        dimensions: { width: number; height: number }
    ): Promise<{ imageUrl: string; name: string; type: string; size: number }> {
        const uploadsDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const suffix = crypto.randomBytes(4).toString('hex');
        const filename = `visual-${Date.now()}-${suffix}.png`;
        const outputPath = path.join(uploadsDir, filename);

        await nodeHtmlToImage({
            output: outputPath,
            html,
            type: 'png',
            puppeteerArgs: {
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
            },
            content: {},
            selector: 'body',
        } as any);

        const stat = fs.statSync(outputPath);

        console.log(`[VisualBuilder] Rendered ${filename} (${stat.size} bytes)`);

        return {
            imageUrl: `/uploads/${filename}`,
            name: filename,
            type: 'image/png',
            size: stat.size,
        };
    }
}
