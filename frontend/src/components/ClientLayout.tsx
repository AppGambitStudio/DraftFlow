"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { ConfigWarningBanner } from "@/components/ConfigWarningBanner";
import { useAuth } from "@/context/AuthContext";

export function ClientLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const { user, loading } = useAuth();

    // Check if the current page should use a clean public layout
    const isPublicLayout =
        (pathname === "/" && !user) ||
        pathname === "/login" ||
        pathname === "/signup" ||
        pathname === "/accept-invite";

    // Show loading state while auth initializes to prevent screen flicker/flashes
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-indigo-600" />
                    <p className="text-sm text-slate-500 font-medium">Loading DraftFlow...</p>
                </div>
            </div>
        );
    }

    if (isPublicLayout) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col">
                <ConfigWarningBanner />
                <main className="flex-1">
                    {children}
                </main>
            </div>
        );
    }

    return (
        <div className="flex h-screen overflow-hidden bg-slate-50">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <ConfigWarningBanner />
                <main className="flex-1 overflow-y-auto p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
