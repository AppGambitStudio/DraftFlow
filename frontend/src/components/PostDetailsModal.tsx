import React, { useState, useEffect, useRef } from 'react';
import { X, Trash2, Save, Sparkles, Send, Repeat, FileText, ArrowUp, ArrowDown, Paperclip, Loader2, Undo2, ChevronDown, GitBranch, Zap, Hash, Palette, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { ConfirmationModal } from './ConfirmationModal';
import api from "@/lib/api";
import toast from "react-hot-toast";

interface Post {
    id: number;
    content: string;
    scheduledTime: string | null;
    status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED' | 'GENERATING';
    mediaUrls?: string;
    platforms?: string;
    authorUrn?: string;
    authorName?: string;
}

interface PostDetailsModalProps {
    post: Post | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: (id: number, data: { content: string; scheduledTime: string | null; authorUrn?: string; authorName?: string, status?: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED', mediaUrls?: any[] }) => Promise<void>;
    onDelete: (id: number) => Promise<void>;
}

import { useAuthors } from "@/contexts/AuthorsContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useRouter } from "next/navigation";

export function PostDetailsModal({ post, isOpen, onClose, onSave, onDelete }: PostDetailsModalProps) {
    const router = useRouter();
    const { authors, loading: authorsLoading } = useAuthors();
    const { settings } = useSettings();
    const [content, setContent] = useState('');
    const [scheduledTime, setScheduledTime] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [selectedAuthorUrn, setSelectedAuthorUrn] = useState<string>('');
    const [selectedAudience, setSelectedAudience] = useState<string>('');
    const [attachments, setAttachments] = useState<any[]>([]);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [contentHistory, setContentHistory] = useState<string[]>([]);
    const [improviseDirection, setImproviseDirection] = useState<string>('');
    const [customDirection, setCustomDirection] = useState<string>('');
    const [showDirectionDropdown, setShowDirectionDropdown] = useState(false);
    const directionDropdownRef = useRef<HTMLDivElement>(null);
    const [showAIToolsDropdown, setShowAIToolsDropdown] = useState(false);
    const aiToolsDropdownRef = useRef<HTMLDivElement>(null);
    const [showVariationsModal, setShowVariationsModal] = useState(false);
    const [variations, setVariations] = useState<Array<{ content: string; format: string }>>([]);
    const [variationsLoading, setVariationsLoading] = useState(false);
    const [showHooksModal, setShowHooksModal] = useState(false);
    const [hooks, setHooks] = useState<Array<{ hook: string; style: string }>>([]);
    const [hooksLoading, setHooksLoading] = useState(false);
    const [hashtagsLoading, setHashtagsLoading] = useState(false);
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
        if (post) {
            setContent(post.content);
            try {
                if (post.scheduledTime) {
                    const date = new Date(post.scheduledTime);
                    const formatted = format(date, "yyyy-MM-dd'T'HH:mm");
                    setScheduledTime(formatted);
                } else {
                    setScheduledTime('');
                }
            } catch (e) {
                console.error("Error formatting date:", e);
                setScheduledTime(post.scheduledTime || '');
            }
            setSelectedAuthorUrn(post.authorUrn || '');
            if (post.mediaUrls) {
                try {
                    let parsed = typeof post.mediaUrls === 'string' ? JSON.parse(post.mediaUrls) : post.mediaUrls;
                    // Handle double-stringification if it somehow happened in the past
                    if (typeof parsed === 'string') {
                        parsed = JSON.parse(parsed);
                    }
                    setAttachments(Array.isArray(parsed) ? parsed : []);
                } catch (e) {
                    console.error("Error parsing mediaUrls:", e);
                    setAttachments([]);
                }
            } else {
                setAttachments([]);
            }
            setShowDeleteConfirm(false);
        }
    }, [post]);

    useEffect(() => {
        if (isOpen) {
            // If no author selected (new post or legacy), default to first one (Self)
            if (!post?.authorUrn && authors.length > 0) {
                setSelectedAuthorUrn(authors[0].urn);
            }
            // Reset undo history and direction when opening a new post
            setContentHistory([]);
            setImproviseDirection('');
            setCustomDirection('');
        }
    }, [isOpen, authors, post]);

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

    if (!isOpen || !post) return null;

    const isPublished = post.status === 'PUBLISHED';
    const isGenerating = post.status === 'GENERATING';
    const postPlatforms = post.platforms ? JSON.parse(post.platforms) : ['LINKEDIN'];

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
                direction: getActiveDirection(),
                platform: postPlatforms.join(',')
            });
            setContent(res.data.content);
            toast.success("Content improved by AI!");
        } catch (error: any) {
            setContentHistory(prev => prev.slice(0, -1));
            toast.error(error.response?.data?.error || "Failed to improvise content");
        } finally {
            setAiLoading(false);
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
                platform: postPlatforms[0] || 'LINKEDIN'
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
                platform: postPlatforms[0] || 'LINKEDIN'
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
                platform: postPlatforms[0] || 'LINKEDIN'
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

    const handleVisualBuilder = async (templateKey?: string) => {
        if (!content) return;
        const tmpl = templateKey || visualTemplate;
        setVisualTemplate(tmpl);
        setVisualBuilderLoading(true);
        setVisualBuilderResult(null);
        setShowVisualBuilderModal(true);
        try {
            const res = await api.post('/ai/visual-builder', {
                content,
                template: tmpl,
                size: visualSize,
            });
            setVisualBuilderResult(res.data);
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to generate visual');
            if (!visualBuilderResult) setShowVisualBuilderModal(false);
        } finally {
            setVisualBuilderLoading(false);
        }
    };

    const handleUseVisual = () => {
        if (!visualBuilderResult) return;
        const attachment = {
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

    const handlePublishNow = async () => {
        setIsLoading(true);
        try {
            const selectedAuthor = authors.find(a => a.urn === selectedAuthorUrn);

            // First save any changes
            await api.put(`/posts/${post.id}`, {
                content,
                scheduledTime,
                authorUrn: selectedAuthorUrn,
                authorName: selectedAuthor?.name || "",
                mediaUrls: attachments
            });

            // Then trigger publish
            await api.post(`/posts/${post.id}/publish`);

            toast.success("Post published successfully!");
            onClose();
            window.location.reload();
        } catch (error: any) {
            console.error('Failed to publish:', error);
            toast.error(error.response?.data?.error || "Failed to publish post");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSave = async () => {
        setIsLoading(true);
        try {
            const selectedAuthor = authors.find(a => a.urn === selectedAuthorUrn);
            let finalScheduledTime = scheduledTime;

            // If it's a draft and no time, use current
            if (post.status === 'DRAFT' && !finalScheduledTime) {
                finalScheduledTime = new Date().toISOString();
            }

            await onSave(post.id, {
                content,
                scheduledTime: finalScheduledTime || null,
                authorUrn: selectedAuthorUrn,
                authorName: selectedAuthor?.name || "",
                status: post.status === 'GENERATING' ? 'DRAFT' : post.status,
                mediaUrls: attachments
            });
            onClose();
        } catch (error) {
            console.error('Failed to save:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleMoveToDraft = async () => {
        setIsLoading(true);
        try {
            const selectedAuthor = authors.find(a => a.urn === selectedAuthorUrn);
            let finalScheduledTime = scheduledTime;

            // If moving to draft and no time, use current
            if (!finalScheduledTime) {
                finalScheduledTime = new Date().toISOString();
            }

            await onSave(post.id, {
                content,
                scheduledTime: finalScheduledTime || null,
                authorUrn: selectedAuthorUrn,
                authorName: selectedAuthor?.name || "",
                status: 'DRAFT',
                mediaUrls: attachments
            });
            toast.success("Post moved to draft");
            onClose();
        } catch (error) {
            console.error('Failed to move to draft:', error);
            toast.error("Failed to move to draft");
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteClick = () => {
        setShowDeleteConfirm(true);
    };

    const handleConfirmDelete = async () => {
        setIsLoading(true);
        try {
            await onDelete(post.id);
            onClose();
        } catch (error) {
            console.error('Failed to delete:', error);
        } finally {
            setIsLoading(false);
            setShowDeleteConfirm(false);
        }
    };

    const handleRepost = () => {
        if (!post) return;
        localStorage.setItem('draftPostContent', post.content);
        localStorage.setItem('draftPostAttachments', JSON.stringify(attachments));
        // Force a small delay to ensure modal close animation doesn't conflict
        onClose();
        router.push('/create?source=repost');
    };

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

    return (
        <>
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                <div className="w-full max-w-3xl rounded-xl bg-background p-6 shadow-2xl border border-border animate-in zoom-in-95 duration-200">
                    <div className="mb-6 flex items-center justify-between">
                        <h2 className="text-xl font-bold text-foreground">Post Details</h2>
                        <div className="flex items-center gap-2">
                            {!isPublished && (
                                <button
                                    onClick={handleDeleteClick}
                                    className="text-red-500 hover:text-red-600 transition-colors p-2 rounded-full hover:bg-red-50"
                                    title="Delete Post"
                                >
                                    <Trash2 className="h-5 w-5" />
                                </button>
                            )}
                            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-2 rounded-full hover:bg-slate-100">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    <div className="space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-muted-foreground">Status</Label>
                                <div className="flex items-center gap-2">
                                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${post.status === 'PUBLISHED' ? 'bg-green-50 text-green-700 border-green-200' :
                                        post.status === 'SCHEDULED' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                            post.status === 'FAILED' ? 'bg-red-50 text-red-700 border-red-200' :
                                                post.status === 'GENERATING' ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse' :
                                                    'bg-gray-50 text-gray-700 border-gray-200'
                                        }`}>
                                        {post.status === 'GENERATING' ? 'Generating...' : post.status}
                                    </span>
                                    {postPlatforms.map((platform: string) => (
                                        <span key={platform} className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border bg-slate-100 text-slate-700 border-slate-200">
                                            {platform === 'LINKEDIN' ? 'LinkedIn' : 'Twitter'}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="author">Post As</Label>
                                <select
                                    id="author"
                                    value={selectedAuthorUrn}
                                    onChange={(e) => setSelectedAuthorUrn(e.target.value)}
                                    disabled={isPublished || isGenerating || isLoading || authorsLoading}
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {authors.map((author, index) => (
                                        <option key={index} value={author.urn}>
                                            {author.name}
                                        </option>
                                    ))}
                                </select>
                            </div>


                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="content">Content</Label>
                                {!isPublished && (
                                    <div className="flex items-center gap-2">
                                        {contentHistory.length > 0 && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleUndo}
                                                disabled={aiLoading || isLoading}
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
                                                disabled={isPublished || isGenerating || isLoading}
                                                className="h-8 w-[180px] rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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
                                )}
                            </div>
                            <Textarea
                                id="content"
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                disabled={isPublished || isGenerating || isLoading}
                                className="min-h-[200px]"
                            />
                            <div className="flex justify-end">
                                <span className={`text-xs ${content.length > (postPlatforms.includes('TWITTER') ? 280 : 3000)
                                    ? 'text-red-500 font-medium' : 'text-muted-foreground'
                                    }`}>
                                    {content.length} / {postPlatforms.includes('TWITTER') ? 280 : 3000} characters
                                </span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="time">Scheduled Time</Label>
                            <Input
                                id="time"
                                type="datetime-local"
                                value={scheduledTime}
                                onChange={(e) => setScheduledTime(e.target.value)}
                                disabled={isPublished || isGenerating || isLoading}
                            />
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Attachments</Label>
                                {!isPublished && (
                                    <>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => fileInputRef.current?.click()}
                                            disabled={uploading || isLoading}
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
                                    </>
                                )}
                            </div>
                            {Array.isArray(attachments) && attachments.length > 0 && (
                                <div className="grid grid-cols-1 gap-2">
                                    {attachments.map((file: any, index: number) => (
                                        <div key={index} className="flex items-center justify-between p-2 rounded-md border border-slate-200 bg-slate-50">
                                            <div className="flex items-center gap-2 min-w-0">
                                                {file.type && file.type.startsWith('image/') ? (
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
                                            {!isPublished && (
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
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
                            <Button variant="outline" onClick={onClose} disabled={isLoading}>
                                Cancel
                            </Button>

                            {!isPublished && (
                                <>
                                    {post.status === 'SCHEDULED' && (
                                        <Button
                                            variant="outline"
                                            onClick={handleMoveToDraft}
                                            disabled={isLoading}
                                            className="text-slate-600 border-slate-200 hover:bg-slate-50"
                                        >
                                            <Repeat className="mr-2 h-4 w-4" />
                                            Move to Draft
                                        </Button>
                                    )}
                                    <Button
                                        onClick={handlePublishNow}
                                        disabled={isLoading}
                                        className="bg-green-600 hover:bg-green-700 text-white"
                                    >
                                        <Send className="mr-2 h-4 w-4" />
                                        Publish Now
                                    </Button>
                                    <Button onClick={handleSave} disabled={isLoading}>
                                        <Save className="mr-2 h-4 w-4" />
                                        Save Changes
                                    </Button>
                                </>
                            )}

                            {(post.status === 'PUBLISHED' || post.status === 'FAILED') && (
                                <Button onClick={handleRepost} variant="secondary">
                                    <Repeat className="mr-2 h-4 w-4" />
                                    Repost
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {showVariationsModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
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
                                    <div key={index} className="rounded-lg border border-border p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="inline-block px-3 py-1 text-xs font-medium uppercase rounded-full bg-indigo-100 text-indigo-700">
                                                {variation.format}
                                            </span>
                                            <Button size="sm" onClick={() => handleSelectVariation(variation)}>
                                                Use This
                                            </Button>
                                        </div>
                                        <p className="text-sm text-foreground whitespace-pre-wrap">{variation.content}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showHooksModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
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
                                    <div key={index} className="rounded-lg border border-border p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <span className="inline-block px-3 py-1 text-xs font-medium uppercase rounded-full bg-amber-100 text-amber-700">
                                                {hook.style}
                                            </span>
                                            <Button size="sm" onClick={() => handleSelectHook(hook)}>
                                                Use This
                                            </Button>
                                        </div>
                                        <p className="text-sm text-foreground whitespace-pre-wrap">{hook.hook}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showVisualBuilderModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
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

                        {visualBuilderLoading ? (
                            <div className="flex flex-col items-center justify-center py-16">
                                <Loader2 className="h-10 w-10 animate-spin text-purple-500 mb-4" />
                                <p className="text-muted-foreground">Generating visual...</p>
                                <p className="text-xs text-muted-foreground mt-1">This may take 10-20 seconds</p>
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
                                        <Button variant="outline" size="sm" onClick={() => { setVisualBuilderResult(null); }}>
                                            Change Template
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => handleVisualBuilder()} disabled={visualBuilderLoading}>
                                            <RefreshCw className="mr-1 h-3.5 w-3.5" />
                                            Regenerate
                                        </Button>
                                    </div>
                                    <Button size="sm" onClick={handleUseVisual} className="bg-purple-600 hover:bg-purple-700">
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

            <ConfirmationModal
                isOpen={showDeleteConfirm}
                title="Delete Post"
                message="Are you sure you want to delete this post? This action cannot be undone."
                onConfirm={handleConfirmDelete}
                onCancel={() => setShowDeleteConfirm(false)}
                isLoading={isLoading}
            />
        </>
    );
}

