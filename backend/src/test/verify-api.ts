import axios from 'axios';

async function verifyApi() {
    const API_URL = 'http://localhost:5002/api';

    try {
        console.log('1. Testing GET /settings...');
        const getRes = await axios.get(`${API_URL}/settings`);
        console.log('GET /settings Response:', getRes.data);

        console.log('2. Testing POST /settings...');
        const postRes = await axios.post(`${API_URL}/settings`, {
            linkedinAccessToken: 'test-token-from-script'
        });
        console.log('POST /settings Response:', postRes.data);

    } catch (error: any) {
        console.error('API Verification Failed:', error.response?.data || error.message);
    }
}

verifyApi();
