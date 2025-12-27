"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Pencil } from "lucide-react";
import { format, isToday, isAfter, startOfToday, endOfToday } from "date-fns";
import { cn } from "@/lib/utils";
import { PostDetailsModal } from "@/components/PostDetailsModal";
import { DashboardAnalytics } from "@/components/DashboardAnalytics";
import toast, { Toaster } from "react-hot-toast";

interface Post {
    id: number;
    content: string;
    scheduledTime: string;
    status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED';
    mediaUrls?: string;
    platforms?: string;
}

export default function DashboardPage() {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        fetchPosts();
    }, []);

    const fetchPosts = async () => {
        try {
            const res = await api.get("/posts");
            setPosts(res.data);
        } catch (error) {
            console.error("Failed to load posts");
            toast.error("Failed to load posts");
        } finally {
            setLoading(false);
        }
    };

    const handlePostClick = (post: Post) => {
        setSelectedPost(post);
        setIsModalOpen(true);
    };

    const handleSavePost = async (id: number, data: { content: string; scheduledTime: string }) => {
        try {
            await api.put(`/posts/${id}`, data);
            toast.success("Post updated");
            fetchPosts();
        } catch (error) {
            toast.error("Failed to update post");
            throw error;
        }
    };

    const handleDeletePost = async (id: number) => {
        try {
            await api.delete(`/posts/${id}`);
            toast.success("Post deleted");
            fetchPosts();
        } catch (error) {
            toast.error("Failed to delete post");
            throw error;
        }
    };

    const todayPosts = posts
        .filter((p) => p.status === "SCHEDULED" || p.status === "DRAFT")
        .filter((p) => isToday(new Date(p.scheduledTime)))
        .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());

    const upcomingPosts = posts
        .filter((p) => p.status === "SCHEDULED" || p.status === "DRAFT")
        .filter((p) => {
            const date = new Date(p.scheduledTime);
            return isAfter(date, endOfToday());
        })
        .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime())
        .slice(0, 10);

    const recentActivity = posts
        .filter((p) => p.status === "PUBLISHED" || p.status === "FAILED" || (p.status === "SCHEDULED" && new Date(p.scheduledTime) < startOfToday()))
        .sort((a, b) => new Date(b.scheduledTime).getTime() - new Date(a.scheduledTime).getTime())
        .slice(0, 5);

    return (
        <div className="space-y-8">
            <Toaster />
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
                <Link href="/create">
                    <Button>
                        <Plus className="mr-2 h-4 w-4" /> Create Post
                    </Button>
                </Link>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                {/* ... existing stat cards ... */}
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
                        <CardTitle className="text-sm font-medium">Drafts</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {posts.filter((p) => p.status === "DRAFT").length}
                        </div>
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

            <DashboardAnalytics />

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <div className="col-span-4 space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Today&apos;s Posts</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {todayPosts.length === 0 ? (
                                    <p className="text-sm text-slate-500">No posts scheduled for today.</p>
                                ) : (
                                    todayPosts.map((post) => (
                                        <div
                                            key={post.id}
                                            className="flex items-center justify-between rounded-lg border p-4 bg-blue-50/30 border-blue-100 hover:bg-blue-50 cursor-pointer transition-colors"
                                            onClick={() => handlePostClick(post)}
                                        >
                                            <div className="space-y-1 min-w-0 flex-1 mr-4">
                                                <p className="text-sm font-medium leading-none line-clamp-1">
                                                    {post.content}
                                                </p>
                                                <p className="text-xs text-slate-500 font-medium">
                                                    {format(new Date(post.scheduledTime), "p")} (Today)
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className={cn(
                                                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                                                    post.status === 'SCHEDULED' ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"
                                                )}>
                                                    {post.status}
                                                </span>
                                                <Pencil className="h-4 w-4 text-muted-foreground transition-colors hover:text-primary" />
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Upcoming Posts</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {upcomingPosts.length === 0 ? (
                                    <p className="text-sm text-slate-500">No other upcoming posts.</p>
                                ) : (
                                    upcomingPosts.map((post) => (
                                        <div
                                            key={post.id}
                                            className="flex items-center justify-between rounded-lg border p-4 hover:bg-slate-50 cursor-pointer transition-colors"
                                            onClick={() => handlePostClick(post)}
                                        >
                                            <div className="space-y-1 min-w-0 flex-1 mr-4">
                                                <p className="text-sm font-medium leading-none line-clamp-1">
                                                    {post.content}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {format(new Date(post.scheduledTime), "PPP p")}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className={cn(
                                                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                                                    post.status === 'SCHEDULED' ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"
                                                )}>
                                                    {post.status}
                                                </span>
                                                <Pencil className="h-4 w-4 text-muted-foreground transition-colors hover:text-primary" />
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="col-span-3">
                    <Card>
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
                                            <div className="space-y-1 min-w-0 flex-1 mr-4">
                                                <p className="text-sm font-medium leading-none line-clamp-1">
                                                    {post.content}
                                                </p>
                                                <p className="text-xs text-slate-500">
                                                    {format(new Date(post.scheduledTime), "PPP p")}
                                                </p>
                                            </div>
                                            <span
                                                className={cn(
                                                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium shrink-0",
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

            <PostDetailsModal
                isOpen={isModalOpen}
                post={selectedPost}
                onClose={() => setIsModalOpen(false)}
                onSave={handleSavePost}
                onDelete={handleDeletePost}
            />
        </div>
    );
}
