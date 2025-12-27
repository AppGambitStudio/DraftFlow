"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface Settings {
    targetAudiences: string[];
    maxHistoryItems: number;
    globalTone: string;
    accountTones: Record<string, string>;
}

interface SettingsContextType {
    settings: Settings;
    loading: boolean;
    refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
    const [settings, setSettings] = useState<Settings>({
        targetAudiences: [],
        maxHistoryItems: 5,
        globalTone: "",
        accountTones: {}
    });
    const [loading, setLoading] = useState(true);

    const fetchSettings = async () => {
        try {
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

            setSettings({
                targetAudiences: audiences,
                maxHistoryItems: res.data.maxHistoryItems !== undefined ? res.data.maxHistoryItems : 5,
                globalTone: res.data.globalTone || "",
                accountTones
            });
        } catch (error) {
            console.error('Failed to fetch settings:', error);
            // Don't show toast here to avoid spamming on initial load if something minor fails
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

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
