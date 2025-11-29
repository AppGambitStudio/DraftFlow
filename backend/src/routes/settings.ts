import express from 'express';
import { Settings } from '../db';
import axios from 'axios';

const router = express.Router();

// Get settings
router.get('/', async (req, res) => {
    try {
        const setting = await Settings.findOne();
        res.json(setting || {});
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// Update settings
router.post('/', async (req, res) => {
    const {
        linkedinClientId, linkedinClientSecret, linkedinAccessToken, linkedinRefreshToken, linkedinExpiresAt,
        twitterClientId, twitterClientSecret, twitterAccessToken, twitterRefreshToken, twitterExpiresAt,
        openRouterApiKey, openRouterModelId
    } = req.body;
    console.log('Received settings update:', { ...req.body, openRouterApiKey: '***' });

    try {
        const [setting] = await Settings.findOrCreate({
            where: {},
            defaults: {
                linkedinClientId,
                linkedinClientSecret,
                linkedinAccessToken,
                linkedinRefreshToken,
                linkedinExpiresAt: linkedinExpiresAt ? new Date(linkedinExpiresAt) : null,
                twitterClientId,
                twitterClientSecret,
                twitterAccessToken,
                twitterRefreshToken,
                twitterExpiresAt: twitterExpiresAt ? new Date(twitterExpiresAt) : null,
                openRouterApiKey,
                openRouterModelId,
            }, // Added missing comma and closing brace for defaults object
        });

        await setting.update({
            linkedinClientId,
            linkedinClientSecret,
            linkedinAccessToken,
            linkedinRefreshToken,
            linkedinExpiresAt: linkedinExpiresAt ? new Date(linkedinExpiresAt) : null,
            twitterClientId,
            twitterClientSecret,
            twitterAccessToken,
            twitterRefreshToken,
            twitterExpiresAt: twitterExpiresAt ? new Date(twitterExpiresAt) : null,
            openRouterApiKey,
            openRouterModelId,
        });

        res.json(setting);
    } catch (error: any) {
        console.log(error);
        res.status(500).json({ error: 'Failed to save settings, ' + error?.toString() });
    }
});

// Get available LinkedIn authors (Self + Organizations)
router.get('/linkedin/authors', async (req, res) => {
    try {
        const setting = await Settings.findOne();
        if (!setting || !setting.linkedinAccessToken) {
            return res.status(401).json({ error: 'LinkedIn not connected' });
        }

        const accessToken = setting.linkedinAccessToken;
        const authors = [];

        // 1. Fetch "Self" Profile
        try {
            const profileResponse = await axios.get('https://api.linkedin.com/v2/me', {
                headers: { 'Authorization': `Bearer ${accessToken}` }
            });
            authors.push({
                urn: `urn:li:person:${profileResponse.data.id}`,
                name: `${profileResponse.data.localizedFirstName} ${profileResponse.data.localizedLastName} (Self)`,
                image: null // Could fetch profile picture if needed
            });
        } catch (error) {
            console.error('Error fetching LinkedIn profile:', error);
        }

        // 2. Fetch Organizations (Administrator Role)
        try {
            const orgsResponse = await axios.get(
                'https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organizationalTarget~(id,localizedName)))',
                {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'X-Restli-Protocol-Version': '2.0.0'
                    }
                }
            );

            if (orgsResponse.data && orgsResponse.data.elements) {
                orgsResponse.data.elements.forEach((element: any) => {
                    const target = element.organizationalTarget;

                    // Case 1: Projection succeeded, target is an object with details
                    if (target && typeof target === 'object') {
                        authors.push({
                            urn: element.organizationalTargetUrn || `urn:li:organization:${target.id}`,
                            name: target.localizedName || "Unknown Organization",
                            image: null
                        });
                    }
                    // Case 2: Projection failed (e.g. 429 Rate Limit), target is the URN string
                    else if (typeof target === 'string') {
                        // target is likely "urn:li:organization:12345"
                        const parts = target.split(':');
                        const id = parts[parts.length - 1];
                        authors.push({
                            urn: target,
                            name: `Organization (${id})`, // Fallback name
                            image: null
                        });
                    }
                });
            }
        } catch (error) {
            console.error('Error fetching LinkedIn organizations:', error);
        }

        res.json(authors);
    } catch (error: any) {
        console.error('Error fetching authors:', error);
        res.status(500).json({ error: 'Failed to fetch authors' });
    }
});

export default router;
