import { TwitterApi } from 'twitter-api-v2';
import { Settings } from '../db';

export class TwitterService {
    private client: TwitterApi | null = null;

    private async initializeClient(tenantId: string) {
        const settings = await Settings.findOne({ where: { tenantId } });
        if (settings?.twitterAccessToken) {
            // Initialize with access token for posting
            this.client = new TwitterApi(settings.twitterAccessToken);
        } else if (process.env.TWITTER_CLIENT_ID && process.env.TWITTER_CLIENT_SECRET) {
            // Initialize with client credentials for auth flow
            this.client = new TwitterApi({
                clientId: process.env.TWITTER_CLIENT_ID,
                clientSecret: process.env.TWITTER_CLIENT_SECRET,
            });
        }
    }

    async getAuthUrl(tenantId: string, callbackUrl: string) {
        const settings = await Settings.findOne({ where: { tenantId } });
        if (!settings?.twitterClientId || !settings?.twitterClientSecret) {
            throw new Error('Twitter Client ID and Secret are required');
        }

        const client = new TwitterApi({
            clientId: settings.twitterClientId,
            clientSecret: settings.twitterClientSecret,
        });

        const { url, codeVerifier, state } = client.generateOAuth2AuthLink(
            callbackUrl,
            { scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'] }
        );

        return { url, codeVerifier, state };
    }

    async getAccessToken(tenantId: string, code: string, codeVerifier: string, callbackUrl: string) {
        const settings = await Settings.findOne({ where: { tenantId } });
        if (!settings?.twitterClientId || !settings?.twitterClientSecret) {
            throw new Error('Twitter Client ID and Secret are required');
        }

        const client = new TwitterApi({
            clientId: settings.twitterClientId,
            clientSecret: settings.twitterClientSecret,
        });

        const { accessToken, refreshToken, expiresIn } = await client.loginWithOAuth2({
            code,
            codeVerifier,
            redirectUri: callbackUrl,
        });

        return { accessToken, refreshToken, expiresIn };
    }

    async refreshAccessToken(tenantId: string) {
        const settings = await Settings.findOne({ where: { tenantId } });
        if (!settings?.twitterClientId || !settings?.twitterClientSecret || !settings?.twitterRefreshToken) {
            throw new Error('Missing credentials for refresh');
        }

        const client = new TwitterApi({
            clientId: settings.twitterClientId,
            clientSecret: settings.twitterClientSecret,
        });

        const { accessToken, refreshToken, expiresIn } = await client.refreshOAuth2Token(settings.twitterRefreshToken);

        // Update settings
        await settings.update({
            twitterAccessToken: accessToken,
            twitterRefreshToken: refreshToken,
            twitterExpiresAt: new Date(Date.now() + expiresIn * 1000),
        });

        this.client = new TwitterApi(accessToken);
        return accessToken;
    }

    async publishTweet(tenantId: string, content: string) {
        // Re-initialize to ensure we have the latest token
        await this.initializeClient(tenantId);

        if (!this.client) {
            throw new Error('Twitter client not initialized');
        }

        // Check if token needs refresh
        const settings = await Settings.findOne({ where: { tenantId } });
        if (settings?.twitterExpiresAt && new Date() > settings.twitterExpiresAt) {
            console.log('Refreshing Twitter token...');
            await this.refreshAccessToken(tenantId);
        }

        try {
            const { data } = await this.client.v2.tweet(content);
            return data.id;
        } catch (error) {
            console.error('Error publishing tweet:', error);
            throw error;
        }
    }

    async getTweetStats(tenantId: string, tweetIds: string[]) {
        if (tweetIds.length === 0) return [];

        await this.initializeClient(tenantId);
        if (!this.client) return [];

        try {
            const response = await this.client.v2.tweets(tweetIds, {
                'tweet.fields': ['public_metrics']
            });

            return (response.data || []).map(tweet => ({
                id: tweet.id,
                likes: tweet.public_metrics?.like_count || 0,
                comments: tweet.public_metrics?.reply_count || 0,
                reposts: tweet.public_metrics?.retweet_count || 0,
                impressions: tweet.public_metrics?.impression_count || 0
            }));
        } catch (error) {
            console.error('Twitter Stats Error:', error);
            return [];
        }
    }
}

export const twitterService = new TwitterService();
