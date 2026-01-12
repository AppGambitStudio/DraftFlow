"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PostPreview } from "@/components/PostPreview";
import toast, { Toaster } from "react-hot-toast";

import { Sparkles, Paperclip, X, FileText, Loader2, ArrowUp, ArrowDown } from "lucide-react";

import { useAuthors } from "@/contexts/AuthorsContext";
import { useSettings } from "@/contexts/SettingsContext";

interface Attachment {
    url: string;
    name: string;
    type: string;
    size: number;
}

export default function CreatePostPage() {
    const router = useRouter();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { authors, loading: authorsLoading } = useAuthors();
    const { settings } = useSettings();
    const [content, setContent] = useState("");
    const [scheduledTime, setScheduledTime] = useState("");
    const [platforms, setPlatforms] = useState<string[]>(["LINKEDIN"]);
    const [loading, setLoading] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    const [selectedAuthorUrn, setSelectedAuthorUrn] = useState<string>('');
    const [selectedAudience, setSelectedAudience] = useState<string>('');

    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        if (searchParams.get('source') === 'idea' || searchParams.get('source') === 'repost') {
            const draftContent = localStorage.getItem('draftPostContent');
            if (draftContent) {
                setContent(draftContent);
            }

            const draftAttachments = localStorage.getItem('draftPostAttachments');
            if (draftAttachments) {
                try {
                    setAttachments(JSON.parse(draftAttachments));
                } catch (e) {
                    console.error('Failed to parse draft attachments', e);
                }
            }

            // Cleanup localStorage after loading
            localStorage.removeItem('draftPostContent');
            localStorage.removeItem('draftPostAttachments');
        }
    }, [router]);

    useEffect(() => {
        if (authors.length > 0 && !selectedAuthorUrn) {
            setSelectedAuthorUrn(authors[0].urn);
        }
    }, [authors]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await api.post('/uploads', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            setAttachments([...attachments, res.data]);
            toast.success("File uploaded successfully");
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to upload file");
        } finally {
            setUploading(false);
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(attachments.filter((_, i) => i !== index));
    };

    const moveAttachment = (index: number, direction: 'up' | 'down') => {
        const newAttachments = [...attachments];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        if (targetIndex < 0 || targetIndex >= newAttachments.length) return;

        [newAttachments[index], newAttachments[targetIndex]] = [newAttachments[targetIndex], newAttachments[index]];
        setAttachments(newAttachments);
    };

    const handleAIImprovise = async () => {
        if (!content) {
            toast.error("Please enter some content first");
            return;
        }
        setAiLoading(true);
        try {
            const res = await api.post("/ai/improvise", {
                content,
                targetAudience: selectedAudience || undefined,
                authorUrn: selectedAuthorUrn || undefined
            });
            setContent(res.data.content);
            toast.success("Content improved by AI!");
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to improvise content");
        } finally {
            setAiLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent, status: string = 'SCHEDULED') => {
        e.preventDefault();
        if (!content) {
            toast.error("Content is required");
            return;
        }

        if (status === 'SCHEDULED' && !scheduledTime) {
            toast.error("Scheduled time is required to schedule a post");
            return;
        }

        if (platforms.length === 0) {
            toast.error("Select at least one platform");
            return;
        }

        setLoading(true);
        try {
            const selectedAuthor = authors.find(a => a.urn === selectedAuthorUrn);
            let finalScheduledTime = scheduledTime;

            // If saving as draft and no time selected, use current time so it shows on dashboard
            if (status === 'DRAFT' && !finalScheduledTime) {
                finalScheduledTime = new Date().toISOString();
            }

            await api.post("/posts", {
                content,
                scheduledTime: finalScheduledTime || undefined,
                platforms,
                authorUrn: selectedAuthorUrn,
                authorName: selectedAuthor?.name || "",
                status,
                mediaUrls: attachments // Stored as mediaUrls in DB
            });
            toast.success(status === 'DRAFT' ? "Post saved as draft!" : "Post scheduled successfully!");
            setTimeout(() => router.push("/"), 1500);
        } catch (error: any) {
            const errorMsg = error.response?.data?.error || (status === 'DRAFT' ? "Failed to save draft" : "Failed to schedule post");
            toast.error(errorMsg);
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
                            <div className="flex items-center gap-2">
                                {settings.targetAudiences.length > 0 && (
                                    <select
                                        value={selectedAudience}
                                        onChange={(e) => setSelectedAudience(e.target.value)}
                                        className="h-8 w-[180px] rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        <option value="">Post Audience (Optional)</option>
                                        {settings.targetAudiences.map((audience, index) => (
                                            <option key={index} value={audience}>
                                                {audience}
                                            </option>
                                        ))}
                                    </select>
                                )}
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
                        <div className="flex items-center justify-between">
                            <Label>Attachments</Label>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                            >
                                {uploading ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Paperclip className="mr-2 h-4 w-4" />
                                )}
                                Add Attachment
                            </Button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                onChange={handleFileUpload}
                            />
                        </div>

                        {attachments.length > 0 && (
                            <div className="grid grid-cols-1 gap-2 mt-2">
                                {attachments.map((file, index) => (
                                    <div key={index} className="flex items-center justify-between p-2 rounded-md border border-slate-200 bg-slate-50">
                                        <div className="flex items-center gap-2 min-w-0">
                                            {file.type.startsWith('image/') ? (
                                                <div className="h-8 w-8 rounded overflow-hidden flex-shrink-0">
                                                    <img
                                                        src={file.url.startsWith('http') ? file.url : `http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:5002${file.url}`}
                                                        alt={file.name}
                                                        className="h-full w-full object-cover"
                                                    />
                                                </div>
                                            ) : (
                                                <FileText className="h-8 w-8 text-blue-500 flex-shrink-0" />
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium truncate">{file.name}</div>
                                                <div className="text-xs text-slate-500">{Math.round(file.size / 1024)} KB</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => moveAttachment(index, 'up')}
                                                disabled={index === 0}
                                                className="h-8 w-8 p-0 text-slate-400 hover:text-primary"
                                            >
                                                <ArrowUp className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => moveAttachment(index, 'down')}
                                                disabled={index === attachments.length - 1}
                                                className="h-8 w-8 p-0 text-slate-400 hover:text-primary"
                                            >
                                                <ArrowDown className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeAttachment(index)}
                                                className="h-8 w-8 p-0 text-slate-400 hover:text-red-500"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="author">Post As</Label>
                        <select
                            id="author"
                            value={selectedAuthorUrn}
                            onChange={(e) => setSelectedAuthorUrn(e.target.value)}
                            disabled={loading || authorsLoading}
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {authors.map((author) => (
                                <option key={author.urn} value={author.urn}>
                                    {author.name}
                                </option>
                            ))}
                        </select>
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
                        <Button type="submit" disabled={loading || uploading} onClick={(e) => {
                            e.preventDefault();
                            handleSubmit(e, 'SCHEDULED');
                        }}>
                            {loading ? "Scheduling..." : "Schedule Post"}
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={loading || uploading}
                            onClick={(e) => handleSubmit(e, 'DRAFT')}
                        >
                            {loading ? "Saving..." : "Save as Draft"}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => router.back()}>
                            Cancel
                        </Button>
                    </div>
                </form>
            </div >

            <div className="w-[400px] space-y-6">
                <h3 className="text-lg font-medium">Preview</h3>
                <PostPreview content={content} attachments={attachments} />
            </div>
        </div >
    );
}
