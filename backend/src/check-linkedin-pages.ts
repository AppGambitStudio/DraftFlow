
import axios from 'axios';
import { initDB, Settings } from './db';

const run = async () => {
    await initDB();

    console.log('--- Checking LinkedIn Company Pages ---');

    const settings = await Settings.findOne();
    if (!settings || !settings.linkedinAccessToken) {
        console.error('Error: No LinkedIn Access Token found in settings.');
        return;
    }

    const accessToken = settings.linkedinAccessToken;
    console.log('Access Token found. Querying LinkedIn API...');

    try {
        const url = 'https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee&role=ADMINISTRATOR&projection=(elements*(organizationalTarget~(id,localizedName)))';

        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'X-Restli-Protocol-Version': '2.0.0'
            }
        });

        console.log('Response Status:', response.status);
        console.log('Response Data:', JSON.stringify(response.data, null, 2));

        if (response.data && response.data.elements) {
            console.log('\n--- Accessible Pages ---');
            response.data.elements.forEach((element: any) => {
                const target = element.organizationalTarget;
                if (target) {
                    console.log(`Name: ${target.localizedName}`);
                    console.log(`ID: ${target.id}`); // This might be the URN or just ID depending on projection
                    console.log(`URN: ${element.organizationalTargetUrn || 'N/A'}`); // In case projection misses it
                    console.log('---');
                }
            });
        }

    } catch (error: any) {
        console.error('Error fetching pages:', error.response?.data || error.message);
    }
};

// run().catch(console.error);
