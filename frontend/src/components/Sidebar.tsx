"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, PenSquare, Settings, Lightbulb, Calendar, LogOut, User as UserIcon, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";

import { version } from "../../package.json";

const navItems = [
    { href: "/", label: "Dashboard", icon: LayoutDashboard },
    { href: "/ideas", label: "Idea Board", icon: Lightbulb },
    { href: "/trends", label: "Trends", icon: TrendingUp },
    { href: "/calendar", label: "Calendar", icon: Calendar },
    { href: "/create", label: "Create Post", icon: PenSquare },
    { href: "/users", label: "Users", icon: UserIcon },
    { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
    const pathname = usePathname();
    const { user, logout, tenants, currentTenant, switchTenant } = useAuth();

    const isPublicPage = pathname === '/login' || pathname === '/signup' || pathname === '/accept-invite';

    if (isPublicPage) return null;

    return (
        <div className="flex h-full w-64 flex-col border-r bg-white text-slate-900">
            <div className="flex h-16 items-center border-b px-6">
                <h1 className="text-xl font-bold tracking-tight">DraftFlow</h1>
            </div>

            {/* Tenant Switcher */}
            {user && (
                <div className="px-4 py-4 border-b">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 block px-2">
                        Workspace
                    </label>
                    {tenants.length > 1 ? (
                        <select
                            className="w-full text-sm border-slate-200 rounded-md p-2 bg-slate-50 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400"
                            value={currentTenant?.id || ''}
                            onChange={(e) => switchTenant(e.target.value)}
                        >
                            {tenants.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    ) : (
                        <div className="px-2 py-1 text-sm font-medium text-slate-900 truncate">
                            {currentTenant?.name || 'My Workspace'}
                        </div>
                    )}
                </div>
            )}

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
            <div className="mt-auto border-t">
                {user && (
                    <div className="px-6 py-4 border-b bg-slate-50/50">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500">
                                <UserIcon className="h-4 w-4" />
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <p className="text-xs font-medium text-slate-900 truncate">
                                    {user.email}
                                </p>
                                <button
                                    onClick={logout}
                                    className="text-[10px] text-slate-500 hover:text-red-600 transition-colors flex items-center gap-1 mt-1"
                                >
                                    <LogOut className="h-3 w-3" />
                                    Logout
                                </button>
                            </div>
                        </div>
                    </div>
                )}
                <div className="p-4 text-xs text-slate-400">
                    <div className="mb-1">v{version}</div>
                    <div>&copy; {new Date().getFullYear()} APPGAMBiT</div>
                </div>
            </div>
        </div>
    );
}
