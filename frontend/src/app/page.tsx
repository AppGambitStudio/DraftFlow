"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Post {
    id: number;
    content: string;
    scheduledTime: string;
    status: string;
}

export default function DashboardPage() {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPosts();
    }, []);

    const fetchPosts = async () => {
        try {
            const res = await api.get("/posts");
            setPosts(res.data);
        } catch (error) {
            console.error("Failed to load posts");
        } finally {
            setLoading(false);
        }
    };

    const upcomingPosts = posts
        .filter((p) => p.status === "SCHEDULED" || p.status === "DRAFT")
        .filter((p) => new Date(p.scheduledTime) > new Date())
        .slice(0, 5);

    const recentActivity = posts
        .filter((p) => p.status === "PUBLISHED" || p.status === "FAILED" || (p.status === "SCHEDULED" && new Date(p.scheduledTime) <= new Date()))
        .sort((a, b) => new Date(b.scheduledTime).getTime() - new Date(a.scheduledTime).getTime())
        .slice(0, 5);

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                <Link href="/create">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> Create Post
                    </Button>
                </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{posts.length}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {posts.filter((p) => p.status === "SCHEDULED").length}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Published</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {posts.filter((p) => p.status === "PUBLISHED").length}
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Failed</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {posts.filter((p) => p.status === "FAILED").length}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Upcoming Posts</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {upcomingPosts.length === 0 ? (
                                <p className="text-sm text-slate-500">No upcoming posts.</p>
                            ) : (
                                upcomingPosts.map((post) => (
                                    <div
                                        key={post.id}
                                        className="flex items-center justify-between rounded-lg border p-4"
                                    >
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium leading-none">
                                                {post.content.substring(0, 50)}...
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {format(new Date(post.scheduledTime), "PPP p")}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
                                                {post.status}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Recent Activity</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {recentActivity.length === 0 ? (
                                <p className="text-sm text-slate-500">No recent activity.</p>
                            ) : (
                                recentActivity.map((post) => (
                                    <div
                                        key={post.id}
                                        className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                                    >
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium leading-none">
                                                {post.content.substring(0, 30)}...
                                            </p>
                                            <p className="text-xs text-slate-500">
                                                {format(new Date(post.scheduledTime), "PPP p")}
                                            </p>
                                        </div>
                                        <span
                                            className={cn(
                                                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                                                post.status === "PUBLISHED"
                                                    ? "bg-green-100 text-green-800"
                                                    : "bg-red-100 text-red-800"
                                            )}
                                        >
                                            {post.status}
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
