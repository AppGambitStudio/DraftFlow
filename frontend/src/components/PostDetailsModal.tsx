import React, { useState, useEffect, useRef } from 'react';
import { X, Trash2, Save, Sparkles, Send, Repeat, FileText, ArrowUp, ArrowDown, Paperclip, Loader2, Undo2, ChevronDown } from 'lucide-react';
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
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!isOpen || !post) return null;

    const isPublished = post.status === 'PUBLISHED';
    const isGenerating = post.status === 'GENERATING';

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
            const postPlatforms = post.platforms ? JSON.parse(post.platforms) : ['LINKEDIN'];
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
                                    {post.platforms && JSON.parse(post.platforms).map((platform: string) => (
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
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleAIImprovise}
                                            disabled={aiLoading || !content || isLoading}
                                            className="text-primary hover:text-primary hover:bg-primary/10"
                                        >
                                            <Sparkles className="mr-2 h-4 w-4" />
                                            {aiLoading ? "Improvising..." : "AImprovise"}
                                        </Button>
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
                                <span className={`text-xs ${(() => {
                                    const platforms = post.platforms ? JSON.parse(post.platforms) : ['LINKEDIN'];
                                    const limit = platforms.includes('TWITTER') ? 280 : 3000;
                                    return content.length > limit ? 'text-red-500 font-medium' : 'text-muted-foreground';
                                })()
                                    }`}>
                                    {content.length} / {(() => {
                                        const platforms = post.platforms ? JSON.parse(post.platforms) : ['LINKEDIN'];
                                        return platforms.includes('TWITTER') ? 280 : 3000;
                                    })()} characters
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

