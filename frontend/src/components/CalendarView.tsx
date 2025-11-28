"use client";

import { useState } from "react";
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    addMonths,
    subMonths
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PostDetailsModal } from "./PostDetailsModal";
import api from "@/lib/api";
import toast from "react-hot-toast";

interface Post {
    id: number;
    content: string;
    scheduledTime: string;
    status: string;
}

interface CalendarViewProps {
    posts: Post[];
    onPostUpdated: () => void;
}

export function CalendarView({ posts, onPostUpdated }: CalendarViewProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);

    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const days = eachDayOfInterval({
        start: startDate,
        end: endDate,
    });

    const getPostsForDay = (day: Date) => {
        return posts.filter((post) => isSameDay(new Date(post.scheduledTime), day));
    };

    const handleSavePost = async (id: number, updates: Partial<Post>) => {
        try {
            await api.put(`/posts/${id}`, updates);
            toast.success("Post updated");
            onPostUpdated();
        } catch (error) {
            toast.error("Failed to update post");
            throw error;
        }
    };

    const handleDeletePost = async (id: number) => {
        try {
            await api.delete(`/posts/${id}`);
            toast.success("Post deleted");
            onPostUpdated();
        } catch (error) {
            toast.error("Failed to delete post");
            throw error;
        }
    };

    return (
        <>
            <div className="rounded-xl border border-border bg-card text-card-foreground shadow-sm">
                <div className="flex items-center justify-between border-b border-border p-4">
                    <h2 className="text-lg font-semibold text-foreground">
                        {format(currentMonth, "MMMM yyyy")}
                    </h2>
                    <div className="flex gap-2">
                        <button onClick={prevMonth} className="rounded-md p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                            <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button onClick={nextMonth} className="rounded-md p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                            <ChevronRight className="h-5 w-5" />
                        </button>
                    </div>
                </div>
                <div className="grid grid-cols-7 border-b border-border bg-muted/50 text-center text-xs font-semibold leading-6 text-muted-foreground">
                    <div className="py-2">Sun</div>
                    <div className="py-2">Mon</div>
                    <div className="py-2">Tue</div>
                    <div className="py-2">Wed</div>
                    <div className="py-2">Thu</div>
                    <div className="py-2">Fri</div>
                    <div className="py-2">Sat</div>
                </div>
                <div className="grid grid-cols-7 text-sm bg-background">
                    {days.map((day, dayIdx) => {
                        const dayPosts = getPostsForDay(day);
                        return (
                            <div
                                key={day.toString()}
                                className={cn(
                                    "min-h-[120px] border-b border-r border-border p-2 transition-colors hover:bg-muted/30",
                                    !isSameMonth(day, monthStart) && "bg-muted/10 text-muted-foreground",
                                    dayIdx % 7 === 0 && "border-l border-border"
                                )}
                            >
                                <div className="flex justify-end">
                                    <span
                                        className={cn(
                                            "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors",
                                            isSameDay(day, new Date())
                                                ? "bg-primary text-primary-foreground shadow-sm"
                                                : "text-muted-foreground"
                                        )}
                                    >
                                        {format(day, "d")}
                                    </span>
                                </div>
                                <div className="mt-2 space-y-1.5">
                                    {dayPosts.map((post) => (
                                        <div
                                            key={post.id}
                                            onClick={() => setSelectedPost(post)}
                                            className={cn(
                                                "cursor-pointer truncate rounded-md px-2 py-1 text-xs font-medium shadow-sm transition-all hover:opacity-80 hover:shadow-md",
                                                post.status === "PUBLISHED"
                                                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                                    : post.status === "FAILED"
                                                        ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                                        : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                            )}
                                            title={post.content}
                                        >
                                            <span className="opacity-75 mr-1">{format(new Date(post.scheduledTime), "HH:mm")}</span>
                                            {post.content}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <PostDetailsModal
                post={selectedPost}
                isOpen={!!selectedPost}
                onClose={() => setSelectedPost(null)}
                onSave={handleSavePost}
                onDelete={handleDeletePost}
            />
        </>
    );
}
