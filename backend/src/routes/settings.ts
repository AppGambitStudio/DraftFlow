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
        openRouterApiKey, openRouterModelId, targetAudiences
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
                targetAudiences,
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
            targetAudiences,
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

            const missingDetailsIds: string[] = [];
            const orgsMap = new Map<string, { urn: string, name: string }>();

            if (orgsResponse.data && orgsResponse.data.elements) {
                orgsResponse.data.elements.forEach((element: any) => {
                    const target = element.organizationalTarget;
                    if (!target) return;

                    if (typeof target === 'object') {
                        // Projection succeeded
                        authors.push({
                            urn: element.organizationalTargetUrn || `urn:li:organization:${target.id}`,
                            name: target.localizedName || "Unknown Organization",
                            image: null
                        });
                    } else if (typeof target === 'string') {
                        // Projection failed, we have the URN
                        const parts = target.split(':');
                        const id = parts[parts.length - 1] || '';
                        if (id) {
                            missingDetailsIds.push(id);
                            // Placeholder, will be updated if fetch succeeds
                            orgsMap.set(id, {
                                urn: target,
                                name: `Organization (${id})`
                            });
                        }
                    }
                });
            }

            // Fetch missing details in batch
            if (missingDetailsIds.length > 0) {
                try {
                    const idsParam = `List(${missingDetailsIds.join(',')})`;
                    const detailsResponse = await axios.get(
                        `https://api.linkedin.com/v2/organizations?ids=${idsParam}&projection=(results*(id,localizedName))`,
                        {
                            headers: {
                                'Authorization': `Bearer ${accessToken}`,
                                'X-Restli-Protocol-Version': '2.0.0'
                            }
                        }
                    );

                    if (detailsResponse.data && detailsResponse.data.results) {
                        Object.values(detailsResponse.data.results).forEach((org: any) => {
                            if (orgsMap.has(String(org.id))) {
                                const entry = orgsMap.get(String(org.id));
                                if (entry) {
                                    entry.name = org.localizedName;
                                }
                            }
                        });
                    }
                } catch (batchError) {
                    console.error('Error batch fetching organization details:', batchError);
                }

                // Add the (potentially updated) fallback entries to authors
                orgsMap.forEach((value) => authors.push({ ...value, image: null }));
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
