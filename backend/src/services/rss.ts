import Parser from 'rss-parser';
import axios from 'axios';
import { RssFeed, RssFeedItem } from '../db';

const parser = new Parser({
    customFields: {
        item: [
            ['media:content', 'mediaContent'],
            ['media:thumbnail', 'mediaThumbnail'],
        ],
    },
});

const FEED_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

/**
 * Fetch RSS XML via axios (reliable header handling), then parse with rss-parser.
 */
async function fetchAndParse(url: string) {
    const response = await axios.get(url, {
        headers: FEED_HEADERS,
        timeout: 15000,
        responseType: 'text',
    });
    return parser.parseString(response.data);
}

export class RssService {
    /**
     * Add a new RSS feed — fetches metadata and initial items.
     */
    static async addFeed(tenantId: string, url: string): Promise<RssFeed> {
        // Check for duplicate
        const existing = await RssFeed.findOne({ where: { tenantId, url } });
        if (existing) {
            throw new Error('This feed URL is already added');
        }

        // Fetch the feed to validate and get metadata
        let parsed;
        try {
            parsed = await fetchAndParse(url);
        } catch (err: any) {
            throw new Error(`Failed to fetch feed: ${err.message}`);
        }

        const feed = await RssFeed.create({
            tenantId,
            url,
            title: parsed.title || null,
            description: parsed.description || null,
            siteUrl: parsed.link || null,
            imageUrl: (parsed.image as any)?.url || null,
            status: 'ACTIVE',
            lastFetchedAt: new Date(),
        });

        // Store initial items
        await this.storeItems(feed, parsed.items || [], tenantId);

        console.log(`[RSS] Added feed "${parsed.title}" (${url}) with ${parsed.items?.length || 0} items`);
        return feed;
    }

    /**
     * Refresh a single feed — fetch new items.
     */
    static async refreshFeed(feed: RssFeed): Promise<number> {
        try {
            const parsed = await fetchAndParse(feed.url);

            // Update feed metadata
            await feed.update({
                title: parsed.title || feed.title,
                description: parsed.description || feed.description,
                siteUrl: parsed.link || feed.siteUrl,
                imageUrl: (parsed.image as any)?.url || feed.imageUrl,
                lastFetchedAt: new Date(),
                lastError: null,
                status: 'ACTIVE',
            });

            const newCount = await this.storeItems(feed, parsed.items || [], feed.tenantId as string);
            console.log(`[RSS] Refreshed "${feed.title}" — ${newCount} new items`);
            return newCount;
        } catch (err: any) {
            console.error(`[RSS] Error refreshing feed ${feed.id} (${feed.url}):`, err.message);
            await feed.update({
                lastError: err.message,
                status: 'ERROR',
            });
            return 0;
        }
    }

    /**
     * Refresh all active feeds for a tenant.
     */
    static async refreshAllFeeds(tenantId: string): Promise<{ refreshed: number; newItems: number }> {
        const feeds = await RssFeed.findAll({
            where: { tenantId, status: 'ACTIVE' },
        });

        let totalNew = 0;
        for (const feed of feeds) {
            totalNew += await this.refreshFeed(feed);
        }

        return { refreshed: feeds.length, newItems: totalNew };
    }

    /**
     * Refresh all active feeds across all tenants (called by scheduler).
     */
    static async refreshAllTenantFeeds(): Promise<void> {
        const feeds = await RssFeed.findAll({
            where: { status: 'ACTIVE' },
        });

        console.log(`[RSS] Daily refresh: ${feeds.length} active feeds`);
        for (const feed of feeds) {
            await this.refreshFeed(feed);
        }
    }

    /**
     * Store feed items, skipping duplicates by guid.
     */
    private static async storeItems(
        feed: RssFeed,
        items: any[],
        tenantId: string
    ): Promise<number> {
        let newCount = 0;

        for (const item of items) {
            const guid = item.guid || item.id || item.link || item.title;
            if (!guid) continue;

            // Check for existing
            const exists = await RssFeedItem.findOne({
                where: { feedId: feed.id, guid },
            });
            if (exists) continue;

            // Extract image URL from various possible fields
            const imageUrl =
                item.enclosure?.url ||
                (item as any).mediaContent?.$?.url ||
                (item as any).mediaThumbnail?.$?.url ||
                null;

            await RssFeedItem.create({
                tenantId,
                feedId: feed.id,
                guid,
                title: item.title || 'Untitled',
                description: item.contentSnippet || item.summary || null,
                content: item['content:encoded'] || item.content || null,
                link: item.link || null,
                author: item.creator || item.author || null,
                pubDate: item.pubDate ? new Date(item.pubDate) : null,
                imageUrl,
                categories: JSON.stringify(item.categories || []),
            });
            newCount++;
        }

        return newCount;
    }
}
