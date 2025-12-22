import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "LinkedIn Post Scheduler",
    description: "Schedule and publish LinkedIn posts",
};

import { AuthorsProvider } from "@/contexts/AuthorsContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "react-hot-toast";

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <AuthProvider>
                    <SettingsProvider>
                        <AuthorsProvider>
                            <div className="flex h-screen overflow-hidden bg-slate-50">
                                <Sidebar />
                                <main className="flex-1 overflow-y-auto p-8">
                                    {children}
                                </main>
                            </div>
                            <Toaster position="bottom-right" />
                        </AuthorsProvider>
                    </SettingsProvider>
                </AuthProvider>
            </body>
        </html>
    );
}
