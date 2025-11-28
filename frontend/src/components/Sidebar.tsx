"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, PenSquare, Settings, Lightbulb, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

import { version } from "../../package.json";

const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/ideas", label: "Idea Board", icon: Lightbulb },
    { href: "/calendar", label: "Calendar", icon: Calendar },
    { href: "/create", label: "Create Post", icon: PenSquare },
    { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();

    return (
        <div className="flex h-full w-64 flex-col border-r bg-white text-slate-900">
            <div className="flex h-16 items-center border-b px-6">
                <h1 className="text-xl font-bold tracking-tight">AG PostScheduler</h1>
            </div>
            <nav className="flex-1 space-y-1 p-4">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-slate-100 text-slate-900"
                                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                            )}
                        >
                            <Icon className="h-5 w-5" />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>
            <div className="p-4 border-t text-xs text-slate-400">
                <div className="mb-1">v{version}</div>
                <div>&copy; {new Date().getFullYear()} APPGAMBiT</div>
            </div>
        </div>
    );
}
