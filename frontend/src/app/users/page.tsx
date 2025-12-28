"use client";

import { Users, UserPlus, Shield, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function UsersPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 animate-in fade-in duration-500">
            <div className="relative">
                <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 opacity-20 blur-xl animate-pulse"></div>
                <div className="relative flex items-center justify-center w-24 h-24 bg-primary/10 rounded-full border-2 border-primary/20">
                    <Users className="w-12 h-12 text-primary" />
                </div>
                <div className="absolute -bottom-2 -right-2 bg-background p-1.5 rounded-full border border-border shadow-sm">
                    <Sparkles className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                </div>
            </div>

            <div className="text-center space-y-4 max-w-lg">
                <h1 className="text-4xl font-bold tracking-tight text-foreground">
                    Team Collaboration <br />
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-violet-600">Coming Soon</span>
                </h1>
                <p className="text-muted-foreground text-lg leading-relaxed">
                    DraftFlow is evolving! Soon you'll be able to invite your team members to collaborate, manage posts together, and streamline your content workflow as a group.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl mt-8">
                <div className="flex flex-col items-center p-4 bg-card border rounded-xl shadow-sm">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg mb-3">
                        <UserPlus className="w-5 h-5" />
                    </div>
                    <h3 className="font-semibold mb-1">Invite Members</h3>
                    <p className="text-xs text-center text-muted-foreground">Add colleagues to your workspace instantly.</p>
                </div>
                <div className="flex flex-col items-center p-4 bg-card border rounded-xl shadow-sm">
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-lg mb-3">
                        <Users className="w-5 h-5" />
                    </div>
                    <h3 className="font-semibold mb-1">Shared Management</h3>
                    <p className="text-xs text-center text-muted-foreground">Co-create and approve content together.</p>
                </div>
                <div className="flex flex-col items-center p-4 bg-card border rounded-xl shadow-sm">
                    <div className="p-2 bg-green-50 text-green-600 rounded-lg mb-3">
                        <Shield className="w-5 h-5" />
                    </div>
                    <h3 className="font-semibold mb-1">Role Control</h3>
                    <p className="text-xs text-center text-muted-foreground">Admin and Editor roles for better security.</p>
                </div>
            </div>

            <div className="pt-8">
                <Button className="rounded-full px-8" disabled>
                    Join Waitlist
                </Button>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                    Notifications will be sent to your email.
                </p>
            </div>
        </div>
    );
}
