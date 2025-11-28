import express from 'express';
import { Settings } from '../db';

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
        openRouterApiKey
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
            }
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
        });

        res.json(setting);
    } catch (error: any) {
        console.log(error);
        res.status(500).json({ error: 'Failed to save settings, ' + error?.toString() });
    }
});

export default router;
