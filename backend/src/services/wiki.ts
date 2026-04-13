import fs from 'fs';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { AIService } from './ai';

// ============================================================================
// Types
// ============================================================================

export interface WikiPage {
    slug: string;
    title: string;
    category: string;
    content: string;
    sources: string[];
    lastModified: Date;
}

export interface WikiPageSummary {
    slug: string;
    title: string;
    category: string;
    lastModified: Date;
}

export interface IngestSource {
    type: 'url' | 'text' | 'rss_item';
    content: string;
    title?: string;
    url?: string;
}

export interface WikiQueryResult {
    slug: string;
    title: string;
    excerpt: string;
    relevanceScore: number;
}

interface IngestPageAction {
    slug: string;
    title: string;
    category: string;
    content: string;
    action: 'create' | 'update';
}

// ============================================================================
// Helpers
// ============================================================================

const WIKI_BASE = path.join(process.cwd(), 'wiki');

function getWikiDir(tenantId: string): string {
    return path.join(WIKI_BASE, tenantId);
}

function titleToSlug(title: string): string {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .substring(0, 80);
}

function parseFrontmatter(raw: string): { meta: Record<string, any>; body: string } {
    const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!match) return { meta: {}, body: raw };

    const meta: Record<string, any> = {};
    for (const line of match[1]!.split('\n')) {
        const idx = line.indexOf(':');
        if (idx === -1) continue;
        const key = line.substring(0, idx).trim();
        let val: any = line.substring(idx + 1).trim();
        // Parse JSON arrays
        if (val.startsWith('[')) {
            try { val = JSON.parse(val); } catch { /* keep as string */ }
        }
        meta[key] = val;
    }
    return { meta, body: match[2] || '' };
}

function buildFrontmatter(meta: Record<string, any>): string {
    const lines = Object.entries(meta).map(([k, v]) => {
        const val = Array.isArray(v) ? JSON.stringify(v) : String(v);
        return `${k}: ${val}`;
    });
    return `---\n${lines.join('\n')}\n---\n`;
}

