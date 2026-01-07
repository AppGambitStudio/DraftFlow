import axios from 'axios';
import { Settings, initDB } from '../db';

async function testWebhooks() {
    await initDB();

    const setting = await Settings.findOne();
    if (!setting) {
        console.error('No settings found. Run the app first.');
        process.exit(1);
    }

    const tenantId = setting.tenantId;
    const webhookSecret = setting.webhookSecret;
    const baseUrl = 'http://localhost:5002/api/webhooks';

    console.log(`Testing with Tenant ID: ${tenantId}, Secret: ${webhookSecret}`);

    const testPayload = {
        title: "Test Idea from Script " + new Date().toISOString(),
        summary: "This is a test idea to verify webhook security.",
        tags: ["test", "security"]
    };

    // 1. Test without headers
    try {
        console.log('\n1. Testing without headers...');
        await axios.post(`${baseUrl}/idea`, testPayload);
        console.error('FAILED: Should have failed without headers');
    } catch (error: any) {
        console.log('SUCCESS: Failed as expected:', error.response?.status, error.response?.data);
    }

    // 2. Test with wrong secret
    try {
        console.log('\n2. Testing with wrong secret...');
        await axios.post(`${baseUrl}/idea`, testPayload, {
            headers: {
                'X-Tenant-ID': tenantId,
                'X-Webhook-Secret': 'wrong-secret'
            }
        });
        console.error('FAILED: Should have failed with wrong secret');
    } catch (error: any) {
        console.log('SUCCESS: Failed as expected:', error.response?.status, error.response?.data);
    }

    // 3. Test with correct headers
    try {
        console.log('\n3. Testing with correct headers...');
        const response = await axios.post(`${baseUrl}/idea`, testPayload, {
            headers: {
                'X-Tenant-ID': tenantId,
                'X-Webhook-Secret': webhookSecret
            }
        });
        console.log('SUCCESS: Idea created:', response.status, response.data);
    } catch (error: any) {
        console.error('FAILED: Should have succeeded with correct headers', error.response?.data || error.message);
    }

    // 4. Test Schedule with correct headers
    try {
        console.log('\n4. Testing schedule with correct headers...');
        const response = await axios.post(`${baseUrl}/schedule`, {
            content: "Test scheduled post from script",
            platforms: ["LINKEDIN"]
        }, {
            headers: {
                'X-Tenant-ID': tenantId,
                'X-Webhook-Secret': webhookSecret
            }
        });
        console.log('SUCCESS: Post scheduled:', response.status, response.data);
    } catch (error: any) {
        console.error('FAILED: Should have succeeded with correct headers', error.response?.data || error.message);
    }
}

testWebhooks();
