import express, { Request, Response } from 'express';
import axios from 'axios';
import { Settings } from '../db';
import { TwitterApi } from 'twitter-api-v2';

const router = express.Router();

// Helper to get settings or throw
const getSettings = async () => {
    const settings = await Settings.findOne();
    if (!settings) throw new Error("Settings not found");
    return settings;
};

// --- LinkedIn OAuth ---

// 1. Connect: Redirect to LinkedIn
router.get('/linkedin/connect', async (req: Request, res: Response) => {
    try {
        const settings = await getSettings();
        const clientId = settings.linkedinClientId || process.env.LINKEDIN_CLIENT_ID;

        if (!clientId) {
            res.status(500).send("LinkedIn Client ID is missing. Please configure it in settings or .env.");
            return;
        }

        const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/linkedin/callback`;
        const state = Math.random().toString(36).substring(7); // Simple state

        // Scopes: OIDC for identity, Community Management for posting (member + org)
        const requestedScopes = [
            'openid',
            'profile',
            'email',
            'w_member_social',
            'w_organization_social',
            'r_organization_social',
            'rw_organization_admin'
        ];

        const scope = encodeURIComponent(requestedScopes.join(' '));
        const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${scope}`;

        res.redirect(authUrl);
    } catch (error) {
        console.error("LinkedIn Connect Error:", error);
        res.status(500).send("Failed to initiate LinkedIn connection.");
    }
});

// 2. Callback: Exchange code for token
router.get('/linkedin/callback', async (req: Request, res: Response) => {
    const { code, state, error, error_description } = req.query;

    if (error) {
        console.error("LinkedIn Auth Error Callback:", error, error_description);
        res.status(400).send(`LinkedIn Auth Error: ${error}. Description: ${error_description}`);
        return;
    }
    if (!code) {
        res.status(400).send("No code returned from LinkedIn.");
        return;
    }

    try {
        const settings = await getSettings();
        const clientId = settings.linkedinClientId || process.env.LINKEDIN_CLIENT_ID;
        const clientSecret = settings.linkedinClientSecret || process.env.LINKEDIN_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            throw new Error("LinkedIn credentials missing in database and .env");
        }

        const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/linkedin/callback`;

        console.log("Exchanging LinkedIn code for token...");
        const response = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', null, {
            params: {
                grant_type: 'authorization_code',
                code: code as string,
                redirect_uri: redirectUri,
                client_id: clientId,
                client_secret: clientSecret
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const { access_token, expires_in, refresh_token } = response.data;

        // Calculate expiry date
        const expiresAt = new Date(Date.now() + expires_in * 1000);

        await settings.update({
            linkedinAccessToken: access_token,
            linkedinRefreshToken: refresh_token || settings.linkedinRefreshToken,
            linkedinExpiresAt: expiresAt
        });

        // Parse user info to get name for confirmation
        try {
            // Try OIDC endpoint first
            let profileRes;
            try {
                profileRes = await axios.get('https://api.linkedin.com/v2/userinfo', {
                    headers: { Authorization: `Bearer ${access_token}` }
                });
                console.log("Connected LinkedIn User (OIDC):", profileRes.data.name);
            } catch (oidcError) {
                // Fallback to legacy profile
                profileRes = await axios.get('https://api.linkedin.com/v2/me', {
                    headers: { Authorization: `Bearer ${access_token}` }
                });
                console.log("Connected LinkedIn User (Legacy):", `${profileRes.data.localizedFirstName} ${profileRes.data.localizedLastName}`);
            }
        } catch (e: any) {
            console.warn("Failed to fetch LinkedIn profile during callback:", e.response?.data || e.message);
        }

        // Redirect back to frontend settings
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.redirect(`${frontendUrl}/settings?linkedin_connected=true`);
    } catch (error: any) {
        console.error("LinkedIn Callback Error Details:", error.response?.data || error.message);
        res.status(500).send(`Failed to complete LinkedIn authentication: ${error.message}`);
    }
});


// --- Twitter OAuth (OAuth 2.0 PKCE) ---

// In-memory store for PKCE verifiers (since we can't easily add to DB schema on the fly and single user assumption)
// Key: state, Value: { codeVerifier, codeChallenge }
const twitterAuthStore: Record<string, { codeVerifier: string, state: string }> = {};

router.get('/twitter/connect', async (req: Request, res: Response) => {
    try {
        const clientId = process.env.TWITTER_CLIENT_ID;
        if (!clientId) {
            res.status(500).send("Twitter Client ID is missing in server configuration (.env).");
            return;
        }

        const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/twitter/callback`;

        // Twitter Client for OAuth generation make sure to use a NEW client instance just for generation
        const client = new TwitterApi({ clientId: clientId, clientSecret: process.env.TWITTER_CLIENT_SECRET || '' });

        const { url, codeVerifier, state } = client.generateOAuth2AuthLink(
            redirectUri,
            { scope: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'] }
        );

        // Store verifier for the callback
        twitterAuthStore[state] = { codeVerifier, state };

        res.redirect(url);
    } catch (error) {
        console.error("Twitter Connect Error:", error);
        res.status(500).send("Failed to initiate Twitter connection.");
    }
});

router.get('/twitter/callback', async (req: Request, res: Response) => {
    const { state, code, error } = req.query;

    if (error) {
        res.status(400).send(`Twitter Auth Error: ${error}`);
        return;
    }
    if (!code || !state) {
        res.status(400).send("Missing code or state from Twitter.");
        return;
    }

    const storedAuth = twitterAuthStore[state as string];
    if (!storedAuth) {
        res.status(400).send("Invalid state or session expired.");
        return;
    }

    try {
        const settings = await getSettings();
        const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/twitter/callback`;

        const clientId = process.env.TWITTER_CLIENT_ID;
        const clientSecret = process.env.TWITTER_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            throw new Error("Twitter credentials missing in .env");
        }

        const client = new TwitterApi({
            clientId: clientId,
            clientSecret: clientSecret
        });

        const { client: loggedClient, accessToken, refreshToken, expiresIn } = await client.loginWithOAuth2({
            code: code as string,
            codeVerifier: storedAuth.codeVerifier,
            redirectUri: redirectUri
        });

        // Clean up store
        delete twitterAuthStore[state as string];

        const expiresAt = new Date(Date.now() + (expiresIn || 7200) * 1000);

        await settings.update({
            twitterAccessToken: accessToken,
            twitterRefreshToken: refreshToken || settings.twitterRefreshToken,
            twitterExpiresAt: expiresAt
        });

        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        res.redirect(`${frontendUrl}/settings?twitter_connected=true`);

    } catch (error) {
        console.error("Twitter Callback Error:", error);
        res.status(500).send("Failed to complete Twitter authentication.");
    }
});

export default router;