function extractTitle(content: string): string {
    const { body } = parseFrontmatter(content);
    const h1Match = body.match(/^#\s+(.+)$/m);
    return h1Match ? h1Match[1]!.trim() : 'Untitled';
}

// Simple per-tenant mutex to prevent concurrent writes to index/log
const tenantLocks = new Map<string, Promise<any>>();

function withLock<T>(tenantId: string, fn: () => Promise<T>): Promise<T> {
    const prev = tenantLocks.get(tenantId) || Promise.resolve();
    const next = prev.then(fn, fn);
    tenantLocks.set(tenantId, next);
    return next;
}

// ============================================================================
// WikiService
// ============================================================================

export class WikiService {

    /**
     * Initialize wiki directory for a tenant with index.md and log.md
     */
    static initTenantWiki(tenantId: string): void {
        const dir = getWikiDir(tenantId);
        fs.mkdirSync(dir, { recursive: true });

        const indexPath = path.join(dir, 'index.md');
        if (!fs.existsSync(indexPath)) {
            fs.writeFileSync(indexPath, `# Wiki Index\n\n_No pages yet. Ingest a source or create a page to get started._\n`);
        }

        const logPath = path.join(dir, 'log.md');
        if (!fs.existsSync(logPath)) {
            fs.writeFileSync(logPath, `# Activity Log\n\n`);
        }
    }

    /**
     * Get a single wiki page by slug
     */
    static getPage(tenantId: string, slug: string): WikiPage | null {
        const filePath = path.join(getWikiDir(tenantId), `${slug}.md`);
        if (!fs.existsSync(filePath)) return null;

        const raw = fs.readFileSync(filePath, 'utf-8');
        const { meta, body } = parseFrontmatter(raw);
        const stat = fs.statSync(filePath);

        return {
            slug,
            title: meta.title || extractTitle(raw),
            category: meta.category || 'uncategorized',
            content: body,
            sources: Array.isArray(meta.sources) ? meta.sources : [],
            lastModified: stat.mtime,
        };
    }

    /**
     * List all wiki pages (excluding index.md and log.md)
     */
    static listPages(tenantId: string): WikiPageSummary[] {
        const dir = getWikiDir(tenantId);
        if (!fs.existsSync(dir)) return [];

        const files = fs.readdirSync(dir).filter(
            f => f.endsWith('.md') && f !== 'index.md' && f !== 'log.md'
        );

        return files.map(f => {
            const slug = f.replace(/\.md$/, '');
            const filePath = path.join(dir, f);
            const raw = fs.readFileSync(filePath, 'utf-8');
            const { meta } = parseFrontmatter(raw);
            const stat = fs.statSync(filePath);

            return {
                slug,
                title: meta.title || extractTitle(raw),
                category: meta.category || 'uncategorized',
                lastModified: stat.mtime,
            };
        }).sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());
    }

    /**
     * Save (create or overwrite) a wiki page
     */
    static async savePage(
        tenantId: string,
        slug: string,
        content: string,
        category?: string,
        title?: string,
        sources?: string[],
        logAction: 'created' | 'updated' | 'edited' = 'edited'
    ): Promise<WikiPage> {
        return withLock(tenantId, async () => {
            this.initTenantWiki(tenantId);
            const dir = getWikiDir(tenantId);
            const filePath = path.join(dir, `${slug}.md`);

            const pageTitle = title || extractTitle(content) || slug;
            const meta: Record<string, any> = {
                title: pageTitle,
                category: category || 'uncategorized',
            };
            if (sources && sources.length > 0) {
                meta.sources = sources;
            }
            meta.lastIngested = new Date().toISOString().split('T')[0];

            const fullContent = buildFrontmatter(meta) + '\n' + content;
            fs.writeFileSync(filePath, fullContent, 'utf-8');

            this.updateIndex(tenantId);
            this.appendLog(tenantId, logAction, slug, pageTitle);

            const stat = fs.statSync(filePath);
            return {
                slug,
                title: pageTitle,
                category: meta.category,
                content,
                sources: sources || [],
                lastModified: stat.mtime,
            };
        });
    }

    /**
     * Delete a wiki page
     */
    static async deletePage(tenantId: string, slug: string): Promise<boolean> {
        return withLock(tenantId, async () => {
            const filePath = path.join(getWikiDir(tenantId), `${slug}.md`);
            if (!fs.existsSync(filePath)) return false;

            const raw = fs.readFileSync(filePath, 'utf-8');
            const title = extractTitle(raw);
            fs.unlinkSync(filePath);

            this.updateIndex(tenantId);
            this.appendLog(tenantId, 'deleted', slug, title);
            return true;
        });
    }

    /**
     * Regenerate index.md from all page files
     */
    static updateIndex(tenantId: string): void {
        const dir = getWikiDir(tenantId);
        const files = fs.readdirSync(dir).filter(
            f => f.endsWith('.md') && f !== 'index.md' && f !== 'log.md'
        );

        // Group by category
        const categories = new Map<string, Array<{ slug: string; title: string }>>();
        for (const f of files) {
            const slug = f.replace(/\.md$/, '');
            const raw = fs.readFileSync(path.join(dir, f), 'utf-8');
            const { meta } = parseFrontmatter(raw);
            const cat = meta.category || 'uncategorized';
            const title = meta.title || extractTitle(raw);

            if (!categories.has(cat)) categories.set(cat, []);
            categories.get(cat)!.push({ slug, title });
        }

        let indexContent = `# Wiki Index\n\n`;
        indexContent += `_${files.length} pages total_\n\n`;

        for (const [cat, pages] of Array.from(categories.entries()).sort()) {
            indexContent += `## ${cat.charAt(0).toUpperCase() + cat.slice(1)}\n\n`;
            for (const p of pages.sort((a, b) => a.title.localeCompare(b.title))) {
                indexContent += `- [${p.title}](${p.slug}.md)\n`;
            }
            indexContent += '\n';
        }

        fs.writeFileSync(path.join(dir, 'index.md'), indexContent, 'utf-8');
    }

    /**
     * Append an entry to log.md
     */
    static appendLog(tenantId: string, action: string, slug: string, title: string, source?: string): void {
        const dir = getWikiDir(tenantId);
        const logPath = path.join(dir, 'log.md');
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 16);
        const sourceInfo = source ? ` (source: ${source})` : '';
        const entry = `- [${timestamp}] **${action}** "${title}" (${slug})${sourceInfo}\n`;

        const existing = fs.readFileSync(logPath, 'utf-8');
        // Insert after the header line
        const headerEnd = existing.indexOf('\n\n');
        if (headerEnd !== -1) {
            const updated = existing.substring(0, headerEnd + 2) + entry + existing.substring(headerEnd + 2);
            fs.writeFileSync(logPath, updated, 'utf-8');
        } else {
            fs.appendFileSync(logPath, entry);
        }
    }

    /**
     * Get recent log entries
     */
    static getLog(tenantId: string, limit: number = 50): string[] {
        const logPath = path.join(getWikiDir(tenantId), 'log.md');
        if (!fs.existsSync(logPath)) return [];

        const content = fs.readFileSync(logPath, 'utf-8');
        const lines = content.split('\n').filter(l => l.startsWith('- ['));
        return lines.slice(0, limit);
    }

    /**
     * Get wiki stats
     */
    static getStats(tenantId: string): { pageCount: number; lastUpdated: Date | null; sourcesIngested: number } {
        const dir = getWikiDir(tenantId);
        if (!fs.existsSync(dir)) return { pageCount: 0, lastUpdated: null, sourcesIngested: 0 };

        const files = fs.readdirSync(dir).filter(
            f => f.endsWith('.md') && f !== 'index.md' && f !== 'log.md'
        );

        let lastUpdated: Date | null = null;
        for (const f of files) {
            const stat = fs.statSync(path.join(dir, f));
            if (!lastUpdated || stat.mtime > lastUpdated) lastUpdated = stat.mtime;
        }

        // Count ingestions from log
        const logEntries = this.getLog(tenantId, 9999);
        const ingestions = logEntries.filter(l => l.includes('**created**') || l.includes('**updated**')).length;

        return { pageCount: files.length, lastUpdated, sourcesIngested: ingestions };
    }

    /**
     * Keyword search across all wiki pages
     */
    static queryWiki(tenantId: string, query: string): { results: WikiQueryResult[]; totalPages: number } {
        const dir = getWikiDir(tenantId);
        if (!fs.existsSync(dir)) return { results: [], totalPages: 0 };

        const files = fs.readdirSync(dir).filter(
            f => f.endsWith('.md') && f !== 'index.md' && f !== 'log.md'
        );

        const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
        if (queryTerms.length === 0) return { results: [], totalPages: files.length };

        const scored: WikiQueryResult[] = [];

        for (const f of files) {
            const slug = f.replace(/\.md$/, '');
            const raw = fs.readFileSync(path.join(dir, f), 'utf-8');
            const { meta, body } = parseFrontmatter(raw);
            const title = meta.title || extractTitle(raw);
            const lowerBody = body.toLowerCase();
            const lowerTitle = title.toLowerCase();

            // Score: title matches worth 3x, body matches worth 1x
            let score = 0;
            for (const term of queryTerms) {
                if (lowerTitle.includes(term)) score += 3;
                // Count occurrences in body
                let idx = 0;
                while ((idx = lowerBody.indexOf(term, idx)) !== -1) {
                    score += 1;
                    idx += term.length;
                }
            }

            if (score > 0) {
                // Extract best excerpt — find the paragraph with most term matches
                const paragraphs = body.split(/\n\n+/).filter(p => p.trim().length > 20);
                let bestExcerpt = paragraphs[0] || body.substring(0, 300);
                let bestParagraphScore = 0;

                for (const para of paragraphs) {
                    const lp = para.toLowerCase();
                    let ps = 0;
                    for (const term of queryTerms) {
                        if (lp.includes(term)) ps++;
                    }
                    if (ps > bestParagraphScore) {
                        bestParagraphScore = ps;
                        bestExcerpt = para;
                    }
                }

                scored.push({
                    slug,
                    title,
                    excerpt: bestExcerpt.substring(0, 500),
                    relevanceScore: score,
                });
            }
        }

        scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

        return {
            results: scored.slice(0, 10),
            totalPages: files.length,
        };
    }

    /**
     * Ingest a source: fetch content, have LLM create/update wiki pages
     */
    static async ingestSource(
        tenantId: string,
        source: IngestSource
    ): Promise<{ pagesAffected: Array<{ slug: string; title: string; action: string }> }> {
        this.initTenantWiki(tenantId);

        // 1. Extract raw content
        let rawContent = '';
        let sourceUrl = source.url || '';

        if (source.type === 'url' && source.content) {
            // Fetch URL content
            try {
                const response = await axios.get(source.content, {
                    timeout: 15000,
                    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DraftFlow/1.0)' }
                });
                const $ = cheerio.load(response.data);
                $('script, style, noscript, nav, footer, header, aside, iframe').remove();
                const mainContent = $('article, main, .content, .post-content, .article-content').first();
                rawContent = (mainContent.length ? mainContent.text() : $('body').text())
                    .replace(/\s+/g, ' ')
                    .trim()
                    .substring(0, 25000);
                sourceUrl = source.content;
                if (!source.title) {
                    source.title = $('title').text().trim() || $('h1').first().text().trim() || 'Untitled';
                }
            } catch (err: any) {
                throw new Error(`Failed to fetch URL: ${err.message}`);
            }
        } else {
            rawContent = source.content;
        }

        if (!rawContent || rawContent.trim().length < 50) {
            throw new Error('Source content is too short to process');
        }

        // 2. Read current index for LLM context
        const indexPath = path.join(getWikiDir(tenantId), 'index.md');
        const currentIndex = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf-8') : 'No pages yet.';

        // 3. Call LLM to decide what pages to create/update
        const systemPrompt = `You are a wiki editor. Your job is to extract knowledge from a source and organize it into wiki pages.

Given the source content below, decide which wiki pages to CREATE or UPDATE.

## EXISTING WIKI PAGES
${currentIndex}

## RULES
- Create 1-5 focused pages. Each page should cover ONE topic well.
- Slug format: lowercase-with-hyphens (e.g., "kubernetes-autoscaling")
- For UPDATES: only include new information to add. The system will merge it with the existing page.
- Categories should be short lowercase labels (e.g., "infrastructure", "ai-ml", "devops", "business", "security")
- Write content as clean markdown with headers, paragraphs, and bullet points where appropriate.
- Extract FACTS, INSIGHTS, and ACTIONABLE knowledge — not just summaries.
- Include specific numbers, tools, techniques, and examples from the source.
- Do NOT include the source URL in the content body.

## RESPONSE FORMAT
Return ONLY valid JSON:
{
  "pages": [
    {
      "slug": "topic-name",
      "title": "Topic Name",
      "category": "category",
      "content": "# Topic Name\\n\\nMarkdown content here...",
      "action": "create"
    }
  ]
}`;

        const userContent = `Source: ${source.title || 'Untitled'}\n${sourceUrl ? `URL: ${sourceUrl}\n` : ''}\n---\n\n${rawContent}`;

        console.log(`[WikiService] Ingesting source for tenant ${tenantId}: "${source.title || source.type}"`);

        const llmResponse = await AIService.callForWiki(tenantId, systemPrompt, userContent);

        // 4. Parse LLM response
        let pageActions: IngestPageAction[] = [];
        try {
            const jsonMatch = llmResponse.match(/\{[\s\S]*"pages"[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                pageActions = parsed.pages || [];
            }
        } catch (e: any) {
            console.error('[WikiService] Failed to parse LLM response:', e.message);
            throw new Error('Failed to parse wiki page suggestions from AI');
        }

        if (pageActions.length === 0) {
            throw new Error('AI did not suggest any wiki pages from this source');
        }

        // 5. Write pages
        const affected: Array<{ slug: string; title: string; action: string }> = [];

        for (const page of pageActions) {
            const slug = titleToSlug(page.slug || page.title);
            const sources = sourceUrl ? [sourceUrl] : [];

            if (page.action === 'update') {
                // Merge with existing
                const existing = this.getPage(tenantId, slug);
                if (existing) {
                    const mergedContent = existing.content + '\n\n---\n\n' + page.content;
                    const mergedSources = [...new Set([...existing.sources, ...sources])];
                    await this.savePage(tenantId, slug, mergedContent, page.category || existing.category, page.title, mergedSources, 'updated');
                } else {
                    // Doesn't exist yet, create
                    await this.savePage(tenantId, slug, page.content, page.category, page.title, sources, 'created');
                }
            } else {
                await this.savePage(tenantId, slug, page.content, page.category, page.title, sources, 'created');
            }

            affected.push({ slug, title: page.title, action: page.action });
        }

        console.log(`[WikiService] Ingested ${affected.length} page(s) for tenant ${tenantId}`);
        return { pagesAffected: affected };
    }
}
