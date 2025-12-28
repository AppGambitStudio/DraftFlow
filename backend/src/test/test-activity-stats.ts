import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const token = 'AQWWQKR8NWhIIQ_wDZQywGdo7RJoHgxH0OPDWG8jlleSARxGbatzX70WccwZ6MVyjMfx7Vztt0yRUuoWbYkgtVH84qrtzJ8HPhBng7xuo6zgHShoJMBl-V1EsIsFi-WlyxXn2r7Wbk1O4BS8aVuXae_S3aO19TRxpzgCd_BegR4zqXsycZucuZntIZr9O0J-leYm-2zyYLecdDyM3k0TEexMVYyb3CByeTUPRKPaZ34qqTvXzfgdRXlhBo1XwV8L7MLJ_uWSCM90AdxErpKDba8wsVInmQ_ITkKcCh2kXCKplZJUi_mZK9DdPSuyYvSGatNdkJz-XVCz-p3mB9H6tPZOMFdLZw';
const postUrn = 'urn:li:share:7410586013263101952'; // Example share URN
const activityUrn = postUrn.replace('share', 'activity');

async function testActivityStats() {
    const urls = [
        `https://api.linkedin.com/v2/shareStatistics?shares=List(${encodeURIComponent(activityUrn)})`,
        `https://api.linkedin.com/v2/organizationalEntityShareStatistics?shares=List(${encodeURIComponent(activityUrn)})&organizationalEntity=urn:li:organization:14565523`,
        // Also test the granular endpoint from image
        `https://api.linkedin.com/rest/reactions/(entity:${encodeURIComponent(activityUrn)})?q=entity`
    ];

    for (const url of urls) {
        console.log(`Testing URL: ${url}`);
        try {
            const res = await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Restli-Protocol-Version': '2.0.0',
                    'LinkedIn-Version': '202306' // Some modern endpoints need this
                }
            });
            console.log('SUCCESS:', JSON.stringify(res.data, null, 2));
        } catch (e: any) {
            console.log('FAILED:', e.response?.status, e.response?.data);
        }
        console.log('---');
    }
}

testActivityStats();
