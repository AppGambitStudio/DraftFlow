"use client";

import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import toast, { Toaster } from "react-hot-toast";
import {
    Bot,
    Sparkles,
    Loader2,
    Check,
    X,
    Clock,
    RefreshCw,
    Pencil,
    Hash,
    Lightbulb,
    FileText,
    Calendar,
    ThumbsUp,
    ThumbsDown,
    Linkedin,
    Twitter,
    ChevronDown,
    ChevronUp,
} from "lucide-react";

interface AgentDraft {
    id: string;
    content: string;
    explanation: string;
    sources: string[];
    hooks: string[];
    hashtags: string[];
    status: "pending" | "approved" | "rejected";
    platform: "LINKEDIN" | "TWITTER";
    postId?: number;
    scheduledFor?: string;
    createdAt: string;
}

type TabType = "pending" | "approved" | "rejected";

interface TabCounts {
    pending: number;
    approved: number;
    rejected: number;
}

export default function AgentPage() {
    const [drafts, setDrafts] = useState<AgentDraft[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [generating, setGenerating] = useState(false);
    const [count, setCount] = useState(3);
    const [platform, setPlatform] = useState<"LINKEDIN" | "TWITTER">("LINKEDIN");
    const [focus, setFocus] = useState("auto");
    const [context, setContext] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editContent, setEditContent] = useState("");
    const [editExplanation, setEditExplanation] = useState("");
    const [approvingId, setApprovingId] = useState<string | null>(null);
    const [scheduledTime, setScheduledTime] = useState("");
    const [savingId, setSavingId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>("pending");
    const [showGenerator, setShowGenerator] = useState(true);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [totalCount, setTotalCount] = useState(0);
    const [tabCounts, setTabCounts] = useState<TabCounts>({ pending: 0, approved: 0, rejected: 0 });

    const ITEMS_PER_PAGE = 10;

    const fetchDrafts = useCallback(async (status: TabType, page: number = 1, append: boolean = false) => {
        try {
            if (page === 1) {
                setLoading(true);
            } else {
                setLoadingMore(true);
            }

            const res = await api.get(`/agent/drafts?status=${status}&page=${page}&limit=${ITEMS_PER_PAGE}`);

            if (append) {
                setDrafts(prev => [...prev, ...(res.data.drafts || [])]);
            } else {
                setDrafts(res.data.drafts || []);
            }

            setCurrentPage(res.data.page || 1);
            setHasMore(res.data.hasMore || false);
            setTotalCount(res.data.totalCount || 0);
            setTabCounts(res.data.counts || { pending: 0, approved: 0, rejected: 0 });
        } catch (error) {
            console.error("Failed to fetch drafts:", error);
            toast.error("Failed to load drafts");
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, []);

    useEffect(() => {
        fetchDrafts(activeTab, 1);
    }, [activeTab, fetchDrafts]);

    const handleTabChange = (tab: TabType) => {
        setActiveTab(tab);
        setCurrentPage(1);
        setDrafts([]);
    };

    const handleLoadMore = () => {
        fetchDrafts(activeTab, currentPage + 1, true);
    };

    const handleRefresh = () => {
        fetchDrafts(activeTab, 1);
    };

    const handleGenerate = async () => {
        setGenerating(true);
        try {
            const res = await api.post("/agent/generate", {
                count,
                platform,
                focus: focus || "auto",
                context: context.trim() || undefined,
            });
            if (res.data.drafts && res.data.drafts.length > 0) {
                // Refresh the pending tab to show new drafts
                if (activeTab === "pending") {
                    fetchDrafts("pending", 1);
                } else {
                    setActiveTab("pending");
                }
                toast.success(`Generated ${res.data.drafts.length} new drafts`);
            } else {
                toast.error("No drafts generated. Try adjusting your focus.");
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to generate drafts");
        } finally {
            setGenerating(false);
        }
    };

    const handleApprove = async (id: string) => {
        setApprovingId(id);
        try {
            const res = await api.post(`/agent/drafts/${id}/approve`, {
                scheduledTime: scheduledTime || undefined,
            });
            const postId = res.data.post?.id;
            const isScheduled = !!scheduledTime;

            // Remove from current list and update counts
            setDrafts(prev => prev.filter(d => d.id !== id));
            setTotalCount(prev => prev - 1);
            setTabCounts(prev => ({
                ...prev,
                pending: prev.pending - 1,
                approved: prev.approved + 1
            }));
            setScheduledTime("");

            toast.success(
                <div className="flex flex-col gap-1">
                    <span>{isScheduled ? "Draft approved and scheduled!" : "Draft approved as draft post!"}</span>
                    {postId && (
                        <a
                            href={`/create?postId=${postId}`}
                            className="text-violet-600 hover:text-violet-800 underline text-sm"
                        >
                            Edit / Schedule Post →
                        </a>
                    )}
                </div>,
                { duration: 5000 }
            );
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to approve draft");
        } finally {
            setApprovingId(null);
        }
    };

    const handleReject = async (id: string) => {
        try {
            await api.post(`/agent/drafts/${id}/reject`);
            toast.success("Draft rejected");

            // Remove from current list and update counts
            setDrafts(prev => prev.filter(d => d.id !== id));
            setTotalCount(prev => prev - 1);
            setTabCounts(prev => ({
                ...prev,
                pending: prev.pending - 1,
                rejected: prev.rejected + 1
            }));
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to reject draft");
        }
    };

    const handleStartEdit = (draft: AgentDraft) => {
        setEditingId(draft.id);
        setEditContent(draft.content);
        setEditExplanation(draft.explanation);
    };

    const handleSaveEdit = async (id: string) => {
        setSavingId(id);
        try {
            const res = await api.put(`/agent/drafts/${id}`, {
                content: editContent,
                explanation: editExplanation,
            });
            setDrafts(prev =>
                prev.map(d => (d.id === id ? res.data.draft : d))
            );
            toast.success("Draft updated");
            setEditingId(null);
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to update draft");
        } finally {
            setSavingId(null);
        }
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditContent("");
        setEditExplanation("");
    };

    const getStatusBadge = (status: AgentDraft["status"]) => {
        switch (status) {
            case "approved":
                return (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                        <Check className="h-3 w-3" />
                        Approved
                    </span>
                );
            case "rejected":
                return (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                        <X className="h-3 w-3" />
                        Rejected
                    </span>
                );
            default:
                return (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock className="h-3 w-3" />
                        Pending
                    </span>
                );
        }
    };

    const getPlatformIcon = (platform: AgentDraft["platform"]) => {
        return platform === "LINKEDIN" ? (
            <Linkedin className="h-4 w-4 text-blue-600" />
        ) : (
            <Twitter className="h-4 w-4 text-sky-500" />
        );
    };

    const renderDraftCard = (draft: AgentDraft, isCompact: boolean = false) => {
        if (isCompact) {
            // Compact view for approved/rejected
            return (
                <Card
                    key={draft.id}
                    className={`border-slate-200 ${
                        draft.status === "approved"
                            ? "bg-green-50/30 hover:bg-green-50/50"
                            : "bg-red-50/30 hover:bg-red-50/50"
                    } transition-colors`}
                >
                    <CardContent className="py-4">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                    {getPlatformIcon(draft.platform)}
                                    {getStatusBadge(draft.status)}
                                    <span className="text-xs text-muted-foreground">
                                        {new Date(draft.createdAt).toLocaleString()}
                                    </span>
                                    {draft.scheduledFor && (
                                        <span className="text-xs text-green-600 flex items-center gap-1 bg-green-50 px-2 py-0.5 rounded-full">
                                            <Calendar className="h-3 w-3" />
                                            {new Date(draft.scheduledFor).toLocaleString()}
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                    {draft.content}
                                </p>
                            </div>
                            {draft.status === "approved" && draft.postId && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => window.location.href = `/create?postId=${draft.postId}`}
                                    className="shrink-0"
                                >
                                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                                    Edit Post
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            );
        }

        // Full view for pending
        return (
            <Card
                key={draft.id}
                className="border-slate-200 hover:border-violet-200 transition-colors"
            >
                <CardContent className="pt-6 space-y-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                            {getPlatformIcon(draft.platform)}
                            {getStatusBadge(draft.status)}
                            <span className="text-xs text-muted-foreground">
                                {new Date(draft.createdAt).toLocaleString()}
                            </span>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8"
                            onClick={() => handleStartEdit(draft)}
                        >
                            <Pencil className="h-3.5 w-3.5 mr-1" />
                            Edit
                        </Button>
                    </div>

                    {/* Content */}
                    {editingId === draft.id ? (
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>Content</Label>
                                <Textarea
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    className="min-h-[150px]"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Explanation</Label>
                                <Textarea
                                    value={editExplanation}
                                    onChange={(e) => setEditExplanation(e.target.value)}
                                    className="min-h-[80px]"
                                />
                            </div>
                            <div className="flex gap-2 justify-end">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleCancelEdit}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    size="sm"
                                    onClick={() => handleSaveEdit(draft.id)}
                                    disabled={savingId === draft.id}
                                >
                                    {savingId === draft.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        "Save Changes"
                                    )}
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                                <p className="text-sm whitespace-pre-wrap leading-relaxed">
                                    {draft.content}
                                </p>
                            </div>

                            {/* Explanation */}
                            {draft.explanation && (
                                <div className="flex items-start gap-2 p-3 bg-violet-50/50 rounded-lg border border-violet-100">
                                    <Lightbulb className="h-4 w-4 text-violet-500 mt-0.5 shrink-0" />
                                    <p className="text-xs text-violet-700">
                                        {draft.explanation}
                                    </p>
                                </div>
                            )}

                            {/* Metadata */}
                            <div className="grid gap-3 md:grid-cols-3">
                                {/* Hooks */}
                                {draft.hooks && draft.hooks.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                                            <FileText className="h-3.5 w-3.5" />
                                            Hooks
                                        </div>
                                        <div className="space-y-1">
                                            {draft.hooks.map((hook, i) => (
                                                <p
                                                    key={i}
                                                    className="text-xs text-muted-foreground bg-slate-50 px-2 py-1 rounded"
                                                >
                                                    {hook}
                                                </p>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Hashtags */}
                                {draft.hashtags && draft.hashtags.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                                            <Hash className="h-3.5 w-3.5" />
                                            Hashtags
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {draft.hashtags.map((tag, i) => (
                                                <span
                                                    key={i}
                                                    className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full"
                                                >
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Sources */}
                                {draft.sources && draft.sources.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                                            <Sparkles className="h-3.5 w-3.5" />
                                            Based On
                                        </div>
                                        <div className="flex flex-wrap gap-1.5">
                                            {draft.sources.map((source, i) => (
                                                <span
                                                    key={i}
                                                    className="inline-flex items-center text-xs px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100"
                                                >
                                                    {source}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {/* Actions */}
                    {editingId !== draft.id && (
                        <div className="pt-4 border-t flex items-center gap-3">
                            <div className="flex-1 flex items-center gap-2">
                                <Label
                                    htmlFor={`schedule-${draft.id}`}
                                    className="text-xs text-muted-foreground shrink-0"
                                >
                                    <Calendar className="h-3.5 w-3.5 inline mr-1" />
                                    Schedule for:
                                </Label>
                                <Input
                                    id={`schedule-${draft.id}`}
                                    type="datetime-local"
                                    value={scheduledTime}
                                    onChange={(e) => setScheduledTime(e.target.value)}
                                    className="h-8 text-xs max-w-[200px]"
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => handleReject(draft.id)}
                                >
                                    <ThumbsDown className="h-3.5 w-3.5 mr-1" />
                                    Reject
                                </Button>
                                <Button
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700"
                                    onClick={() => handleApprove(draft.id)}
                                    disabled={approvingId === draft.id}
                                >
                                    {approvingId === draft.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <>
                                            <ThumbsUp className="h-3.5 w-3.5 mr-1" />
                                            Approve
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    };

    return (
        <div className="space-y-6">
            <Toaster />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">AI Agent</h2>
                    <p className="text-muted-foreground">
                        Let the AI agent generate post drafts based on trends and your content strategy.
                    </p>
                </div>
            </div>

            {/* Generation Controls - Collapsible */}
            <Card className="border-slate-200">
                <CardHeader
                    className="pb-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                    onClick={() => setShowGenerator(!showGenerator)}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-violet-50 rounded-lg border border-violet-100">
                                <Bot className="h-5 w-5 text-violet-600" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Generate Drafts</CardTitle>
                                <CardDescription>
                                    Configure and generate AI-powered post drafts
                                </CardDescription>
                            </div>
                        </div>
                        <Button variant="ghost" size="sm">
                            {showGenerator ? (
                                <ChevronUp className="h-4 w-4" />
                            ) : (
                                <ChevronDown className="h-4 w-4" />
                            )}
                        </Button>
                    </div>
                </CardHeader>
                {showGenerator && (
                    <CardContent className="space-y-4 pt-0">
                        <div className="grid gap-4 md:grid-cols-3">
                            <div className="space-y-2">
                                <Label htmlFor="count">Number of Drafts</Label>
                                <Input
                                    id="count"
                                    type="number"
                                    min={1}
                                    max={10}
                                    value={count}
                                    onChange={(e) => setCount(parseInt(e.target.value) || 1)}
                                    className="bg-slate-50/30"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="platform">Platform</Label>
                                <select
                                    id="platform"
                                    value={platform}
                                    onChange={(e) => setPlatform(e.target.value as "LINKEDIN" | "TWITTER")}
                                    className="flex h-10 w-full rounded-md border border-input bg-slate-50/30 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <option value="LINKEDIN">LinkedIn</option>
                                    <option value="TWITTER">Twitter/X</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="focus">Content Source</Label>
                                <select
                                    id="focus"
                                    value={focus}
                                    onChange={(e) => setFocus(e.target.value)}
                                    className="flex h-10 w-full rounded-md border border-input bg-slate-50/30 px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <option value="auto">Auto (Mix of sources)</option>
                                    <option value="trends">Saved Trends</option>
                                    <option value="ideas">Idea Board</option>
                                    <option value="case-studies">Case Studies</option>
                                </select>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="context">Context / Starting Point (optional)</Label>
                            <Textarea
                                id="context"
                                value={context}
                                onChange={(e) => setContext(e.target.value)}
                                placeholder="Provide direction for the AI agent, e.g., 'Write about our experience migrating to serverless' or 'Focus on cost optimization tips for startups'..."
                                className="bg-slate-50/30 min-h-[80px]"
                                rows={3}
                            />
                            <p className="text-xs text-muted-foreground">
                                Give the agent a starting point to guide topic selection and content angle.
                            </p>
                        </div>
                        <div className="flex justify-end pt-2">
                            <Button
                                onClick={handleGenerate}
                                disabled={generating}
                                className="bg-violet-600 hover:bg-violet-700 px-6"
                            >
                                {generating ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="mr-2 h-4 w-4" />
                                        Generate Drafts
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardContent>
                )}
            </Card>

            {/* Tabs */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
                <button
                    onClick={() => handleTabChange("pending")}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                        activeTab === "pending"
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                    <Clock className="h-4 w-4" />
                    Pending
                    {tabCounts.pending > 0 && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            activeTab === "pending"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-slate-200 text-slate-600"
                        }`}>
                            {tabCounts.pending}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => handleTabChange("approved")}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                        activeTab === "approved"
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                    <Check className="h-4 w-4" />
                    Approved
                    {tabCounts.approved > 0 && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            activeTab === "approved"
                                ? "bg-green-100 text-green-700"
                                : "bg-slate-200 text-slate-600"
                        }`}>
                            {tabCounts.approved}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => handleTabChange("rejected")}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                        activeTab === "rejected"
                            ? "bg-white text-slate-900 shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                    }`}
                >
                    <X className="h-4 w-4" />
                    Rejected
                    {tabCounts.rejected > 0 && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                            activeTab === "rejected"
                                ? "bg-red-100 text-red-700"
                                : "bg-slate-200 text-slate-600"
                        }`}>
                            {tabCounts.rejected}
                        </span>
                    )}
                </button>
                <div className="ml-2 pl-2 border-l border-slate-300">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleRefresh}
                        className="h-8 px-2"
                        disabled={loading}
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            </div>

            {/* Drafts List */}
            {loading ? (
                <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mb-4 opacity-50" />
                    <p className="text-sm">Loading drafts...</p>
                </div>
            ) : drafts.length > 0 ? (
                <div className="space-y-4">
                    {/* Count header */}
                    <p className="text-sm text-muted-foreground">
                        Showing {drafts.length} of {totalCount} {activeTab} drafts
                    </p>

                    <div className="space-y-3">
                        {drafts.map((draft) =>
                            renderDraftCard(draft, activeTab !== "pending")
                        )}
                    </div>

                    {/* Load More */}
                    {hasMore && (
                        <div className="flex justify-center pt-4">
                            <Button
                                variant="outline"
                                onClick={handleLoadMore}
                                disabled={loadingMore}
                            >
                                {loadingMore ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Loading...
                                    </>
                                ) : (
                                    <>
                                        <ChevronDown className="mr-2 h-4 w-4" />
                                        Load More ({totalCount - drafts.length} remaining)
                                    </>
                                )}
                            </Button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg text-muted-foreground">
                    {activeTab === "pending" ? (
                        <>
                            <Bot className="h-12 w-12 mb-4 opacity-30" />
                            <p className="text-sm">No pending drafts. Generate some using the controls above.</p>
                        </>
                    ) : activeTab === "approved" ? (
                        <>
                            <Check className="h-12 w-12 mb-4 opacity-30" />
                            <p className="text-sm">No approved drafts yet.</p>
                        </>
                    ) : (
                        <>
                            <X className="h-12 w-12 mb-4 opacity-30" />
                            <p className="text-sm">No rejected drafts.</p>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
