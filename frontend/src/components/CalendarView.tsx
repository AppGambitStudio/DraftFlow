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
import { ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, FileText, Clock, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PostDetailsModal } from "./PostDetailsModal";
import api from "@/lib/api";
import toast from "react-hot-toast";

interface Post {
    id: number;
    content: string;
    scheduledTime: string | null;
    status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED' | 'GENERATING';
}

interface CalendarViewProps {
    posts: Post[];
    onPostUpdated: () => void;
}

export function CalendarView({ posts, onPostUpdated }: CalendarViewProps) {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedPost, setSelectedPost] = useState<Post | null>(null);
    const [draggedPost, setDraggedPost] = useState<Post | null>(null);

    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

    const handleDragStart = (post: Post) => {
        setDraggedPost(post);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // Allow drop
    };

    const handleDrop = async (e: React.DragEvent, date: Date) => {
        e.preventDefault();
        if (!draggedPost) return;

        // Don't do anything if dropped on the same day
        if (draggedPost.scheduledTime && isSameDay(new Date(draggedPost.scheduledTime), date)) {
            setDraggedPost(null);
            return;
        }

        try {
            // Preserve the original time, just change the date
            const originalDate = draggedPost.scheduledTime ? new Date(draggedPost.scheduledTime) : new Date();
            const newDate = new Date(date);
            newDate.setHours(originalDate.getHours(), originalDate.getMinutes(), 0, 0);

            await api.put(`/posts/${draggedPost.id}`, {
                scheduledTime: newDate.toISOString()
            });

            toast.success("Post rescheduled");
            onPostUpdated();
        } catch (error) {
            toast.error("Failed to reschedule post");
        } finally {
            setDraggedPost(null);
        }
    };

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const days = eachDayOfInterval({
        start: startDate,
        end: endDate,
    });

    const getPostsForDay = (day: Date) => {
        return posts.filter((post) => post.scheduledTime && isSameDay(new Date(post.scheduledTime), day));
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
                        const isToday = isSameDay(day, new Date());
                        const isCurrentMonth = isSameMonth(day, monthStart);
                        const isOverloaded = dayPosts.length >= 3;
                        const hasPosts = dayPosts.length > 0;

                        return (
                            <div
                                key={day.toString()}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, day)}
                                className={cn(
                                    "min-h-[120px] border-b border-r border-border p-2 transition-colors hover:bg-muted/30",
                                    !isCurrentMonth && "bg-muted/10 text-muted-foreground",
                                    dayIdx % 7 === 0 && "border-l border-border",
                                    isCurrentMonth && isOverloaded && "bg-red-50/50 dark:bg-red-900/10",
                                    isCurrentMonth && !isOverloaded && hasPosts && "bg-blue-50/30 dark:bg-blue-900/5"
                                )}
                            >
                                <div className="flex justify-end">
                                    <span
                                        className={cn(
                                            "flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium transition-colors",
                                            isToday
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
                                            draggable
                                            onDragStart={() => handleDragStart(post)}
                                            onClick={() => setSelectedPost(post)}
                                            className={cn(
                                                "group flex cursor-grab active:cursor-grabbing items-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-xs font-medium transition-all hover:border-border hover:bg-muted hover:shadow-sm",
                                                post.status === "PUBLISHED" && "text-green-700 dark:text-green-400",
                                                post.status === "FAILED" && "text-red-700 dark:text-red-400",
                                                post.status === "DRAFT" && "text-slate-600 dark:text-slate-400",
                                                post.status === "SCHEDULED" && "text-blue-700 dark:text-blue-400",
                                                post.status === "GENERATING" && "text-amber-600 dark:text-amber-400 animate-pulse"
                                            )}
                                            title={`${post.status}${post.scheduledTime ? ` - ${format(new Date(post.scheduledTime), "HH:mm")}` : ""}: ${post.content}`}
                                        >
                                            {post.status === "PUBLISHED" && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
                                            {post.status === "FAILED" && <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
                                            {post.status === "DRAFT" && <FileText className="h-3.5 w-3.5 shrink-0" />}
                                            {post.status === "SCHEDULED" && <Clock className="h-3.5 w-3.5 shrink-0" />}
                                            {post.status === "GENERATING" && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />}

                                            <span className="truncate">
                                                {post.scheduledTime && <span>{format(new Date(post.scheduledTime), "HH:mm")} </span>}
                                                {post.content}
                                            </span>
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
