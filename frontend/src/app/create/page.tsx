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

import { Sparkles, Paperclip, X, FileText, Loader2, ArrowUp, ArrowDown, Undo2, RefreshCw, ChevronDown, GitBranch, Zap, Hash, Palette, AlertCircle } from "lucide-react";

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
    const [showAIToolsDropdown, setShowAIToolsDropdown] = useState(false);
    const aiToolsDropdownRef = useRef<HTMLDivElement>(null);
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
    const [editingPostId, setEditingPostId] = useState<string | null>(null);
    const [loadingPost, setLoadingPost] = useState(false);
    const [showVisualBuilderModal, setShowVisualBuilderModal] = useState(false);
    const [visualBuilderLoading, setVisualBuilderLoading] = useState(false);
    const [visualBuilderResult, setVisualBuilderResult] = useState<{ imageUrl: string; html: string; name: string; type: string; size: number } | null>(null);
    const [visualTemplate, setVisualTemplate] = useState('infographic');
    const [visualSize, setVisualSize] = useState('landscape');

    const VISUAL_TEMPLATES = [
        { key: 'infographic', name: 'Infographic', description: 'Key points with icons and accent colors', icon: '📊' },
        { key: 'comparison', name: 'Before vs After', description: 'Two-column comparison layout', icon: '⚡' },
        { key: 'checklist', name: 'Checklist', description: 'Visual checklist with markers', icon: '✅' },
        { key: 'quote-card', name: 'Quote Card', description: 'Large quote, minimal design', icon: '💬' },
        { key: 'stats', name: 'Stats & Numbers', description: 'Big numbers with context', icon: '📈' },
        { key: 'steps', name: 'Step-by-Step', description: 'Numbered steps with flow', icon: '🔢' },
    ];

    const VISUAL_SIZES = [
        { key: 'landscape', label: 'Landscape', desc: '1200×628' },
        { key: 'square', label: 'Square', desc: '1080×1080' },
        { key: 'portrait', label: 'Portrait', desc: '1080×1350' },
        { key: 'auto', label: 'Auto-fit', desc: 'fits content' },
    ];

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
        const source = searchParams.get('source');
        if (source === 'idea' || source === 'repost' || source === 'carousel' || source === 'inspiration') {
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
            if (source === 'idea') {
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

    // Handle loading existing post for editing
    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const postId = searchParams.get('postId');
        if (postId) {
            setLoadingPost(true);
            setEditingPostId(postId);
            api.get(`/posts/${postId}`)
                .then((res) => {
                    const post = res.data;
                    setContent(post.content || '');
                    setScheduledTime(post.scheduledTime ? new Date(post.scheduledTime).toISOString().slice(0, 16) : '');
                    setPlatforms(post.platforms ? JSON.parse(post.platforms) : ['LINKEDIN']);
                    setSelectedAuthorUrn(post.authorUrn || '');
                    if (post.attachments) {
                        try {
                            setAttachments(JSON.parse(post.attachments));
                        } catch (e) {
                            console.error('Failed to parse attachments', e);
                        }
                    }
                    toast.success('Post loaded for editing');
                })
                .catch((error) => {
                    console.error('Failed to load post:', error);
                    const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
                    toast.error(`Failed to load post: ${errorMsg}`);
                    setEditingPostId(null);
                })
                .finally(() => {
                    setLoadingPost(false);
                });
        }
    }, []);

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

        if (searchParams.get('fromFeed') === 'true') {
            const feedData = localStorage.getItem('feedItemForPost');
            if (feedData) {
                try {
                    const item = JSON.parse(feedData);
                    localStorage.removeItem('feedItemForPost');
                    generatePostFromFeedItem(item);
                } catch (e) {
                    console.error('Failed to parse feed item data', e);
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

    const generatePostFromFeedItem = async (item: { title: string; description: string; link: string; author: string; source: string }) => {
        setAiLoading(true);
        toast.loading('Generating post from article...', { id: 'feed-post' });
        try {
            const res = await api.post("/ai/generate-from-context", {
                context: `Write a professional LinkedIn post inspired by this article:

TITLE: ${item.title}

${item.description ? `SUMMARY: ${item.description}` : ''}

${item.source ? `SOURCE: ${item.source}` : ''}
${item.author ? `AUTHOR: ${item.author}` : ''}
${item.link ? `LINK: ${item.link}` : ''}

Create an engaging post that shares your perspective or key takeaway from this article. Add your own insight — don't just summarize.${item.link ? ` Include the source link.` : ''}`,
                authorUrn: selectedAuthorUrn || undefined,
                platform: platforms[0] || 'LINKEDIN'
            });
            setContent(res.data.content);
            toast.success('Post generated from article!', { id: 'feed-post' });
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to generate post', { id: 'feed-post' });
        } finally {
            setAiLoading(false);
        }
    };

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (directionDropdownRef.current && !directionDropdownRef.current.contains(event.target as Node)) {
                setShowDirectionDropdown(false);
            }
            if (aiToolsDropdownRef.current && !aiToolsDropdownRef.current.contains(event.target as Node)) {
                setShowAIToolsDropdown(false);
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

    const [visualBuilderTimedOut, setVisualBuilderTimedOut] = useState(false);

    const handleVisualBuilder = async (templateKey?: string) => {
        if (!content) return;
        const tmpl = templateKey || visualTemplate;
        setVisualTemplate(tmpl);
        setVisualBuilderLoading(true);
        setVisualBuilderResult(null);
        setVisualBuilderTimedOut(false);
        setShowVisualBuilderModal(true);

        const controller = new AbortController();
        const timeout = setTimeout(() => {
            controller.abort();
            setVisualBuilderTimedOut(true);
            setVisualBuilderLoading(false);
        }, 120000); // 2 minute timeout

        try {
            const res = await api.post('/ai/visual-builder', {
                content,
                template: tmpl,
                size: visualSize,
            }, { signal: controller.signal });
            setVisualBuilderResult(res.data);
        } catch (error: any) {
            if (error.name !== 'CanceledError' && error.code !== 'ERR_CANCELED') {
                toast.error(error.response?.data?.error || 'Failed to generate visual');
                if (!visualBuilderResult) setShowVisualBuilderModal(false);
            }
        } finally {
            clearTimeout(timeout);
            if (!controller.signal.aborted) {
                setVisualBuilderLoading(false);
            }
        }
    };

    const handleUseVisual = () => {
        if (!visualBuilderResult) return;
        const attachment: Attachment = {
            url: visualBuilderResult.imageUrl,
            name: visualBuilderResult.name,
            type: visualBuilderResult.type,
            size: visualBuilderResult.size,
        };
        setAttachments(prev => [...prev, attachment]);
        setShowVisualBuilderModal(false);
        setVisualBuilderResult(null);
        toast.success('Visual added to attachments');
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

            const postData = {
                content,
                scheduledTime: finalScheduledTime || undefined,
                platforms,
                authorUrn: selectedAuthorUrn,
                authorName: selectedAuthor?.name || "",
                status,
                mediaUrls: attachments // Stored as mediaUrls in DB
            };

            if (editingPostId) {
                // Update existing post
                await api.put(`/posts/${editingPostId}`, postData);
                toast.success(status === 'DRAFT' ? "Post updated!" : "Post scheduled successfully!");
            } else {
                // Create new post
                await api.post("/posts", postData);
                toast.success(status === 'DRAFT' ? "Post saved as draft!" : "Post scheduled successfully!");
            }
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
                <h2 className="text-3xl font-bold tracking-tight">
                    {loadingPost ? "Loading Post..." : editingPostId ? "Edit Post" : "Create Post"}
                </h2>
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
                                <div className="relative" ref={aiToolsDropdownRef}>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setShowAIToolsDropdown(!showAIToolsDropdown)}
                                        className="text-primary border-primary/20 hover:bg-primary/5"
                                    >
                                        <Sparkles className="mr-2 h-4 w-4 text-amber-500" />
                                        AI Tools
                                        <ChevronDown className="ml-2 h-4 w-4" />
                                    </Button>
                                    {showAIToolsDropdown && (
                                        <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-md border border-input bg-background shadow-lg py-1">
                                            <button
                                                type="button"
                                                className="w-full text-left px-4 py-2 text-sm hover:bg-muted flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                                                onClick={() => { setShowAIToolsDropdown(false); handleAIImprovise(); }}
                                                disabled={aiLoading || variationsLoading || !content}
                                            >
                                                <Sparkles className="mr-2 h-4 w-4 text-amber-500" />
                                                {aiLoading ? "Improvising..." : "AImprovise"}
                                            </button>
                                            <button
                                                type="button"
                                                className="w-full text-left px-4 py-2 text-sm hover:bg-muted flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                                                onClick={() => { setShowAIToolsDropdown(false); handleGenerateVariations(); }}
                                                disabled={!content || aiLoading || variationsLoading}
                                            >
                                                <GitBranch className="mr-2 h-4 w-4 text-blue-500" />
                                                Variations
                                            </button>
                                            <button
                                                type="button"
                                                className="w-full text-left px-4 py-2 text-sm hover:bg-muted flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                                                onClick={() => { setShowAIToolsDropdown(false); handleGenerateHooks(); }}
                                                disabled={!content || aiLoading || hooksLoading}
                                            >
                                                <Zap className="mr-2 h-4 w-4 text-orange-500" />
                                                Hooks
                                            </button>
                                            <button
                                                type="button"
                                                className="w-full text-left px-4 py-2 text-sm hover:bg-muted flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                                                onClick={() => { setShowAIToolsDropdown(false); handleGenerateHashtags(); }}
                                                disabled={!content || hashtagsLoading}
                                            >
                                                {hashtagsLoading ? (
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin text-green-500" />
                                                ) : (
                                                    <Hash className="mr-2 h-4 w-4 text-green-500" />
                                                )}
                                                Hashtags
                                            </button>
                                            <div className="border-t border-input my-1" />
                                            <button
                                                type="button"
                                                className="w-full text-left px-4 py-2 text-sm hover:bg-muted flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                                                onClick={() => { setShowAIToolsDropdown(false); setShowVisualBuilderModal(true); setVisualBuilderResult(null); }}
                                                disabled={!content || visualBuilderLoading}
                                            >
                                                <Palette className="mr-2 h-4 w-4 text-purple-500" />
                                                Visual Builder
                                            </button>
                                        </div>
                                    )}
                                </div>
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
                        <Button type="submit" disabled={loading || uploading || loadingPost} onClick={(e) => {
                            e.preventDefault();
                            handleSubmit(e, 'SCHEDULED');
                        }}>
                            {loading ? "Saving..." : editingPostId ? "Update & Schedule" : "Schedule Post"}
                        </Button>
                        <Button
                            type="button"
                            variant="secondary"
                            disabled={loading || uploading || loadingPost}
                            onClick={(e) => handleSubmit(e, 'DRAFT')}
                        >
                            {loading ? "Saving..." : editingPostId ? "Update Draft" : "Save as Draft"}
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

            {showVisualBuilderModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-3xl rounded-xl bg-background p-6 shadow-2xl border border-border animate-in zoom-in-95 duration-200">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-lg font-bold text-foreground flex items-center">
                                <Palette className="mr-2 h-5 w-5 text-purple-500" />
                                Visual Builder
                            </h3>
                            <button
                                onClick={() => { setShowVisualBuilderModal(false); setVisualBuilderResult(null); }}
                                className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-full hover:bg-slate-100"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        {visualBuilderTimedOut && !visualBuilderLoading ? (
                            <div className="flex flex-col items-center justify-center py-16">
                                <AlertCircle className="h-10 w-10 text-amber-500 mb-4" />
                                <p className="text-muted-foreground font-medium">Generation timed out</p>
                                <p className="text-xs text-muted-foreground mt-1">The visual took too long to generate. This can happen with complex content.</p>
                                <div className="flex gap-2 mt-4">
                                    <button
                                        onClick={() => handleVisualBuilder()}
                                        className="px-4 py-2 rounded-lg bg-purple-600 text-white text-sm font-medium hover:bg-purple-700"
                                    >
                                        Retry
                                    </button>
                                    <button
                                        onClick={() => { setShowVisualBuilderModal(false); setVisualBuilderTimedOut(false); }}
                                        className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        ) : visualBuilderLoading ? (
                            <div className="flex flex-col items-center justify-center py-16">
                                <Loader2 className="h-10 w-10 animate-spin text-purple-500 mb-4" />
                                <p className="text-muted-foreground">Generating visual...</p>
                                <p className="text-xs text-muted-foreground mt-1">This may take up to 2 minutes</p>
                            </div>
                        ) : visualBuilderResult ? (
                            <div className="space-y-4">
                                <div className="rounded-lg border border-border overflow-hidden bg-slate-950">
                                    <img
                                        src={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5002'}${visualBuilderResult.imageUrl}`}
                                        alt="Generated visual"
                                        className="w-full h-auto"
                                    />
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <span className="px-2 py-1 rounded bg-purple-100 text-purple-700 font-medium">
                                        {VISUAL_TEMPLATES.find(t => t.key === visualTemplate)?.name}
                                    </span>
                                    <span className="px-2 py-1 rounded bg-slate-100 text-slate-700 font-medium">
                                        {VISUAL_SIZES.find(s => s.key === visualSize)?.desc}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between pt-2 border-t border-border">
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => { setVisualBuilderResult(null); }}
                                        >
                                            Change Template
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleVisualBuilder()}
                                            disabled={visualBuilderLoading}
                                        >
                                            <RefreshCw className="mr-1 h-3.5 w-3.5" />
                                            Regenerate
                                        </Button>
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={handleUseVisual}
                                        className="bg-purple-600 hover:bg-purple-700"
                                    >
                                        Use This
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-5">
                                <div>
                                    <p className="text-sm text-muted-foreground mb-3">Choose a template to convert your post into a visual:</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                        {VISUAL_TEMPLATES.map((tmpl) => (
                                            <button
                                                key={tmpl.key}
                                                type="button"
                                                onClick={() => handleVisualBuilder(tmpl.key)}
                                                disabled={visualBuilderLoading}
                                                className={`text-left p-4 rounded-lg border-2 transition-all hover:border-purple-400 hover:bg-purple-50 ${
                                                    visualTemplate === tmpl.key ? 'border-purple-500 bg-purple-50' : 'border-border'
                                                }`}
                                            >
                                                <div className="text-2xl mb-2">{tmpl.icon}</div>
                                                <div className="text-sm font-semibold text-foreground">{tmpl.name}</div>
                                                <div className="text-xs text-muted-foreground mt-0.5">{tmpl.description}</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs font-medium text-muted-foreground mb-2">Image Size</p>
                                    <div className="flex gap-2">
                                        {VISUAL_SIZES.map((s) => (
                                            <button
                                                key={s.key}
                                                type="button"
                                                onClick={() => setVisualSize(s.key)}
                                                className={`px-3 py-1.5 text-xs rounded-md border transition-all ${
                                                    visualSize === s.key
                                                        ? 'border-purple-500 bg-purple-50 text-purple-700 font-medium'
                                                        : 'border-border text-muted-foreground hover:border-purple-300'
                                                }`}
                                            >
                                                {s.label} <span className="opacity-60">{s.desc}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div >
    );
}
