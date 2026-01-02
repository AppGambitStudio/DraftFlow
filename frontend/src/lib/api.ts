import axios from 'axios';

const api = axios.create({
    baseURL: typeof window !== 'undefined'
        ? `http://${window.location.hostname}:5002/api`
        : 'http://localhost:5002/api',
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    const tenantId = localStorage.getItem('tenantId');

    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    if (tenantId) {
        config.headers['x-tenant-id'] = tenantId;
    }
    return config;
});

export default api;
