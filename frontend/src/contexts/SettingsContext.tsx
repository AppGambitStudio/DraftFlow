"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';

interface Settings {
    targetAudiences: string[];
    maxHistoryItems: number;
    globalTone: string;
    accountTones: Record<string, string>;
    isOpenRouterConfigured: boolean;
    companyName: string;
    industry: string;
    companyDescription: string;
    expertiseAreas: string[];
    contentPillars: string[];
}

interface SettingsContextType {
    settings: Settings;
    loading: boolean;
    refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
    const { token, currentTenant } = useAuth();
    const [settings, setSettings] = useState<Settings>({
        targetAudiences: [],
        maxHistoryItems: 5,
        globalTone: "",
        accountTones: {},
        isOpenRouterConfigured: true, // Default to true to avoid flash
        companyName: "",
        industry: "",
        companyDescription: "",
        expertiseAreas: [],
        contentPillars: [],
    });
    const [loading, setLoading] = useState(true);

    const fetchSettings = async () => {
        if (!token) return;
        try {
            setLoading(true);
            const res = await api.get('/settings');
            const audiences = res.data.targetAudiences
                ? res.data.targetAudiences.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0)
                : [];

            let accountTones = {};
            if (res.data.accountTones) {
                try {
                    accountTones = JSON.parse(res.data.accountTones);
                } catch (e) {
                    console.error('Failed to parse accountTones:', e);
                }
            }

            let expertiseAreas: string[] = [];
            if (res.data.expertiseAreas) {
                try {
                    expertiseAreas = JSON.parse(res.data.expertiseAreas);
                } catch (e) {
                    console.error('Failed to parse expertiseAreas:', e);
                }
            }

            let contentPillars: string[] = [];
            if (res.data.contentPillars) {
                try {
                    contentPillars = JSON.parse(res.data.contentPillars);
                } catch (e) {
                    console.error('Failed to parse contentPillars:', e);
                }
            }

            setSettings({
                targetAudiences: audiences,
                maxHistoryItems: res.data.maxHistoryItems !== undefined ? res.data.maxHistoryItems : 5,
                globalTone: res.data.globalTone || "",
                accountTones,
                isOpenRouterConfigured: !!res.data.openRouterApiKey,
                companyName: res.data.companyName || "",
                industry: res.data.industry || "",
                companyDescription: res.data.companyDescription || "",
                expertiseAreas,
                contentPillars,
            });
        } catch (error) {
            console.error('Failed to fetch settings:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (token) {
            fetchSettings();
        } else {
            setSettings({
                targetAudiences: [],
                maxHistoryItems: 5,
                globalTone: "",
                accountTones: {},
                isOpenRouterConfigured: true,
                companyName: "",
                industry: "",
                companyDescription: "",
                expertiseAreas: [],
                contentPillars: [],
            });
            setLoading(false);
        }
    }, [token, currentTenant?.id]);

    return (
        <SettingsContext.Provider value={{ settings, loading, refreshSettings: fetchSettings }}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
}
