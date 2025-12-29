
import axios from 'axios';

async function testApi() {
    const email = 'vishal.kodi@appgambit.com';
    const password = 'password'; // Assuming this is the password

    try {
        const loginRes = await axios.post('http://localhost:5002/api/user-auth/login', { email, password });
        const token = loginRes.data.token;
        console.log('Login successful');

        const inviteRes = await axios.get('http://localhost:5002/api/invitations/mine', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log('Invitations:', JSON.stringify(inviteRes.data, null, 2));
    } catch (error: any) {
        console.error('API Test Error:', error.response?.data || error.message);
    }
}

testApi();
