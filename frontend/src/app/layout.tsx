import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClientLayout } from "@/components/ClientLayout";
import { AuthorsProvider } from "@/contexts/AuthorsContext";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "DraftFlow",
    description: "Write, improve, and publish better LinkedIn posts consistently",
};

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
                            <ClientLayout>{children}</ClientLayout>
                            <Toaster
                                position="bottom-right"
                                toastOptions={{
                                    duration: 4000,
                                    style: {
                                        background: '#333',
                                        color: '#fff',
                                    },
                                    success: {
                                        duration: 3000,
                                        iconTheme: {
                                            primary: '#4ade80',
                                            secondary: '#fff',
                                        },
                                    },
                                    error: {
                                        duration: 5000,
                                        iconTheme: {
                                            primary: '#ef4444',
                                            secondary: '#fff',
                                        },
                                    },
                                }}
                            />
                        </AuthorsProvider>
                    </SettingsProvider>
                </AuthProvider>
            </body>
        </html>
    );
}
