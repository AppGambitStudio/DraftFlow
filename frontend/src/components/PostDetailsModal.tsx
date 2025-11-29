import React, { useState, useEffect } from 'react';
import { X, Trash2, Save, Sparkles, Send } from 'lucide-react';
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
    scheduledTime: string;
    status: 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED';
    mediaUrls?: string;
    platforms?: string;
    authorUrn?: string;
    authorName?: string;
}

interface PostDetailsModalProps {
    post: Post | null;
    isOpen: boolean;
    onClose: () => void;
    onSave: (id: number, data: { content: string; scheduledTime: string; authorUrn?: string; authorName?: string }) => Promise<void>;
    onDelete: (id: number) => Promise<void>;
}

import { useAuthors } from "@/contexts/AuthorsContext";

export function PostDetailsModal({ post, isOpen, onClose, onSave, onDelete }: PostDetailsModalProps) {
    const { authors, loading: authorsLoading } = useAuthors();
    const [content, setContent] = useState('');
    const [scheduledTime, setScheduledTime] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [selectedAuthorUrn, setSelectedAuthorUrn] = useState<string>('');

    useEffect(() => {
        if (post) {
            setContent(post.content);
            try {
                const date = new Date(post.scheduledTime);
                const formatted = format(date, "yyyy-MM-dd'T'HH:mm");
                setScheduledTime(formatted);
            } catch (e) {
                console.error("Error formatting date:", e);
                setScheduledTime(post.scheduledTime);
            }
            setSelectedAuthorUrn(post.authorUrn || '');
            setShowDeleteConfirm(false);
        }
    }, [post]);

    useEffect(() => {
        if (isOpen) {
            // If no author selected (new post or legacy), default to first one (Self)
            if (!post?.authorUrn && authors.length > 0) {
                setSelectedAuthorUrn(authors[0].urn);
            }
        }
    }, [isOpen, authors, post]);

    if (!isOpen || !post) return null;

    const isPublished = post.status === 'PUBLISHED';

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

    const handlePublishNow = async () => {
        setIsLoading(true);
        try {
            const selectedAuthor = authors.find(a => a.urn === selectedAuthorUrn);

            // First save any changes
            await api.put(`/posts/${post.id}`, {
                content,
                scheduledTime,
                authorUrn: selectedAuthorUrn,
                authorName: selectedAuthor?.name || ""
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
            await onSave(post.id, {
                content,
                scheduledTime,
                authorUrn: selectedAuthorUrn,
                authorName: selectedAuthor?.name || ""
            });
            onClose();
        } catch (error) {
            console.error('Failed to save:', error);
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
                                                'bg-gray-50 text-gray-700 border-gray-200'
                                        }`}>
                                        {post.status}
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
                                    disabled={isPublished || isLoading || authorsLoading}
                                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {authors.map((author) => (
                                        <option key={author.urn} value={author.urn}>
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
                                )}
                            </div>
                            <Textarea
                                id="content"
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                disabled={isPublished || isLoading}
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
                                disabled={isPublished || isLoading}
                            />
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-border mt-6">
                            <Button variant="outline" onClick={onClose} disabled={isLoading}>
                                Cancel
                            </Button>

                            {!isPublished && (
                                <>
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
