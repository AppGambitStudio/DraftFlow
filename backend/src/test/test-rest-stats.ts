import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const token = 'AQWWQKR8NWhIIQ_wDZQywGdo7RJoHgxH0OPDWG8jlleSARxGbatzX70WccwZ6MVyjMfx7Vztt0yRUuoWbYkgtVH84qrtzJ8HPhBng7xuo6zgHShoJMBl-V1EsIsFi-WlyxXn2r7Wbk1O4BS8aVuXae_S3aO19TRxpzgCd_BegR4zqXsycZucuZntIZr9O0J-leYm-2zyYLecdDyM3k0TEexMVYyb3CByeTUPRKPaZ34qqTvXzfgdRXlhBo1XwV8L7MLJ_uWSCM90AdxErpKDba8wsVInmQ_ITkKcCh2kXCKplZJUi_mZK9DdPSuyYvSGatNdkJz-XVCz-p3mB9H6tPZOMFdLZw';
const orgUrn = 'urn:li:organization:14565523';
const shareUrn = 'urn:li:share:7410582714569072640'; // Post #65

async function testRestEndpoint() {
    const urls = [
        `https://api.linkedin.com/rest/organizationalEntityShareStatistics?shares=List(${encodeURIComponent(shareUrn)})&organizationalEntity=${encodeURIComponent(orgUrn)}`,
    ];

    for (const url of urls) {
        console.log(`Testing URL: ${url}`);
        try {
            const res = await axios.get(url, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'X-Restli-Protocol-Version': '2.0.0',
                    'LinkedIn-Version': '202306'
                }
            });
            console.log('SUCCESS:', JSON.stringify(res.data, null, 2));
        } catch (e: any) {
            console.log('FAILED:', e.response?.status, e.response?.data);
        }
    }
}

testRestEndpoint();
