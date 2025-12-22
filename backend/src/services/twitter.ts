import { TwitterApi } from 'twitter-api-v2';
import { Settings } from '../db';

export class TwitterService {
    private client: TwitterApi | null = null;

    private async initializeClient(userId: string) {
        const settings = await Settings.findOne({ where: { userId } });
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

    async getAuthUrl(userId: string, callbackUrl: string) {
        const settings = await Settings.findOne({ where: { userId } });
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

    async getAccessToken(userId: string, code: string, codeVerifier: string, callbackUrl: string) {
        const settings = await Settings.findOne({ where: { userId } });
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

    async refreshAccessToken(userId: string) {
        const settings = await Settings.findOne({ where: { userId } });
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

    async publishTweet(userId: string, content: string) {
        // Re-initialize to ensure we have the latest token
        await this.initializeClient(userId);

        if (!this.client) {
            throw new Error('Twitter client not initialized');
        }

        // Check if token needs refresh
        const settings = await Settings.findOne({ where: { userId } });
        if (settings?.twitterExpiresAt && new Date() > settings.twitterExpiresAt) {
            console.log('Refreshing Twitter token...');
            await this.refreshAccessToken(userId);
        }

        try {
            const { data } = await this.client.v2.tweet(content);
            return data.id;
        } catch (error) {
            console.error('Error publishing tweet:', error);
            throw error;
        }
    }
}

export const twitterService = new TwitterService();
