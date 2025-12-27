import axios from 'axios';

const API_URL = 'http://localhost:5002/api';

async function verifyInteraction() {
    try {
        // 1. Create a DRAFT post
        console.log('1. Creating DRAFT post...');
        const createRes = await axios.post(`${API_URL}/posts`, {
            content: 'Interaction Test Post',
            scheduledTime: new Date().toISOString(),
            status: 'DRAFT'
        });
        const postId = createRes.data.id;
        console.log('Created post:', postId);

        // 2. Edit the post
        console.log('2. Editing post...');
        const editRes = await axios.put(`${API_URL}/posts/${postId}`, {
            content: 'Updated Content'
        });
        console.log('Edited post content:', editRes.data.content);

        if (editRes.data.content !== 'Updated Content') {
            throw new Error('Edit failed');
        }

        // 3. Delete the post
        console.log('3. Deleting post...');
        await axios.delete(`${API_URL}/posts/${postId}`);
        console.log('Deleted post');

        // 4. Verify deletion
        try {
            await axios.put(`${API_URL}/posts/${postId}`, {});
            console.error('Error: Should not be able to update deleted post');
        } catch (e: any) {
            if (e.response && e.response.status === 404) {
                console.log('Verified post is deleted (404)');
            } else {
                console.error('Unexpected error verifying deletion:', e.message);
            }
        }

    } catch (error: any) {
        console.error('Verification Failed:', error.response?.data || error.message);
    }
}

verifyInteraction();
