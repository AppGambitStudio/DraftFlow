import axios from 'axios';
import fs from 'fs';
import { Settings } from '../db';

class LinkedInService {
    /**
     * Refresh the LinkedIn access token using the stored refresh token.
     * Returns the new access token, or throws if refresh fails.
     */
    private async refreshAccessToken(setting: any): Promise<string> {
        if (!setting.linkedinRefreshToken) {
            throw new Error('LinkedIn access token expired and no refresh token available. Please reconnect your LinkedIn account.');
        }

        const clientId = setting.linkedinClientId || process.env.LINKEDIN_CLIENT_ID;
        const clientSecret = setting.linkedinClientSecret || process.env.LINKEDIN_CLIENT_SECRET;

        if (!clientId || !clientSecret) {
            throw new Error('LinkedIn access token expired and client credentials are missing for refresh. Please reconnect your LinkedIn account.');
        }

        console.log('[LinkedIn] Access token expired, attempting refresh...');

        const response = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', null, {
            params: {
                grant_type: 'refresh_token',
                refresh_token: setting.linkedinRefreshToken,
                client_id: clientId,
                client_secret: clientSecret
            },
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        const { access_token, expires_in, refresh_token } = response.data;
        const expiresAt = new Date(Date.now() + expires_in * 1000);

        await setting.update({
            linkedinAccessToken: access_token,
            linkedinRefreshToken: refresh_token || setting.linkedinRefreshToken,
            linkedinExpiresAt: expiresAt
        });

        console.log('[LinkedIn] Token refreshed successfully, new expiry:', expiresAt.toISOString());
        return access_token;
    }

    /**
     * Get a valid access token, refreshing if expired.
     */
    private async getValidAccessToken(setting: any): Promise<string> {
        if (setting.linkedinExpiresAt && new Date() > setting.linkedinExpiresAt) {
            try {
                return await this.refreshAccessToken(setting);
            } catch (error: any) {
                console.error('[LinkedIn] Token refresh failed:', error.response?.data || error.message);
                throw new Error('LinkedIn access token expired and refresh failed. Please reconnect your LinkedIn account in Settings.');
            }
        }
        return setting.linkedinAccessToken;
    }

    async publishPost(tenantId: string, content: string, authorUrn?: string, attachments?: any[]) {
        const setting = await Settings.findOne({ where: { tenantId } });

        if (!setting || !setting.linkedinAccessToken) {
            throw new Error('LinkedIn access token not found in settings.');
        }

        const accessToken = await this.getValidAccessToken(setting);
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

        let mediaCategory = 'NONE';
        let media: any[] = [];

        if (attachments && attachments.length > 0) {
            try {
                // Determine if we have multiple attachments or mixed types
                const images = attachments.filter(a => a.type.startsWith('image/'));
                const documents = attachments.filter(a => !a.type.startsWith('image/'));

                if (images.length > 0 && documents.length === 0) {
                    mediaCategory = 'IMAGE';
                    for (const attachment of images) {
                        const assetUrn = await this.uploadMedia(accessToken, finalAuthorUrn as string, attachment);
                        media.push({
                            status: 'READY',
                            media: assetUrn,
                            title: { text: attachment.name },
                            description: { text: attachment.name }
                        });
                    }
                } else if (documents.length > 0 && images.length === 0) {
                    // LinkedIn only supports ONE document per post via ugcPosts
                    // Using the first document
                    const attachment = documents[0];
                    mediaCategory = 'DOCUMENT';
                    const assetUrn = await this.uploadMedia(accessToken, finalAuthorUrn as string, attachment);
                    media.push({
                        status: 'READY',
                        media: assetUrn,
                        title: { text: attachment.name }
                    });
                } else if (images.length > 0 && documents.length > 0) {
                    // Mixed media: Prioritize images in LinkedIn for now as it doesn't support mixed IMAGE + DOCUMENT in one go easily
                    mediaCategory = 'IMAGE';
                    for (const attachment of images) {
                        const assetUrn = await this.uploadMedia(accessToken, finalAuthorUrn as string, attachment);
                        media.push({
                            status: 'READY',
                            media: assetUrn,
                            title: { text: attachment.name },
                            description: { text: attachment.name }
                        });
                    }
                }
            } catch (error: any) {
                console.error('LinkedIn Media Upload Error:', error.message);
                throw new Error(`Failed to upload media to LinkedIn: ${error.message}`);
            }
        }

        const body: any = {
            author: finalAuthorUrn,
            lifecycleState: 'PUBLISHED',
            specificContent: {
                'com.linkedin.ugc.ShareContent': {
                    shareCommentary: {
                        text: content,
                    },
                    shareMediaCategory: mediaCategory,
                },
            },
            visibility: {
                'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
            },
        };

        if (mediaCategory !== 'NONE') {
            body.specificContent['com.linkedin.ugc.ShareContent'].media = media;
        }

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

    private async uploadMedia(accessToken: string, authorUrn: string, attachment: any): Promise<string> {
        const isImage = attachment.type.startsWith('image/');
        const action = isImage ? 'registerUpload' : 'registerUpload'; // Both use same for assets API
        const recipe = isImage ? 'urn:li:digitalmediaRecipe:feedshare-image' : 'urn:li:digitalmediaRecipe:feedshare-document';
        const service = isImage ? 'IMAGE' : 'DOCUMENT';

        const registerBody = {
            registerUploadRequest: {
                recipes: [recipe],
                owner: authorUrn,
                serviceRelationships: [
                    {
                        relationshipType: 'OWNER',
                        identifier: 'urn:li:userGeneratedContent',
                    },
                ],
            },
        };

        const registerResponse = await axios.post('https://api.linkedin.com/v2/assets?action=registerUpload', registerBody, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'X-Restli-Protocol-Version': '2.0.0',
            },
        });

