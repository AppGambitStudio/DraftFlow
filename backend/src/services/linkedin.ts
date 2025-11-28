import axios from 'axios';
import { Settings } from '../db';

class LinkedInService {
    async publishPost(content: string) {
        const setting = await Settings.findOne();

        if (!setting || !setting.linkedinAccessToken) {
            throw new Error('LinkedIn access token not found in settings.');
        }

        // Check if token is expired
        if (setting.linkedinExpiresAt && new Date() > setting.linkedinExpiresAt) {
            throw new Error('LinkedIn access token expired.');
        }

        const accessToken = setting.linkedinAccessToken;

        // Fetch user profile to get the URN (person ID)
        let profileResponse;
        try {
            profileResponse = await axios.get('https://api.linkedin.com/v2/me', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });
        } catch (error: any) {
            console.error('LinkedIn Profile Error:', error.response?.data || error.message);
            throw new Error(`Failed to fetch LinkedIn profile: ${error.response?.status || error.message}`);
        }

        const personUrn = `urn:li:person:${profileResponse.data.id}`;

        const body = {
            author: personUrn,
            lifecycleState: 'PUBLISHED',
            specificContent: {
                'com.linkedin.ugc.ShareContent': {
                    shareCommentary: {
                        text: content,
                    },
                    shareMediaCategory: 'NONE', // Default to text only for now
                },
            },
            visibility: {
                'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
            },
        };

        try {
            const response = await axios.post('https://api.linkedin.com/v2/ugcPosts', body, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'X-Restli-Protocol-Version': '2.0.0',
                },
            });
            return response.data.id; // Return just the ID
        } catch (error: any) {
            console.error('LinkedIn API Error:', error.response?.data || error.message);
            throw error;
        }
    }
}

export const linkedinService = new LinkedInService();
