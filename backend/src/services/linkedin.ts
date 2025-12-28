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

        // Normalizing URNs: The practices suggest using urn:li:activity:ID
        // We'll try to use the most compatible format for the aggregate endpoint
        const normalizedUrns = postUrns.map(urn => {
            if (urn.includes('urn:li:share:')) return urn;
            if (urn.includes('urn:li:ugcPost:')) return urn;
            // Fallback: If it's already an activity URN or other, keep it
            return urn;
        });

        const paramName = normalizedUrns[0]?.includes('urn:li:ugcPost:') ? 'ugcPosts' : 'shares';
        const sharesParam = encodeURIComponent(`List(${normalizedUrns.join(',')})`);

        let baseUrl = isOrg
            ? 'https://api.linkedin.com/v2/organizationalEntityShareStatistics'
            : 'https://api.linkedin.com/v2/shareStatistics';

        let url = `${baseUrl}?${paramName}=${sharesParam}`;
        if (isOrg) {
            url += `&organizationalEntity=${encodeURIComponent(authorUrn as string)}`;
        }

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
            // If the aggregate call fails, we log it. 
            // The practices suggest granular endpoints for standard accounts to avoid blocks.
            console.error(`LinkedIn Aggregate Stats Error (${paramName}):`, error.response?.data || error.message);
            return [];
        }
    }

    /**
     * Optional: Fetch detailed social actions if aggregate fails or for specific deeper insights.
     * Follows the practice: GET https://api.linkedin.com/rest/socialActions/{urn}/comments
     */
    async getDetailedSocialActions(userId: string, activityUrn: string) {
        const setting = await Settings.findOne({ where: { userId } });
        if (!setting || !setting.linkedinAccessToken) return null;

        // Ensure we're using the activity URN format as requested in step 1 of practices
        const normalizedUrn = activityUrn.replace('share', 'activity').replace('ugcPost', 'activity');

        try {
            const headers = {
                'Authorization': `Bearer ${setting.linkedinAccessToken}`,
                'LinkedIn-Version': '202306',
                'X-Restli-Protocol-Version': '2.0.0'
            };

            // Get Likes (Reactions)
            const reactionsUrl = `https://api.linkedin.com/rest/reactions/(entity:${encodeURIComponent(normalizedUrn)})?q=entity`;
            const reactionsRes = await axios.get(reactionsUrl, { headers });
            const likesCount = reactionsRes.data.paging?.total || 0;

            // Get Comments
            const commentsUrl = `https://api.linkedin.com/rest/socialActions/${encodeURIComponent(normalizedUrn)}/comments`;
            const commentsRes = await axios.get(commentsUrl, { headers });
            const commentsCount = commentsRes.data.paging?.total || 0;

            return {
                likes: likesCount,
                comments: commentsCount
            };
        } catch (error: any) {
            console.error(`LinkedIn Detailed Stats Error for ${normalizedUrn}:`, error.response?.data || error.message);
            return null;
        }
    }

    async getRecentPosts(userId: string, authorUrn?: string, count: number = 20) {
        const setting = await Settings.findOne({ where: { userId } });
        if (!setting || !setting.linkedinAccessToken) return [];

        const accessToken = setting.linkedinAccessToken;
        let finalAuthorUrn = authorUrn;

        if (!finalAuthorUrn) {
            try {
                const profileResponse = await axios.get('https://api.linkedin.com/v2/me', {
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                });
                finalAuthorUrn = `urn:li:person:${profileResponse.data.id}`;
            } catch (error) {
                console.error('Failed to fetch profile for URN resolution', error);
                return [];
            }
        }

        try {
            const encodedUrn = encodeURIComponent(finalAuthorUrn);
            const url = `https://api.linkedin.com/v2/ugcPosts?q=authors&authors=List(${encodedUrn})&count=${count}`;

            const response = await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'X-Restli-Protocol-Version': '2.0.0',
                },
            });

            return response.data.elements.map((item: any) => {
                const specificContent = item.specificContent?.['com.linkedin.ugc.ShareContent'];
                return {
                    id: item.id, // urn:li:ugcPost:123
                    urn: item.id,
                    content: specificContent?.shareCommentary?.text || '',
                    createdAt: item.created?.time, // Timestamp
                    visibility: item.visibility?.['com.linkedin.ugc.MemberNetworkVisibility']
                };
            });
        } catch (error: any) {
            console.error('LinkedIn GetRecentPosts Error:', error.response?.data || error.message);
            return [];
        }
    }
}

export const linkedinService = new LinkedInService();