        const uploadUrl = registerResponse.data.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
        const assetUrn = registerResponse.data.value.asset;

        // Read file from uploads directory
        const filePath = attachment.url.startsWith('/')
            ? `./${attachment.url.substring(1)}` // Remove leading /
            : attachment.url;

        const fileData = fs.readFileSync(filePath);

        await axios.put(uploadUrl, fileData, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': attachment.type,
            },
        });

        return assetUrn;
    }

    async getPostStats(tenantId: string, postUrns: string[], authorUrn?: string) {
        if (postUrns.length === 0) return [];

        const setting = await Settings.findOne({ where: { tenantId } });
        if (!setting || !setting.linkedinAccessToken) return [];

        const accessToken = await this.getValidAccessToken(setting);
        const isOrg = authorUrn?.includes(':organization:');

        console.log(`[LinkedIn] Fetching stats for ${postUrns.length} posts, isOrg=${isOrg}, authorUrn=${authorUrn}`);

        // For personal profiles, try v2 shareStatistics (batch)
        if (!isOrg) {
            const v2Headers = {
                'Authorization': `Bearer ${accessToken}`,
                'X-Restli-Protocol-Version': '2.0.0',
            };

            const normalizedUrns = postUrns.map(urn => {
                if (urn.includes('urn:li:share:') || urn.includes('urn:li:ugcPost:')) return urn;
                return `urn:li:ugcPost:${urn}`;
            });

            const paramName = normalizedUrns[0]?.includes('urn:li:ugcPost:') ? 'ugcPosts' : 'shares';
            const listParam = encodeURIComponent(`List(${normalizedUrns.join(',')})`);
            const url = `https://api.linkedin.com/v2/shareStatistics?${paramName}=${listParam}`;

            try {
                const response = await axios.get(url, { headers: v2Headers });
                const results = response.data.elements || [];
                if (results.length > 0) {
                    return results.map((item: any) => ({
                        urn: item.ugcPost || item.share || '',
                        likes: item.totalShareStatistics?.likeCount || 0,
                        comments: item.totalShareStatistics?.commentCount || 0,
                        reposts: item.totalShareStatistics?.shareCount || 0,
                        impressions: item.totalShareStatistics?.impressionCount || 0,
                    }));
                }
            } catch (error: any) {
                console.error(`[LinkedIn] v2 Stats Error:`, error.response?.status, error.response?.data?.message || error.message);
            }
        }

        // For org posts: the per-post aggregate stats APIs require partner-level access,
        // so we return empty here and let the caller fall back to granular v2/socialActions
        // which works with standard r_organization_social scope.
        return [];
    }

    /**
     * Fetch detailed social actions per post (granular fallback).
     * Uses the v2 API (not /rest which requires partner access).
     */
    async getDetailedSocialActions(tenantId: string, postUrn: string) {
        const setting = await Settings.findOne({ where: { tenantId } });
        if (!setting || !setting.linkedinAccessToken) return null;

        const accessToken = await this.getValidAccessToken(setting);
        const headers = {
            'Authorization': `Bearer ${accessToken}`,
            'X-Restli-Protocol-Version': '2.0.0'
        };

        // The socialActions v2 endpoint uses the URN as-is (urn:li:share: or urn:li:ugcPost:)
        console.log(`[LinkedIn] Fetching detailed stats for ${postUrn}`);

        let likesCount = 0;
        let commentsCount = 0;
        let repostsCount = 0;

        // Try v2 socialActions endpoint (works with standard OAuth scopes)
        try {
            const socialActionsUrl = `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(postUrn)}`;
            const socialRes = await axios.get(socialActionsUrl, { headers });
            likesCount = socialRes.data?.likesSummary?.totalLikes || 0;
            commentsCount = socialRes.data?.commentsSummary?.totalFirstLevelComments || 0;
            repostsCount = socialRes.data?.sharesSummary?.totalShares || 0;
            console.log(`[LinkedIn] v2 socialActions success: likes=${likesCount}, comments=${commentsCount}, reposts=${repostsCount}`);
        } catch (socialErr: any) {
            const status = socialErr.response?.status;
            if (status === 429) {
                console.log(`[LinkedIn] Rate limited (429). Returning null to stop further calls.`);
                return null; // Signal caller to stop
            }
            console.error(`[LinkedIn] v2 socialActions failed for ${postUrn}:`, status, socialErr.response?.data?.message || socialErr.message);

            // Fallback: try v2 individual endpoints
            try {
                const likesUrl = `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(postUrn)}/likes?count=0`;
                const likesRes = await axios.get(likesUrl, { headers });
                likesCount = likesRes.data.paging?.total || 0;
            } catch (e: any) {
                if (e.response?.status === 429) return null;
            }

            try {
                const commentsUrl = `https://api.linkedin.com/v2/socialActions/${encodeURIComponent(postUrn)}/comments?count=0`;
                const commentsRes = await axios.get(commentsUrl, { headers });
                commentsCount = commentsRes.data.paging?.total || 0;
            } catch (e: any) {
                if (e.response?.status === 429) return null;
            }
        }

        return {
            likes: likesCount,
            comments: commentsCount,
            reposts: repostsCount,
            impressions: 0
        };
    }

    async getRecentPosts(tenantId: string, authorUrn?: string, count: number = 20) {
        const setting = await Settings.findOne({ where: { tenantId } });
        if (!setting || !setting.linkedinAccessToken) return [];

        const accessToken = await this.getValidAccessToken(setting);
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
