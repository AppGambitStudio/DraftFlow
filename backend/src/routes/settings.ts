import express, { Response } from 'express';
import { Settings } from '../db';
import axios from 'axios';
import { authMiddleware, AuthRequest } from '../middleware/authMiddleware';

const router = express.Router();

// Get settings
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const setting = await Settings.findOne({ where: { tenantId } });
        const data = (setting ? setting.toJSON() : {}) as any;

        // Connection flags
        const isLinkedinConnected = !!(data.linkedinAccessToken);
        const isTwitterConnected = !!(data.twitterAccessToken);

        // Configuration flags (app-wide)
        const isLinkedinConfigured = !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);
        const isTwitterConfigured = !!(process.env.TWITTER_CLIENT_ID && process.env.TWITTER_CLIENT_SECRET);

        // Construct safe response (Hide sensitive tokens)
        const safeSettings = {
            ...data,
            linkedinAccessToken: undefined, // Hide
            linkedinRefreshToken: undefined, // Hide
            twitterAccessToken: undefined, // Hide
            twitterRefreshToken: undefined, // Hide
            linkedinClientId: undefined,
            linkedinClientSecret: undefined,
            twitterClientId: undefined,
            twitterClientSecret: undefined,
            isLinkedinConfigured,
            isTwitterConfigured,
            isLinkedinConnected,
            isTwitterConnected
        };

        res.json(safeSettings);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});

// Update settings
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
    const tenantId = req.tenantId!;
    const {
        openRouterApiKey, openRouterModelId, targetAudiences, maxHistoryItems,
        globalTone, accountTones
    } = req.body;
    console.log('Received settings update for tenant:', tenantId);

    try {
        const [setting] = await Settings.findOrCreate({
            where: { tenantId },
            defaults: {
                userId: req.user!.id, // Set initial creator as userId reference
                tenantId,
                openRouterApiKey,
                openRouterModelId,
                targetAudiences,
                maxHistoryItems: maxHistoryItems || 5,
                globalTone,
                accountTones: accountTones ? JSON.stringify(accountTones) : '{}',
            },
        });

        await setting.update({
            openRouterApiKey,
            openRouterModelId,
            targetAudiences,
            maxHistoryItems: maxHistoryItems !== undefined ? maxHistoryItems : setting.maxHistoryItems,
            globalTone,
            accountTones: accountTones ? JSON.stringify(accountTones) : setting.accountTones,
        });

        res.json(setting);
    } catch (error: any) {
        console.log(error);
        res.status(500).json({ error: 'Failed to save settings, ' + error?.toString() });
    }
});

// Disconnect platform
router.post('/disconnect', authMiddleware, async (req: AuthRequest, res: Response) => {
    const tenantId = req.tenantId!;
    const { platform } = req.body;

    try {
        const setting = await Settings.findOne({ where: { tenantId } });
        if (!setting) {
            return res.status(404).json({ error: 'Settings not found' });
        }

        if (platform === 'linkedin') {
            await setting.update({
                linkedinAccessToken: null,
                linkedinRefreshToken: null,
                linkedinExpiresAt: null,
                linkedinOrganizations: '[]'
            });
        } else if (platform === 'twitter') {
            await setting.update({
                twitterAccessToken: null,
                twitterRefreshToken: null,
                twitterExpiresAt: null
            });
        }

        res.json({ message: `Disconnected from ${platform}` });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to disconnect' });
    }
});

// Get available LinkedIn authors (Self + Organizations)
router.get('/linkedin/authors', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const setting = await Settings.findOne({ where: { tenantId } });
        if (!setting || !setting.linkedinAccessToken) {
            return res.status(401).json({ error: 'LinkedIn not connected' });
        }

        const accessToken = setting.linkedinAccessToken;
        const authors = [];

        // 1. Fetch "Self" Profile (From Cache)
        if (setting.linkedinProfile) {
            try {
                const profile = JSON.parse(setting.linkedinProfile);
                authors.push(profile);
            } catch (e) {
                console.error('Error parsing cached LinkedIn profile:', e);
            }
        }

        // 2. Use Cached Organizations
        try {
            const cachedOrgs = JSON.parse(setting.linkedinOrganizations || '[]');
            cachedOrgs.forEach((org: any) => {
                authors.push(org);
            });
        } catch (e) {
            console.error('Error parsing cached organizations:', e);
        }

        res.json(authors);
    } catch (error: any) {
        console.error('Error fetching authors:', error);
        res.status(500).json({ error: 'Failed to fetch authors' });
    }
});

// Scan for LinkedIn Organizations
router.post('/linkedin/scan', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const tenantId = req.tenantId!;
        const setting = await Settings.findOne({ where: { tenantId } });
        if (!setting || !setting.linkedinAccessToken) {
            return res.status(401).json({ error: 'LinkedIn not connected' });
        }

        const accessToken = setting.linkedinAccessToken;
        const organizations: { urn: string, name: string, image: null }[] = [];

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
                    const targetDecoration = element['organizationalTarget~'];

                    if (targetDecoration) {
                        organizations.push({
                            urn: element.organizationalTargetUrn || `urn:li:organization:${targetDecoration.id}`,
                            name: targetDecoration.localizedName || "Unknown Organization",
                            image: null
                        });
                    } else if (typeof target === 'string') {
                        const parts = target.split(':');
                        const id = parts[parts.length - 1] || '';
                        if (id) {
                            missingDetailsIds.push(id);
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
                        Object.entries(detailsResponse.data.results).forEach(([id, org]: [string, any]) => {
                            if (orgsMap.has(id)) {
                                const entry = orgsMap.get(id);
                                if (entry) {
                                    entry.name = org.localizedName || entry.name;
                                }
                            }
                        });
                    }
                } catch (batchError: any) {
                    console.error('Error batch fetching organization details:', batchError.response?.data || batchError.message);
                }

                orgsMap.forEach((value: { urn: string, name: string }) => organizations.push({ ...value, image: null }));
            }

            // Update settings with new cache
            setting.linkedinOrganizations = JSON.stringify(organizations);
            await setting.save();

            // Fetch "Self" Profile for display and cache
            let selfProfile = null;
            try {
                const profileResponse = await axios.get('https://api.linkedin.com/v2/me', {
                    headers: { 'Authorization': `Bearer ${accessToken}` }
                });
                selfProfile = {
                    urn: `urn:li:person:${profileResponse.data.id}`,
                    name: `${profileResponse.data.localizedFirstName} ${profileResponse.data.localizedLastName} (Self)`,
                    image: null
                };

                // Update cache
                setting.linkedinProfile = JSON.stringify(selfProfile);
                await setting.save();
            } catch (error: any) {
                if (error.response?.status === 403) {
                    console.warn('LinkedIn Profile access denied during scan.');
                } else {
                    console.warn('Failed to fetch self profile during scan:', error.response?.data || error.message);
                }
            }

            const finalList = selfProfile ? [selfProfile, ...organizations] : organizations;

            res.json({ message: 'Scan successful', count: finalList.length, organizations: finalList });

        } catch (error: any) {
            console.error('Error scanning LinkedIn organizations:', error?.response?.data || error);
            res.status(500).json({ error: 'Failed to scan organizations from LinkedIn' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Failed to scan organizations' });
    }
});

export default router;
