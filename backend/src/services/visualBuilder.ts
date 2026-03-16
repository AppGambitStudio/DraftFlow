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
        promptHint: `Create a visually striking infographic layout with this exact structure:

LAYOUT STRUCTURE:
1. HEADER ZONE (top 15-20%): Hero headline (42-52px, weight 900) + subtitle line in muted color
2. CONTENT ZONE (middle 60-70%): 3-5 key points in a card grid or stacked card layout
   - Each point: colored icon circle (left) + bold title + 1-line description
   - Cards have #1e293b background, 16px border-radius, 4px left accent border in different colors
   - Use a different accent color for each card: blue, green, amber, purple, pink
3. FOOTER ZONE (bottom 10-15%): Gradient banner with the core takeaway or CTA

CONTENT STRATEGY:
- Extract the MOST IMPORTANT 3-5 points — don't try to fit everything
- Each point title should be 3-6 words max, description 8-15 words max
- If content has numbers/stats, highlight them in accent color within the cards`,
    },
    comparison: {
        key: 'comparison',
        name: 'Before vs After',
        description: 'Two-column comparison layout',
        icon: '⚡',
        promptHint: `Create a side-by-side comparison layout with this exact structure:

LAYOUT STRUCTURE:
1. HEADER ZONE (top 15%): Bold headline + subtitle
2. COMPARISON ZONE (middle 65-70%): Two columns side by side with a gap
   - LEFT column: "BEFORE" badge (red/orange gradient), items with ✕ markers in red circles
   - RIGHT column: "NOW" or "AFTER" badge (green/blue gradient), items with ✓ markers in green circles
   - Each column: #1e293b card background with colored border (red-tinted left, green-tinted right)
   - 3-4 items per column, each item: icon dot + short text (10-15 words max per item)
3. FOOTER ZONE (bottom 15%): Gradient banner with the key conclusion

CONTENT STRATEGY:
- If the content has a natural before/after or problem/solution, use it directly
- If not, reframe the content as old-way vs new-way or challenge vs solution
- Keep items SHORT — the visual impact comes from the contrast, not the detail`,
    },
    checklist: {
        key: 'checklist',
        name: 'Checklist',
        description: 'Visual checklist with markers',
        icon: '✅',
        promptHint: `Create a visual checklist layout with this exact structure:

LAYOUT STRUCTURE:
1. HEADER ZONE (top 15%): Bold headline + optional context line
2. CHECKLIST ZONE (middle 75%): Stacked items, each in its own row
   - Each item: colored number badge or checkmark circle (left) + title (bold) + brief description
   - Use alternating subtle background tones (#1e293b and transparent) for visual rhythm
   - Left accent border (4px) with rotating colors: blue, green, purple, amber
   - Items should have equal height and consistent spacing (16-20px gap)
3. FOOTER (bottom 10%): Subtle gradient line or muted CTA text

CONTENT STRATEGY:
- Extract 4-6 actionable items or key points
- Each item title: 3-6 words, bold
- Each item description: single line, 10-18 words max
- Number badges should be 32-36px circles with gradient backgrounds`,
    },
    'quote-card': {
        key: 'quote-card',
        name: 'Quote Card',
        description: 'Large quote, minimal design',
        icon: '💬',
        promptHint: `Create an elegant, minimal quote card with this exact structure:

LAYOUT STRUCTURE:
1. Full-height centered layout with generous padding (60-80px)
2. Large opening quotation mark — oversized (120-160px) in accent color at ~10% opacity, positioned as decorative background element
3. QUOTE TEXT: The most impactful 1-2 sentences, displayed in 28-36px, weight 600-700, line-height 1.4
4. DIVIDER: Thin gradient accent line (80-120px wide, 3px tall) below the quote
5. ATTRIBUTION: Author/source in 16px muted text below the divider
6. ACCENT: Subtle vertical gradient bar (4-6px) on the left side spanning 60% of the height

CONTENT STRATEGY:
- Pick the SINGLE most powerful, quotable sentence from the content
- If no clear quote exists, distill the core message into one punchy statement
- Less is more — the power comes from whitespace and typography, not density
- Background can have a very subtle radial gradient for depth`,
    },
    stats: {
        key: 'stats',
        name: 'Stats & Numbers',
        description: 'Big numbers with supporting context',
        icon: '📈',
        promptHint: `Create a data-focused stats layout with this exact structure:

LAYOUT STRUCTURE:
1. HEADER ZONE (top 20%): Bold headline + context subtitle
2. STATS GRID (middle 55-60%): 2-4 stat cards in a row or 2x2 grid
   - Each stat card: #1e293b background, 16px border-radius
   - Large number (48-64px, weight 900) in accent color (each card different color)
   - Unit/label below the number (14px, uppercase, muted)
   - Brief context line (16px, #e2e8f0)
   - Top border: 4px gradient accent matching the number color
3. FOOTER ZONE (bottom 15-20%): Takeaway banner with gradient background

CONTENT STRATEGY:
- Extract ALL numbers, percentages, and metrics from the content
- If content has fewer than 2 numbers, derive meaningful stats (e.g., count of steps, key metrics implied)
- Numbers should be the HERO — they should be the first thing the eye sees
- Each number: use a different accent color (blue, green, amber, purple)`,
    },
    steps: {
        key: 'steps',
        name: 'Step-by-Step',
        description: 'Numbered steps with visual flow',
        icon: '🔢',
        promptHint: `Create a step-by-step process layout with this exact structure:

LAYOUT STRUCTURE:
1. HEADER ZONE (top 15%): Bold headline + context line
2. STEPS ZONE (middle 75%): Vertical or horizontal flow of 3-5 steps
   - Each step: large numbered circle (40-48px, gradient background) + title (bold, 20px) + description (16px, muted)
   - Steps connected by a thin line (2px, #334155) or arrow between them
   - For vertical: steps stacked with connecting line on the left
   - For horizontal (if 3 steps): side by side with arrows between
   - Number circles should use gradient backgrounds cycling through accent colors
3. RESULT/FOOTER (bottom 10%): Final outcome badge or gradient banner

CONTENT STRATEGY:
- Extract 3-5 sequential steps (if content has more, consolidate)
- Step titles: 3-5 words max
- Step descriptions: 1 line, 10-15 words max
- If content isn't naturally sequential, organize by priority or logical flow`,
    },
};

