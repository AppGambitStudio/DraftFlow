import express, { Request, Response } from 'express';
import axios from 'axios';
import { Settings } from '../db';
import { TwitterApi } from 'twitter-api-v2';
import { twitterService } from '../services/twitter';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';

const router = express.Router();

// Helper to get settings or throw
const getSettings = async (userId: string) => {
    const settings = await Settings.findOne({ where: { userId } });
    if (!settings) throw new Error("Settings not found for user: " + userId);
    return settings;
};

// --- LinkedIn OAuth ---

// 1. Connect: Redirect to LinkedIn
router.get('/linkedin/connect', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const settings = await getSettings(userId);
        const clientId = settings.linkedinClientId || process.env.LINKEDIN_CLIENT_ID;

        if (!clientId) {
            res.status(500).send("LinkedIn Client ID is missing. Please configure it in settings or .env.");
            return;
        }

        const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/linkedin/callback`;
        const state = `${Math.random().toString(36).substring(7)}:${userId}`;

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
        const stateStr = state as string;
        const stateParts = stateStr.split(':');
        const userIdStr = stateParts[1];
        if (!userIdStr) {
            throw new Error("Invalid state: missing userId");
        }
        const userId = userIdStr;

        const settings = await getSettings(userId);
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
            let selfProfile = null;
            try {
                const profileRes = await axios.get('https://api.linkedin.com/v2/userinfo', {
                    headers: { Authorization: `Bearer ${access_token}` }
                });
                console.log("Connected LinkedIn User (OIDC):", profileRes.data.name);
                selfProfile = {
                    urn: `urn:li:person:${profileRes.data.sub}`,
                    name: `${profileRes.data.name} (Self)`,
                    image: profileRes.data.picture || null
                };
            } catch (oidcError) {
                // Fallback to legacy profile
                const profileRes = await axios.get('https://api.linkedin.com/v2/me', {
                    headers: { Authorization: `Bearer ${access_token}` }
                });
                console.log("Connected LinkedIn User (Legacy):", `${profileRes.data.localizedFirstName} ${profileRes.data.localizedLastName}`);
                selfProfile = {
                    urn: `urn:li:person:${profileRes.data.id}`,
                    name: `${profileRes.data.localizedFirstName} ${profileRes.data.localizedLastName} (Self)`,
                    image: null
                };
            }

            if (selfProfile) {
                await settings.update({ linkedinProfile: JSON.stringify(selfProfile) });
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

// In-memory store for PKCE verifiers
// Key: state, Value: { codeVerifier, state, userId }
const twitterAuthStore: Record<string, { codeVerifier: string, state: string, userId: string }> = {};

router.get('/twitter/connect', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user!.id;
        const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/twitter/callback`;

        const { url, codeVerifier, state } = await twitterService.getAuthUrl(
            userId,
            redirectUri
        );

        // Store verifier for the callback
        twitterAuthStore[state] = { codeVerifier, state, userId };

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
        const userId = storedAuth.userId;
        const settings = await getSettings(userId);
        const redirectUri = `${req.protocol}://${req.get('host')}/api/auth/twitter/callback`;

        const { accessToken, refreshToken, expiresIn } = await twitterService.getAccessToken(
            userId,
            code as string,
            storedAuth.codeVerifier,
            redirectUri
        );

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
