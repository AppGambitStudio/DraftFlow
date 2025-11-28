import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "LinkedIn Post Scheduler",
    description: "Schedule and publish LinkedIn posts",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <div className="h-6 bg-amber-100 text-amber-800 text-[10px] font-medium flex items-center justify-center border-b border-amber-200 fixed top-0 w-full z-50">
                    This is a non-auth application, for personal-use only.
                </div>
                <div className="flex h-screen overflow-hidden bg-slate-50 pt-6">
                    <Sidebar />
                    <main className="flex-1 overflow-y-auto p-8">
                        {children}
                    </main>
                </div>
            </body>
        </html>
    );
}