// --- Size Presets ---

const SIZE_PRESETS: Record<string, { width: number; height: number | 'auto' }> = {
    landscape: { width: 1200, height: 628 },
    square: { width: 1080, height: 1080 },
    portrait: { width: 1080, height: 1350 },
    auto: { width: 1200, height: 'auto' },
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
        const sizePreset = (SIZE_PRESETS[sizeKey] ?? SIZE_PRESETS.landscape)!;
        const isAutoHeight = sizePreset.height === 'auto';

        // For auto-height, pass a generous height to the prompt but render dynamically
        const promptDimensions = {
            width: sizePreset.width,
            height: isAutoHeight ? 0 : sizePreset.height as number,
        };

        // Step 1: Generate HTML via AI
        const html = await this.generateVisualHTML(tenantId, content, template, promptDimensions, isAutoHeight);

        // Step 2: Render HTML to PNG
        const renderDimensions = {
            width: sizePreset.width,
            height: isAutoHeight ? 0 : sizePreset.height as number,
        };
        const result = await this.renderToImage(html, renderDimensions, isAutoHeight);

        return { ...result, html };
    }

    /**
     * Render provided HTML to PNG (for re-renders without AI).
     */
    static async renderOnly(
        html: string,
        sizeKey: string = 'landscape'
    ): Promise<{ imageUrl: string; name: string; type: string; size: number }> {
        const sizePreset = (SIZE_PRESETS[sizeKey] ?? SIZE_PRESETS.landscape)!;
        const isAutoHeight = sizePreset.height === 'auto';
        const dimensions = { width: sizePreset.width, height: isAutoHeight ? 0 : sizePreset.height as number };
        return this.renderToImage(html, dimensions, isAutoHeight);
    }

    private static buildSystemPrompt(
        template: VisualTemplate,
        dimensions: { width: number; height: number },
        isAutoHeight: boolean = false
    ): string {
        return `You are a world-class visual content designer who creates premium HTML infographics for LinkedIn and Twitter. Your designs rival those from top design agencies.

TASK: Generate a self-contained HTML document that renders as a visually stunning, publication-quality image.

## STRICT TECHNICAL REQUIREMENTS
1. Output ONLY the raw HTML — no explanation, no markdown fences, no commentary
2. Complete HTML document: <!DOCTYPE html>, <html>, <head> with <style>, <body>
3. ALL CSS must be in a <style> tag — no external stylesheets
4. Body must be exactly ${dimensions.width}px × ${dimensions.height}px with overflow: hidden
5. Add <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet"> in <head>
6. NO external images, JavaScript, or other external resources
7. ALL visual elements must be CSS-only (borders, backgrounds, gradients, shadows, pseudo-elements)

## MANDATORY CSS (COPY EXACTLY)
${isAutoHeight ? `\`\`\`
* { box-sizing: border-box; }
body { margin: 0; padding: 0; width: ${dimensions.width}px; }
.container { width: ${dimensions.width}px; padding: 40px; display: flex; flex-direction: column; }
\`\`\`
You MUST use a single .container div as the root element inside <body>.
AUTO-HEIGHT MODE: The height is flexible — include ALL content. Do NOT set a fixed height on body or .container. Let the content determine the height naturally. Still maintain good spacing and design quality.` : `\`\`\`
* { box-sizing: border-box; }
body { margin: 0; padding: 0; width: ${dimensions.width}px; height: ${dimensions.height}px; overflow: hidden; }
.container { width: ${dimensions.width}px; height: ${dimensions.height}px; overflow: hidden; padding: 40px; display: flex; flex-direction: column; }
\`\`\`
You MUST use a single .container div as the root element inside <body>. This ensures nothing escapes the frame.
Use flex-shrink, flex-grow, and overflow:hidden on child sections so content compresses rather than overflows.`}

