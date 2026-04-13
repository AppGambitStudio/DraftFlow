/**
 * Hydrate Wiki — Seeds the LLM Wiki for a tenant from existing content.
 *
 * Sources:
 * 1. Top-performing published posts (by engagement) — extract patterns & insights
 * 2. Bookmarked/recent RSS feed items — industry knowledge
 * 3. Saved ideas — content strategy themes
 * 4. Saved trends — current industry trends
 *
 * Usage: npx ts-node scripts/hydrate-wiki.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import { initDB } from '../src/db';
import { Post, Idea, SavedTrend, RssFeedItem } from '../src/db';
import { WikiService } from '../src/services/wiki';
import { AIService } from '../src/services/ai';

const TENANT_ID = '991c16c0-cda3-40fe-bb05-9d8f922f5aab';

async function hydrate() {
    await initDB();
    console.log('\n=== Wiki Hydration Script ===\n');

    WikiService.initTenantWiki(TENANT_ID);

    // 1. Top published posts — grouped by topic for wiki pages
    console.log('[1/4] Processing top published posts...');
    const topPosts = await Post.findAll({
        where: { tenantId: TENANT_ID, status: 'PUBLISHED' },
        order: [['likesCount', 'DESC']],
        limit: 30,
        attributes: ['content', 'likesCount', 'commentsCount', 'repostsCount', 'createdAt']
    });

    if (topPosts.length > 0) {
        // Batch posts into chunks for LLM to process
        const postTexts = topPosts.map((p, i) => {
            const engagement = (p.likesCount || 0) + (p.commentsCount || 0) * 3 + (p.repostsCount || 0) * 2;
            return `--- Post ${i + 1} (engagement: ${engagement}) ---\n${p.content.substring(0, 500)}`;
        }).join('\n\n');

        try {
            const systemPrompt = `You are a wiki editor. Analyze these top-performing LinkedIn posts and extract REUSABLE knowledge into wiki pages.

DO NOT create pages about the posts themselves. Instead, extract:
- Technical patterns and best practices mentioned
- Industry insights and trends discussed
- Frameworks, tools, and techniques referenced
- Business strategies and lessons shared

Create 3-8 focused wiki pages. Each page should be a knowledge article that could help write FUTURE posts on similar topics.

Return ONLY valid JSON:
{
  "pages": [
    {
      "slug": "topic-name",
      "title": "Topic Name",
      "category": "category",
      "content": "# Topic Name\\n\\nContent...",
      "action": "create"
    }
  ]
}`;

            const response = await AIService.callForWiki(TENANT_ID, systemPrompt, postTexts);
            const jsonMatch = response.match(/\{[\s\S]*"pages"[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                for (const page of parsed.pages || []) {
                    const slug = page.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
                    await WikiService.savePage(TENANT_ID, slug, page.content, page.category, page.title, ['published-posts'], 'created');
                    console.log(`  + Created: ${page.title} (${page.category})`);
                }
            }
        } catch (err: any) {
            console.error('  Error processing posts:', err.message);
        }
    }

    // 2. RSS Feed Items — bookmarked or most recent
    console.log('[2/4] Processing RSS feed items...');
    const rssItems = await RssFeedItem.findAll({
        where: { tenantId: TENANT_ID },
        order: [['isBookmarked', 'DESC'], ['pubDate', 'DESC']],
        limit: 20,
        attributes: ['title', 'description', 'content', 'link', 'categories']
    });

    if (rssItems.length > 0) {
        const rssTexts = rssItems.map((item, i) => {
            const desc = item.content || item.description || '';
            const cats = (() => { try { return JSON.parse(item.categories || '[]').join(', '); } catch { return ''; } })();
            return `--- Article ${i + 1}: ${item.title} ---\n${cats ? `Categories: ${cats}\n` : ''}${desc.substring(0, 400)}`;
        }).join('\n\n');

        try {
            const systemPrompt = `You are a wiki editor. These are articles from the user's RSS feeds — industry news and technical content they follow.

Extract KEY INSIGHTS and organize into wiki pages by topic. Focus on:
- Emerging technologies and tools
- Industry trends and market shifts
- Technical deep-dives and best practices
- Notable company strategies and case studies

Create 3-6 focused wiki pages. Synthesize across articles — don't create one page per article.

Return ONLY valid JSON:
{
  "pages": [
    {
      "slug": "topic-name",
      "title": "Topic Name",
      "category": "category",
      "content": "# Topic Name\\n\\nContent...",
      "action": "create"
    }
  ]
}`;

            const response = await AIService.callForWiki(TENANT_ID, systemPrompt, rssTexts);
            const jsonMatch = response.match(/\{[\s\S]*"pages"[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                for (const page of parsed.pages || []) {
                    const slug = page.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
                    const existing = WikiService.getPage(TENANT_ID, slug);
                    if (existing) {
                        // Merge
                        const merged = existing.content + '\n\n---\n\n' + page.content;
                        await WikiService.savePage(TENANT_ID, slug, merged, page.category, page.title, [...existing.sources, 'rss-feeds'], 'updated');
                        console.log(`  ~ Updated: ${page.title}`);
                    } else {
                        await WikiService.savePage(TENANT_ID, slug, page.content, page.category, page.title, ['rss-feeds'], 'created');
                        console.log(`  + Created: ${page.title} (${page.category})`);
                    }
                }
            }
        } catch (err: any) {
            console.error('  Error processing RSS items:', err.message);
        }
    }

    // 3. Saved Ideas — content strategy
    console.log('[3/4] Processing saved ideas...');
    const ideas = await Idea.findAll({
        where: { tenantId: TENANT_ID },
        order: [['createdAt', 'DESC']],
        attributes: ['title', 'description', 'tags']
    });

    if (ideas.length > 0) {
        const ideasText = ideas.map((idea, i) => {
            const tags = (() => { try { return JSON.parse(idea.tags || '[]').join(', '); } catch { return ''; } })();
            return `- **${idea.title}** ${tags ? `[${tags}]` : ''}: ${(idea.description || '').substring(0, 200)}`;
        }).join('\n');

        try {
            await WikiService.savePage(
                TENANT_ID,
                'content-ideas-backlog',
                `# Content Ideas Backlog\n\nThese are saved content ideas for future posts:\n\n${ideasText}`,
                'content-strategy',
                'Content Ideas Backlog',
                ['idea-board'],
                'created'
            );
            console.log(`  + Created: Content Ideas Backlog (${ideas.length} ideas)`);
        } catch (err: any) {
            console.error('  Error processing ideas:', err.message);
        }
    }

    // 4. Saved Trends — current landscape
    console.log('[4/4] Processing saved trends...');
    const trends = await SavedTrend.findAll({
        where: { tenantId: TENANT_ID },
        order: [['fetchedAt', 'DESC']],
        limit: 30,
        attributes: ['topic', 'description', 'relevance', 'suggestedAngles', 'trendType', 'industry']
    });

    if (trends.length > 0) {
        const trendTexts = trends.map((t, i) => {
            const angles = (() => { try { return JSON.parse(t.suggestedAngles || '[]').join(', '); } catch { return ''; } })();
            return `--- Trend: ${t.topic} ---\nType: ${t.trendType || 'general'} | Industry: ${t.industry || 'tech'}\n${t.description}\nRelevance: ${t.relevance}\n${angles ? `Angles: ${angles}` : ''}`;
        }).join('\n\n');

        try {
            const systemPrompt = `You are a wiki editor. These are saved industry trends. Organize them into 2-4 wiki pages grouped by theme.

Don't list every trend individually — synthesize patterns and group related trends together.

Return ONLY valid JSON:
{
  "pages": [
    {
      "slug": "topic-name",
      "title": "Topic Name",
      "category": "trends",
      "content": "# Topic Name\\n\\nContent...",
      "action": "create"
    }
  ]
}`;

            const response = await AIService.callForWiki(TENANT_ID, systemPrompt, trendTexts);
            const jsonMatch = response.match(/\{[\s\S]*"pages"[\s\S]*\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                for (const page of parsed.pages || []) {
                    const slug = page.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
                    const existing = WikiService.getPage(TENANT_ID, slug);
                    if (existing) {
                        const merged = existing.content + '\n\n---\n\n' + page.content;
                        await WikiService.savePage(TENANT_ID, slug, merged, page.category, page.title, [...existing.sources, 'saved-trends'], 'updated');
                        console.log(`  ~ Updated: ${page.title}`);
                    } else {
                        await WikiService.savePage(TENANT_ID, slug, page.content, page.category, page.title, ['saved-trends'], 'created');
                        console.log(`  + Created: ${page.title} (${page.category})`);
                    }
                }
            }
        } catch (err: any) {
            console.error('  Error processing trends:', err.message);
        }
    }

    // Final stats
    const stats = WikiService.getStats(TENANT_ID);
    console.log(`\n=== Hydration Complete ===`);
    console.log(`Pages created: ${stats.pageCount}`);
    console.log(`Wiki directory: wiki/${TENANT_ID}/`);
    console.log(`\nDone!\n`);

    process.exit(0);
}

hydrate().catch(err => {
    console.error('Hydration failed:', err);
    process.exit(1);
});
