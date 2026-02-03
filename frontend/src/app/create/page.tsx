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

import { Sparkles, Paperclip, X, FileText, Loader2, ArrowUp, ArrowDown, Undo2, RefreshCw, ChevronDown, GitBranch, Zap, Hash } from "lucide-react";

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
    const [contentHistory, setContentHistory] = useState<string[]>([]);
    const [improviseDirection, setImproviseDirection] = useState<string>('');
    const [customDirection, setCustomDirection] = useState<string>('');
    const [showDirectionDropdown, setShowDirectionDropdown] = useState(false);
    const directionDropdownRef = useRef<HTMLDivElement>(null);
    const [ideaId, setIdeaId] = useState<string | null>(null);
    const [ideaTitle, setIdeaTitle] = useState<string | null>(null);
    const [showRegenerateModal, setShowRegenerateModal] = useState(false);
    const [regenerateContext, setRegenerateContext] = useState('');
    const [regenerateLoading, setRegenerateLoading] = useState(false);
    const [showVariationsModal, setShowVariationsModal] = useState(false);
    const [variations, setVariations] = useState<Array<{ content: string; format: string }>>([]);
    const [variationsLoading, setVariationsLoading] = useState(false);
    const [showHooksModal, setShowHooksModal] = useState(false);
    const [hooks, setHooks] = useState<Array<{ hook: string; style: string }>>([]);
    const [hooksLoading, setHooksLoading] = useState(false);
    const [hashtagsLoading, setHashtagsLoading] = useState(false);

    const DIRECTION_PRESETS = [
        "Shorten",
        "Stronger hook",
        "Add CTA",
        "Simplify",
        "More data-driven",
        "Make bolder",
    ];

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

            // Load idea context for regeneration
            if (searchParams.get('source') === 'idea') {
                const storedIdeaId = localStorage.getItem('draftIdeaId');
                const storedIdeaTitle = localStorage.getItem('draftIdeaTitle');
                if (storedIdeaId) setIdeaId(storedIdeaId);
                if (storedIdeaTitle) setIdeaTitle(storedIdeaTitle);
                localStorage.removeItem('draftIdeaId');
                localStorage.removeItem('draftIdeaTitle');
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

    // Handle trend-to-post flow
    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        if (searchParams.get('fromTrend') === 'true') {
            const trendData = localStorage.getItem('trendForPost');
            if (trendData) {
                try {
                    const trend = JSON.parse(trendData);
                    localStorage.removeItem('trendForPost');
                    // Auto-generate post from trend
                    generatePostFromTrend(trend);
                } catch (e) {
                    console.error('Failed to parse trend data', e);
                }
            }
        }
    }, []);

    const generatePostFromTrend = async (trend: { topic: string; description: string; relevance: string; suggestedAngles: string[]; trendType: string }) => {
        setAiLoading(true);
        toast.loading('Generating post from trend...', { id: 'trend-post' });
        try {
            const res = await api.post("/ai/generate-from-context", {
                context: `Write a professional LinkedIn post about this trending topic:

TOPIC: ${trend.topic}

WHAT'S HAPPENING: ${trend.description}

WHY IT MATTERS: ${trend.relevance}

SUGGESTED ANGLES TO CONSIDER:
${trend.suggestedAngles.map((a, i) => `${i + 1}. ${a}`).join('\n')}

Create an engaging post that provides value to the reader. Pick one of the suggested angles or combine them creatively.`,
                authorUrn: selectedAuthorUrn || undefined,
                platform: platforms[0] || 'LINKEDIN'
            });
            setContent(res.data.content);
            toast.success('Post generated from trend!', { id: 'trend-post' });
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to generate post from trend', { id: 'trend-post' });
        } finally {
            setAiLoading(false);
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (directionDropdownRef.current && !directionDropdownRef.current.contains(event.target as Node)) {
                setShowDirectionDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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

    const handleUndo = () => {
        if (contentHistory.length === 0) return;
        const previous = contentHistory[contentHistory.length - 1];
        setContentHistory(contentHistory.slice(0, -1));
        setContent(previous);
        toast.success("Reverted to previous version");
    };

    const getActiveDirection = () => {
        if (improviseDirection === '__custom__') return customDirection || undefined;
        return improviseDirection || undefined;
    };

    const handleAIImprovise = async () => {
        if (!content) {
            toast.error("Please enter some content first");
            return;
        }
        setAiLoading(true);
        try {
            setContentHistory([...contentHistory, content]);
            const res = await api.post("/ai/improvise", {
                content,
                targetAudience: selectedAudience || undefined,
                authorUrn: selectedAuthorUrn || undefined,
                direction: getActiveDirection(),
                platform: platforms.length > 0 ? platforms.join(',') : undefined
            });
            setContent(res.data.content);
            toast.success("Content improved by AI!");
        } catch (error: any) {
            // Revert the undo stack push on failure
            setContentHistory(prev => prev.slice(0, -1));
            toast.error(error.response?.data?.error || "Failed to improvise content");
        } finally {
            setAiLoading(false);
        }
    };

    const handleRegenerate = async () => {
        if (!ideaId) return;
        setRegenerateLoading(true);
        try {
            if (content) {
                setContentHistory([...contentHistory, content]);
            }
            const res = await api.post(`/ideas/${ideaId}/generate`, {
                platform: platforms.length > 0 ? platforms[0] : 'LINKEDIN',
                additionalContext: regenerateContext || undefined
            });
            setContent(res.data.content);
            setShowRegenerateModal(false);
            setRegenerateContext('');
            toast.success("Content regenerated!");
        } catch (error: any) {
            // Revert the undo stack push on failure
            if (content) {
                setContentHistory(prev => prev.slice(0, -1));
            }
            toast.error(error.response?.data?.error || "Failed to regenerate content");
        } finally {
            setRegenerateLoading(false);
        }
    };

    const handleGenerateVariations = async () => {
        if (!content) return;
        setVariationsLoading(true);
        setShowVariationsModal(true);
        try {
            const res = await api.post('/ai/variations', {
                content,
                authorUrn: selectedAuthorUrn,
                targetAudience: selectedAudience,
                platform: platforms[0] || 'LINKEDIN'
            });
            setVariations(res.data.variations);
        } catch (error) {
            toast.error('Failed to generate variations');
            setShowVariationsModal(false);
        } finally {
            setVariationsLoading(false);
        }
    };

    const handleSelectVariation = (variation: { content: string; format: string }) => {
        setContentHistory(prev => [...prev, content]);
        setContent(variation.content);
        setShowVariationsModal(false);
        toast.success(`Switched to ${variation.format} format`);
    };

    const handleGenerateHooks = async () => {
        if (!content) return;
        setHooksLoading(true);
        setShowHooksModal(true);
        try {
            const res = await api.post('/ai/hooks', {
                content,
                count: 5,
                authorUrn: selectedAuthorUrn,
                platform: platforms[0] || 'LINKEDIN'
            });
            setHooks(res.data.hooks);
        } catch (error) {
            toast.error('Failed to generate hooks');
            setShowHooksModal(false);
        } finally {
            setHooksLoading(false);
        }
    };

    const handleSelectHook = (hook: { hook: string; style: string }) => {
        setContentHistory(prev => [...prev, content]);
        // Replace the first line (current hook) with the new hook
        const lines = content.split('\n');
        const restOfContent = lines.slice(1).join('\n').trimStart();
        const newContent = restOfContent ? `${hook.hook}\n\n${restOfContent}` : hook.hook;
        setContent(newContent);
        setShowHooksModal(false);
        toast.success(`Applied ${hook.style} hook`);
    };

    const handleGenerateHashtags = async () => {
        if (!content) return;
        setHashtagsLoading(true);
        try {
            const res = await api.post('/ai/hashtags', {
                content,
                count: 5,
                platform: platforms[0] || 'LINKEDIN'
            });
            const hashtags = res.data.hashtags;
            if (hashtags && hashtags.length > 0) {
                setContentHistory(prev => [...prev, content]);
                const hashtagString = hashtags.map((tag: string) => tag.startsWith('#') ? tag : `#${tag}`).join(' ');
                setContent(prev => prev.trim() + '\n\n' + hashtagString);
                toast.success('Hashtags added!');
            }
        } catch (error) {
            toast.error('Failed to generate hashtags');
        } finally {
            setHashtagsLoading(false);
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
                                {ideaId && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowRegenerateModal(true)}
                                        disabled={aiLoading || regenerateLoading}
                                        className="text-primary hover:text-primary hover:bg-primary/10"
                                    >
                                        <RefreshCw className="mr-2 h-4 w-4" />
                                        Regenerate
                                    </Button>
                                )}
                                {contentHistory.length > 0 && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={handleUndo}
                                        disabled={aiLoading}
                                        className="text-muted-foreground hover:text-foreground hover:bg-muted"
                                    >
                                        <Undo2 className="mr-2 h-4 w-4" />
                                        Undo
                                    </Button>
                                )}
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
                                <div className="relative" ref={directionDropdownRef}>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowDirectionDropdown(!showDirectionDropdown)}
                                        className="text-muted-foreground hover:text-foreground hover:bg-muted h-8 px-2"
                                    >
                                        <ChevronDown className="h-4 w-4" />
                                        <span className="ml-1 text-xs max-w-[100px] truncate">
                                            {improviseDirection === '__custom__'
                                                ? (customDirection || 'Custom')
                                                : (improviseDirection || 'Direction')}
                                        </span>
                                    </Button>
                                    {showDirectionDropdown && (
                                        <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-md border border-input bg-background shadow-lg">
                                            <div className="p-1">
                                                <button
                                                    type="button"
                                                    className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-muted ${!improviseDirection ? 'bg-muted font-medium' : ''}`}
                                                    onClick={() => { setImproviseDirection(''); setShowDirectionDropdown(false); }}
                                                >
                                                    No direction (default)
                                                </button>
                                                {DIRECTION_PRESETS.map((preset) => (
                                                    <button
                                                        key={preset}
                                                        type="button"
                                                        className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-muted ${improviseDirection === preset ? 'bg-muted font-medium' : ''}`}
                                                        onClick={() => { setImproviseDirection(preset); setShowDirectionDropdown(false); }}
                                                    >
                                                        {preset}
                                                    </button>
                                                ))}
                                                <div className="border-t border-input mt-1 pt-1">
                                                    <button
                                                        type="button"
                                                        className={`w-full text-left px-3 py-1.5 text-sm rounded hover:bg-muted ${improviseDirection === '__custom__' ? 'bg-muted font-medium' : ''}`}
                                                        onClick={() => { setImproviseDirection('__custom__'); }}
                                                    >
                                                        Custom direction...
                                                    </button>
                                                    {improviseDirection === '__custom__' && (
                                                        <div className="px-2 py-1">
                                                            <input
                                                                type="text"
                                                                value={customDirection}
                                                                onChange={(e) => setCustomDirection(e.target.value)}
                                                                onKeyDown={(e) => { if (e.key === 'Enter') setShowDirectionDropdown(false); }}
                                                                placeholder="e.g. More conversational"
                                                                className="w-full h-7 rounded-md border border-input bg-transparent px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                                autoFocus
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleAIImprovise}
                                    disabled={aiLoading || variationsLoading || !content}
                                    className="text-primary hover:text-primary hover:bg-primary/10"
                                >
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    {aiLoading ? "Improvising..." : "AImprovise"}
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleGenerateVariations}
                                    disabled={!content || aiLoading || variationsLoading}
                                    className="text-primary hover:text-primary hover:bg-primary/10"
                                >
                                    <GitBranch className="mr-2 h-4 w-4" />
                                    Variations
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleGenerateHooks}
                                    disabled={!content || aiLoading || hooksLoading}
                                    className="text-primary hover:text-primary hover:bg-primary/10"
                                >
                                    <Zap className="mr-2 h-4 w-4" />
                                    Hooks
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleGenerateHashtags}
                                    disabled={!content || hashtagsLoading}
                                    className="text-primary hover:text-primary hover:bg-primary/10"
                                >
                                    {hashtagsLoading ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <Hash className="mr-2 h-4 w-4" />
                                    )}
                                    Hashtags
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

            {showRegenerateModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-md rounded-xl bg-background p-6 shadow-2xl border border-border animate-in zoom-in-95 duration-200">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-foreground">
                                Regenerate{ideaTitle ? `: ${ideaTitle}` : ''}
                            </h3>
                            <button
                                onClick={() => { setShowRegenerateModal(false); setRegenerateContext(''); }}
                                className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-full hover:bg-slate-100"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="regenerateContext">Additional context or instructions</Label>
                                <Textarea
                                    id="regenerateContext"
                                    placeholder="e.g. Focus more on the technical aspects, make it shorter..."
                                    className="min-h-[100px] resize-none"
                                    value={regenerateContext}
                                    onChange={(e) => setRegenerateContext(e.target.value)}
                                />
                            </div>
                            <div className="flex justify-end gap-3">
                                <Button
                                    variant="outline"
                                    onClick={() => { setShowRegenerateModal(false); setRegenerateContext(''); }}
                                    disabled={regenerateLoading}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleRegenerate}
                                    disabled={regenerateLoading}
                                >
                                    {regenerateLoading ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        <>
                                            <RefreshCw className="mr-2 h-4 w-4" />
                                            Generate
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showVariationsModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-4xl rounded-xl bg-background p-6 shadow-2xl border border-border animate-in zoom-in-95 duration-200">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-foreground">Format Variations</h3>
                            <button
                                onClick={() => setShowVariationsModal(false)}
                                className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-full hover:bg-slate-100"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        {variationsLoading ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                                <p className="text-muted-foreground">Generating 3 variations...</p>
                            </div>
                        ) : (
                            <div className="max-h-[60vh] overflow-y-auto space-y-4">
                                {variations.map((variation, index) => (
                                    <div
                                        key={index}
                                        className="rounded-lg border border-border p-4 space-y-3"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="inline-block px-3 py-1 text-xs font-medium uppercase rounded-full bg-indigo-100 text-indigo-700">
                                                {variation.format}
                                            </span>
                                            <Button
                                                size="sm"
                                                onClick={() => handleSelectVariation(variation)}
                                            >
                                                Use This
                                            </Button>
                                        </div>
                                        <p className="text-sm text-foreground whitespace-pre-wrap">
                                            {variation.content}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showHooksModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-4xl rounded-xl bg-background p-6 shadow-2xl border border-border animate-in zoom-in-95 duration-200">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-foreground">Hook Suggestions</h3>
                            <button
                                onClick={() => setShowHooksModal(false)}
                                className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-full hover:bg-slate-100"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        {hooksLoading ? (
                            <div className="flex flex-col items-center justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                                <p className="text-muted-foreground">Generating hook suggestions...</p>
                            </div>
                        ) : (
                            <div className="max-h-[60vh] overflow-y-auto space-y-4">
                                {hooks.map((hook, index) => (
                                    <div
                                        key={index}
                                        className="rounded-lg border border-border p-4 space-y-3"
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="inline-block px-3 py-1 text-xs font-medium uppercase rounded-full bg-amber-100 text-amber-700">
                                                {hook.style}
                                            </span>
                                            <Button
                                                size="sm"
                                                onClick={() => handleSelectHook(hook)}
                                            >
                                                Use This
                                            </Button>
                                        </div>
                                        <p className="text-sm text-foreground whitespace-pre-wrap">
                                            {hook.hook}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div >
    );
}