## DESIGN SYSTEM (MUST FOLLOW)

### Color Palette
- Background: #0f172a (primary), #1e293b (cards/sections), #334155 (subtle borders)
- Text: #ffffff (headlines), #f1f5f9 (body), #94a3b8 (secondary/muted)
- Accents: #3b82f6 (blue), #10b981 (green), #f59e0b (amber), #ef4444 (red), #8b5cf6 (purple), #ec4899 (pink)
- Gradients: Use linear-gradient for accent elements — e.g., linear-gradient(135deg, #3b82f6, #8b5cf6)

### Typography Scale
- Hero headline: 42-56px, font-weight: 900, letter-spacing: -0.03em, line-height: 1.1
- Section headline: 24-32px, font-weight: 700
- Body text: 17-20px, font-weight: 400-500, line-height: 1.5
- Labels/badges: 11-13px, font-weight: 700, text-transform: uppercase, letter-spacing: 1.5px
- Font family: 'Inter', system-ui, sans-serif (ALWAYS)

### Spacing & Layout
- Container padding: 40-48px on all sides
- Section gaps: 24-32px between major sections
- Card padding: 24-32px internal padding
- Never let text touch edges — minimum 32px from any edge
- Use flexbox for all layouts — no floats or tables

### Visual Elements
- Cards: background #1e293b, border-radius: 16px, border: 1px solid rgba(255,255,255,0.06)
- Badges/labels: border-radius: 24px, padding: 6px 16px, bold uppercase text
- Accent bars: 4px wide colored left borders on cards, or gradient top borders
- Dividers: 1px solid rgba(255,255,255,0.08)
- Shadows: box-shadow: 0 8px 32px rgba(0,0,0,0.3) for elevated elements
- Icons: Use Unicode symbols (●, ▶, ✓, ✕, →, ★, ◆, ▸, ⚡, ⬤) styled with accent colors
- Subtle background patterns: Use radial-gradient or repeating elements for depth

### Quality Rules (CRITICAL)
${isAutoHeight ? `- AUTO-HEIGHT: Include all content — the image height will adjust. Still maintain clean design, spacing, and visual hierarchy. Do not set fixed heights.` : `- **NO OVERFLOW — THIS IS THE #1 RULE**: ALL content MUST fit within ${dimensions.width}x${dimensions.height}px. If you have too many items, REMOVE items until it fits. 3 well-designed items are better than 5 clipped ones. Test mentally: add up your padding, headline height, item heights, gaps, and footer — if the total exceeds ${dimensions.height}px, you MUST cut content.
- For landscape (1200x628): max 3-4 content items with comfortable spacing
- For square (1080x1080): max 5-6 content items
- For portrait (1080x1350): max 6-8 content items
- USE FLEX SHRINK: Set flex-shrink:1 and overflow:hidden on the content zone so it compresses gracefully if needed`}
- HIERARCHY: The headline must be the dominant visual element. Use size, weight, and color to create clear visual hierarchy.
- BREATHING ROOM: When in doubt, use fewer words and more whitespace. Dense text walls are a failure.
- CONTRAST: Ensure WCAG AA contrast ratios. Light text on dark backgrounds must be clearly readable.
- BALANCE: The layout should feel visually balanced. Don't pile everything at the top.
- POLISH: Add subtle details — gradient overlays, soft shadows, rounded corners, accent lines — that elevate the design from "functional" to "premium".
- EXTRACT, DON'T DUMP: Analyze the post content and extract the key message, data points, or structure. Transform it into a visual — don't just render the raw text.
- TRUNCATE IF NEEDED: If the content is very long, focus on the 3-4 most impactful points. It's better to show less with beautiful design than everything in a cramped layout.

## TEMPLATE: "${template.name}"
${template.promptHint}

## REFERENCE EXAMPLE (study the CSS quality and structure)
Here is a minimal example showing the expected quality level for a comparison template:
\`\`\`html
<!DOCTYPE html>
<html><head>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>
body { margin:0; padding:0; width:1200px; height:628px; overflow:hidden; font-family:'Inter',system-ui,sans-serif; background:#0f172a; color:#f1f5f9; }
.wrap { padding:44px; height:100%; box-sizing:border-box; display:flex; flex-direction:column; }
h1 { font-size:48px; font-weight:900; color:#fff; margin:0 0 6px; letter-spacing:-0.03em; }
.sub { font-size:20px; color:#94a3b8; margin:0 0 28px; font-weight:500; }
.cols { display:flex; gap:24px; flex:1; position:relative; }
.col { flex:1; border-radius:16px; padding:28px; display:flex; flex-direction:column; }
.col-before { background:rgba(239,68,68,0.08); border:1.5px solid rgba(239,68,68,0.3); }
.col-after { background:rgba(16,185,129,0.08); border:1.5px solid rgba(16,185,129,0.3); }
.badge { display:inline-block; padding:6px 16px; border-radius:24px; font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:1.5px; margin-bottom:16px; width:fit-content; }
.badge-r { background:linear-gradient(90deg,#ef4444,#f97316); color:#fff; }
.badge-g { background:linear-gradient(90deg,#10b981,#3b82f6); color:#fff; }
.item { display:flex; gap:10px; margin-bottom:12px; font-size:16px; line-height:1.4; color:#e2e8f0; }
.dot { width:20px; height:20px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:12px; flex-shrink:0; margin-top:2px; }
.dot-r { background:rgba(239,68,68,0.15); color:#ef4444; }
.dot-g { background:rgba(16,185,129,0.15); color:#10b981; }
.footer { margin-top:24px; background:linear-gradient(90deg,#8b5cf6,#3b82f6,#10b981); border-radius:12px; padding:16px 32px; text-align:center; }
.footer-text { font-size:22px; font-weight:800; color:#fff; }
</style>
</head><body><div class="wrap">
<h1>Headline Here</h1>
<p class="sub">Subtitle or context line</p>
<div class="cols">
  <div class="col col-before">
    <div class="badge badge-r">Before</div>
    <div class="item"><div class="dot dot-r">✕</div><span>Point one</span></div>
    <div class="item"><div class="dot dot-r">✕</div><span>Point two</span></div>
  </div>
  <div class="col col-after">
    <div class="badge badge-g">After</div>
    <div class="item"><div class="dot dot-g">✓</div><span>Point one</span></div>
    <div class="item"><div class="dot dot-g">✓</div><span>Point two</span></div>
  </div>
</div>
<div class="footer"><span class="footer-text">Key takeaway line</span></div>
</div></body></html>
\`\`\`
Adapt this level of quality and CSS craftsmanship to whatever template you're building. The example above is for "comparison" — your output should match or exceed this quality for the "${template.name}" template.

DIMENSIONS: ${dimensions.width}px wide × ${dimensions.height}px tall`;
    }

    private static async generateVisualHTML(
        tenantId: string,
        content: string,
        template: VisualTemplate,
        dimensions: { width: number; height: number },
        isAutoHeight: boolean = false
    ): Promise<string> {
        const systemPrompt = this.buildSystemPrompt(template, dimensions, isAutoHeight);

        const userMessage = `Convert this social media post content into a "${template.name}" visual:\n\n${content}`;

        const response = await AIService.callForVisualBuilder(tenantId, systemPrompt, userMessage);

        // Strip markdown fences if AI wrapped the HTML
        let html = response.trim();
        html = html.replace(/^```html?\s*/i, '').replace(/\s*```$/i, '').trim();

        return html;
    }

    private static async renderToImage(
        html: string,
        dimensions: { width: number; height: number },
        isAutoHeight: boolean = false
    ): Promise<{ imageUrl: string; name: string; type: string; size: number }> {
        const uploadsDir = path.join(process.cwd(), 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const suffix = crypto.randomBytes(4).toString('hex');
        const filename = `visual-${Date.now()}-${suffix}.png`;
        const outputPath = path.join(uploadsDir, filename);

        const renderOptions: any = {
            output: outputPath,
            html,
            type: 'png',
            puppeteerArgs: {
                executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
                args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
                defaultViewport: {
                    width: dimensions.width,
                    height: isAutoHeight ? 800 : dimensions.height,
                    deviceScaleFactor: 2,
                },
            },
            content: {},
        };

        if (isAutoHeight) {
            // For auto-height, capture the full body (let it expand naturally)
            renderOptions.selector = 'body';
            renderOptions.beforeScreenshot = async (page: any) => {
                const bodyHeight = await page.evaluate(() => document.body.scrollHeight);
                await page.setViewport({
                    width: dimensions.width,
                    height: bodyHeight,
                    deviceScaleFactor: 2,
                });
            };
        } else {
            renderOptions.selector = 'body';
        }

        await nodeHtmlToImage(renderOptions);

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
