"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { CalendarView } from "@/components/CalendarView";
import toast, { Toaster } from "react-hot-toast";

interface Post {
    id: number;
    content: string;
    scheduledTime: string;
    status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED' | 'GENERATING';
}

export default function CalendarPage() {
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
            toast.error("Failed to load posts");
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className="space-y-6">
            <Toaster />
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">Calendar</h2>
            </div>
            <CalendarView posts={posts} onPostUpdated={fetchPosts} />
        </div>
    );
}
