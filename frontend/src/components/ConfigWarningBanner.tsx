"use client";

import Link from "next/link";
import { AlertCircle, ArrowRight } from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";
import { useAuth } from "@/context/AuthContext";

export function ConfigWarningBanner() {
    const { settings, loading } = useSettings();
    const { token } = useAuth();

    if (loading || !token || settings.isOpenRouterConfigured) {
        return null;
    }

    return (
        <div className="bg-amber-50 border-b border-amber-200 py-3 px-8 animate-in slide-in-from-top duration-300">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 text-amber-800">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <p className="text-sm font-medium">
                        <span className="font-bold">AI Configuration Required:</span> OpenRouter API Key is missing. You won't be able to generate posts until this is configured.
                    </p>
                </div>
                <Link
                    href="/settings"
                    className="flex items-center gap-1 text-sm font-semibold text-amber-900 hover:text-amber-700 transition-colors whitespace-nowrap"
                >
                    Configure Now
                    <ArrowRight className="h-4 w-4" />
                </Link>
            </div>
        </div>
    );
}
