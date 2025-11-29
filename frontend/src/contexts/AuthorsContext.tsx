"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from "@/lib/api";

interface Author {
    urn: string;
    name: string;
    image?: string | null;
}

interface AuthorsContextType {
    authors: Author[];
    loading: boolean;
    error: string | null;
    refreshAuthors: () => Promise<void>;
}

const AuthorsContext = createContext<AuthorsContextType | undefined>(undefined);

export function AuthorsProvider({ children }: { children: ReactNode }) {
    const [authors, setAuthors] = useState<Author[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAuthors = async () => {
        try {
            setLoading(true);
            const res = await api.get('/settings/linkedin/authors');
            setAuthors(res.data);
            setError(null);
        } catch (err: any) {
            console.error('Failed to fetch authors:', err);
            setError(err.message || 'Failed to fetch authors');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAuthors();
    }, []);

    return (
        <AuthorsContext.Provider value={{ authors, loading, error, refreshAuthors: fetchAuthors }}>
            {children}
        </AuthorsContext.Provider>
    );
}

export function useAuthors() {
    const context = useContext(AuthorsContext);
    if (context === undefined) {
        throw new Error('useAuthors must be used within an AuthorsProvider');
    }
    return context;
}
