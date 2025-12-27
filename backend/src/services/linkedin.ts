import axios from 'axios';
import { Settings } from '../db';

class LinkedInService {
    async publishPost(userId: string, content: string, authorUrn?: string) {
        const setting = await Settings.findOne({ where: { userId } });

        if (!setting || !setting.linkedinAccessToken) {
            throw new Error('LinkedIn access token not found in settings.');
        }

        // Check if token is expired
        if (setting.linkedinExpiresAt && new Date() > setting.linkedinExpiresAt) {
            throw new Error('LinkedIn access token expired.');
        }

        const accessToken = setting.linkedinAccessToken;
        let finalAuthorUrn = authorUrn;

        // If no authorUrn provided, default to "Self"
        if (!finalAuthorUrn) {
            // Fetch user profile to get the URN (person ID)
            let profileResponse;
            try {
                profileResponse = await axios.get('https://api.linkedin.com/v2/me', {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                    },
                });
                finalAuthorUrn = `urn:li:person:${profileResponse.data.id}`;
            } catch (error: any) {
                console.error('LinkedIn Profile Error:', error.response?.data || error.message);
                throw new Error(`Failed to fetch LinkedIn profile: ${error.response?.status || error.message}`);
            }
        }

        const body = {
            author: finalAuthorUrn,
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

    async getPostStats(userId: string, postUrns: string[], authorUrn?: string) {
        if (postUrns.length === 0) return [];

        const setting = await Settings.findOne({ where: { userId } });
        if (!setting || !setting.linkedinAccessToken) return [];

        const accessToken = setting.linkedinAccessToken;
        const isOrg = authorUrn?.includes(':organization:');

        // Differentiate between Share URNs and UGC Post URNs
        const isUgc = postUrns[0]?.includes('urn:li:ugcPost:');
        const paramName = isUgc ? 'ugcPosts' : 'shares';
        const sharesParam = encodeURIComponent(`List(${postUrns.join(',')})`);

        let baseUrl = isOrg
            ? 'https://api.linkedin.com/v2/organizationalEntityShareStatistics'
            : 'https://api.linkedin.com/v2/shareStatistics';

        let url = `${baseUrl}?${paramName}=${sharesParam}`;
        if (isOrg) {
            url += `&organizationalEntity=${encodeURIComponent(authorUrn as string)}`;
        }

        console.log(`[LinkedInService] CALLING: ${url}`);
        console.log(`[LinkedInService] Fetching ${paramName} stats for ${postUrns.length} posts. First URN: ${postUrns[0]}`);

        try {
            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'X-Restli-Protocol-Version': '2.0.0',
                },
            });

            const results = response.data.elements || [];
            return results.map((item: any) => ({
                urn: item.share || item.ugcPost || item.organizationalEntity,
                likes: item.totalShareStatistics?.likeCount || 0,
                comments: item.totalShareStatistics?.commentCount || 0,
                reposts: item.totalShareStatistics?.shareCount || 0,
                impressions: item.totalShareStatistics?.impressionCount || 0
            }));
        } catch (error: any) {
            console.error(`LinkedIn Stats Error (${paramName}):`, error.response?.data || error.message);
            return [];
        }
    }
}

export const linkedinService = new LinkedInService();
