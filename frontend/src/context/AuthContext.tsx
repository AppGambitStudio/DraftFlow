"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import api from '../lib/api';
import toast from 'react-hot-toast';

interface User {
    id: string;
    email: string;
}

interface Tenant {
    id: string;
    name: string;
    role: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    loading: boolean;
    tenants: Tenant[];
    currentTenant: Tenant | null;
    login: (token: string, user: User) => Promise<void>;
    logout: () => void;
    switchTenant: (tenantId: string) => void;
    refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    const fetchProfile = async () => {
        try {
            const res = await api.get('/user-auth/me');
            const data = res.data;
            setUser({ id: data.id, email: data.email });
            setTenants(data.tenants || []);

            // Resolve Current Tenant
            const storedTenantId = localStorage.getItem('tenantId');
            let selectedTenant = data.tenants.find((t: Tenant) => t.id === storedTenantId);

            if (!selectedTenant && data.tenants.length > 0) {
                selectedTenant = data.tenants[0];
            }

            if (selectedTenant) {
                setCurrentTenant(selectedTenant);
                localStorage.setItem('tenantId', selectedTenant.id);
            }
        } catch (error) {
            console.error('Failed to fetch profile', error);
            // If 401, maybe logout?
            // logout(); 
        }
    };

    useEffect(() => {
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');

        if (storedToken) {
            setToken(storedToken);
            if (storedUser) setUser(JSON.parse(storedUser));
            // Fetch fresh data
            fetchProfile().finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    const login = async (newToken: string, newUser: User) => {
        setToken(newToken);
        setUser(newUser);
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(newUser));
        await fetchProfile(); // Load tenants
        router.push('/');
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        setTenants([]);
        setCurrentTenant(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('tenantId');
        router.push('/login');
        toast.success('Logged out successfully');
    };

    const switchTenant = (tenantId: string) => {
        const tenant = tenants.find(t => t.id === tenantId);
        if (tenant) {
            setCurrentTenant(tenant);
            localStorage.setItem('tenantId', tenant.id);
            toast.success(`Switched to ${tenant.name}`);
            window.location.reload(); // Reload to ensure all components refresh data with new header
        }
    };

    // Protect routes
    useEffect(() => {
        if (!loading) {
            const publicRoutes = ['/login', '/signup', '/accept-invite', '/landing'];
            // Check if path starts with public route
            const isPublic = publicRoutes.some(route => pathname.startsWith(route));

            if (!user && !isPublic) {
                router.push('/landing');
            }
        }
    }, [user, loading, pathname, router]);

    return (
        <AuthContext.Provider value={{
            user, token, loading,
            tenants, currentTenant,
            login, logout, switchTenant, refreshProfile: fetchProfile
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
