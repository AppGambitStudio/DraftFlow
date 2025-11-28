"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PostPreview } from "@/components/PostPreview";
import toast, { Toaster } from "react-hot-toast";

import { Sparkles } from "lucide-react";

export default function CreatePostPage() {
    const router = useRouter();
    const [content, setContent] = useState("");
    const [scheduledTime, setScheduledTime] = useState("");
    const [platforms, setPlatforms] = useState<string[]>(["LINKEDIN"]);
    const [loading, setLoading] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);

    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        if (searchParams.get('source') === 'idea') {
            const draftContent = localStorage.getItem('draftPostContent');
            if (draftContent) {
                setContent(draftContent);
                // Optional: Clear it so it doesn't persist forever
                // localStorage.removeItem('draftPostContent'); 
            }
        }
    }, []);

    const handleAIImprovise = async () => {
        if (!content) {
            toast.error("Please enter some content first");
            return;
        }
        setAiLoading(true);
        try {
            const res = await api.post("/ai/improvise", { content });
            setContent(res.data.content);
            toast.success("Content improved by AI!");
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to improvise content");
        } finally {
            setAiLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!content) {
            toast.error("Content is required");
            return;
        }
        if (!scheduledTime) {
            toast.error("Scheduled time is required");
            return;
        }
        if (platforms.length === 0) {
            toast.error("Select at least one platform");
            return;
        }

        setLoading(true);
        try {
            await api.post("/posts", {
                content,
                scheduledTime,
                platforms,
            });
            toast.success("Post scheduled successfully!");
            setTimeout(() => router.push("/"), 1500);
        } catch (error) {
            toast.error("Failed to schedule post");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-full gap-8">
            <Toaster />
            <div className="flex-1 space-y-6">
                <h2 className="text-3xl font-bold tracking-tight">Create Post</h2>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="content">Post Content</Label>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={handleAIImprovise}
                                disabled={aiLoading || !content}
                                className="text-primary hover:text-primary hover:bg-primary/10"
                            >
                                <Sparkles className="mr-2 h-4 w-4" />
                                {aiLoading ? "Improvising..." : "AImprovise"}
                            </Button>
                        </div>
                        <Textarea
                            id="content"
                            placeholder="What do you want to talk about?"
                            className="min-h-[200px] resize-none text-base"
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                        />
                        <div className="flex justify-end">
                            <span className={`text-xs ${content.length > (platforms.includes('TWITTER') ? 280 : 3000)
                                ? 'text-red-500 font-medium'
                                : 'text-muted-foreground'
                                }`}>
                                {content.length} / {platforms.includes('TWITTER') ? 280 : 3000} characters
                            </span>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Publish to</Label>
                        <div className="flex gap-4">
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="linkedin"
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    checked={platforms.includes('LINKEDIN')}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            setPlatforms([...platforms, 'LINKEDIN']);
                                        } else {
                                            setPlatforms(platforms.filter(p => p !== 'LINKEDIN'));
                                        }
                                    }}
                                />
                                <Label htmlFor="linkedin">LinkedIn</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                                <input
                                    type="checkbox"
                                    id="twitter"
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    checked={platforms.includes('TWITTER')}
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            setPlatforms([...platforms, 'TWITTER']);
                                        } else {
                                            setPlatforms(platforms.filter(p => p !== 'TWITTER'));
                                        }
                                    }}
                                />
                                <Label htmlFor="twitter">Twitter</Label>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="scheduledTime">Schedule for</Label>
                        <Input
                            id="scheduledTime"
                            type="datetime-local"
                            value={scheduledTime}
                            onChange={(e) => setScheduledTime(e.target.value)}
                            className="w-full max-w-xs"
                        />
                    </div>

                    <div className="flex gap-4">
                        <Button type="submit" disabled={loading}>
                            {loading ? "Scheduling..." : "Schedule Post"}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => router.back()}>
                            Cancel
                        </Button>
                    </div>
                </form>
            </div>

            <div className="w-[400px] space-y-6">
                <h3 className="text-lg font-medium">Preview</h3>
                <PostPreview content={content} />
            </div>
        </div>
    );
}
