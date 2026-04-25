"use client";

import { useState, useEffect, useCallback } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import ReactMarkdown from "react-markdown";
import {
    Plus,
    Library,
    Search,
    Trash2,
    X,
    Pencil,
    Download,
    FileText,
    Link as LinkIcon,
    Clock,
    BarChart3,
    ChevronDown,
    ChevronRight,
    Loader2,
    Globe,
    Type,
    Sparkles,
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

// ============================================================================
// Types
// ============================================================================

interface WikiPageSummary {
    slug: string;
    title: string;
    category: string;
    lastModified: string;
}

interface WikiPage {
    slug: string;
    title: string;
    category: string;
    content: string;
    sources: string[];
    lastModified: string;
}

interface WikiStats {
    pageCount: number;
    lastUpdated: string | null;
    sourcesIngested: number;
}

interface WikiQueryResult {
    slug: string;
    title: string;
    excerpt: string;
    relevanceScore: number;
}

// ============================================================================
// Component
// ============================================================================

export default function WikiPage() {
    // Page list
    const [pages, setPages] = useState<WikiPageSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchFilter, setSearchFilter] = useState("");

    // Selected page
    const [selectedPage, setSelectedPage] = useState<WikiPage | null>(null);
    const [pageLoading, setPageLoading] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState("");

    // Stats
    const [stats, setStats] = useState<WikiStats | null>(null);

    // Log
    const [logEntries, setLogEntries] = useState<string[]>([]);
    const [showLog, setShowLog] = useState(false);

    // Modals
    const [showNewPageModal, setShowNewPageModal] = useState(false);
    const [showIngestModal, setShowIngestModal] = useState(false);
    const [showSearchModal, setShowSearchModal] = useState(false);

    // New page form
    const [newPageTitle, setNewPageTitle] = useState("");
    const [newPageCategory, setNewPageCategory] = useState("");
    const [newPageContent, setNewPageContent] = useState("");

    // Ingest form
    const [ingestType, setIngestType] = useState<"url" | "text">("url");
    const [ingestContent, setIngestContent] = useState("");
    const [ingestTitle, setIngestTitle] = useState("");
    const [ingesting, setIngesting] = useState(false);
    const [ingestResult, setIngestResult] = useState<Array<{ slug: string; title: string; action: string }> | null>(null);

    // New page AI generation
    const [generatingPage, setGeneratingPage] = useState(false);

    // Search
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<WikiQueryResult[]>([]);
    const [searching, setSearching] = useState(false);

    // ========================================================================
    // Data fetching
    // ========================================================================

    const fetchPages = useCallback(async () => {
        try {
            const res = await api.get("/wiki/pages");
            setPages(res.data.pages || []);
        } catch (error) {
            console.error("Failed to fetch knowledgebase pages:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchStats = useCallback(async () => {
        try {
            const res = await api.get("/wiki/stats");
            setStats(res.data);
        } catch {
            // Stats endpoint may fail if wiki not initialized yet
        }
    }, []);

    const fetchLog = useCallback(async () => {
        try {
            const res = await api.get("/wiki/log?limit=20");
            setLogEntries(res.data.entries || []);
        } catch {
            // Ignore
        }
    }, []);

    useEffect(() => {
        fetchPages();
        fetchStats();
    }, [fetchPages, fetchStats]);

    // ========================================================================
    // Page actions
    // ========================================================================

    const loadPage = async (slug: string) => {
        setPageLoading(true);
        setIsEditing(false);
        try {
            const res = await api.get(`/wiki/pages/${slug}`);
            setSelectedPage(res.data);
            setEditContent(res.data.content);
        } catch (error) {
            toast.error("Failed to load page");
        } finally {
            setPageLoading(false);
        }
    };

    const savePage = async () => {
        if (!selectedPage) return;
        try {
            await api.put(`/wiki/pages/${selectedPage.slug}`, { content: editContent });
            toast.success("Page saved");
            setIsEditing(false);
            loadPage(selectedPage.slug);
            fetchPages();
            fetchStats();
        } catch (error) {
            toast.error("Failed to save page");
        }
    };

    const deletePage = async (slug: string) => {
        if (!confirm("Delete this knowledgebase page? This cannot be undone.")) return;
        try {
            await api.delete(`/wiki/pages/${slug}`);
            toast.success("Page deleted");
            if (selectedPage?.slug === slug) setSelectedPage(null);
            fetchPages();
            fetchStats();
        } catch (error) {
            toast.error("Failed to delete page");
        }
    };

    const generatePageContent = async () => {
        if (!newPageTitle.trim()) {
            toast.error("Enter a title/topic first");
            return;
        }
        setGeneratingPage(true);
        try {
            const res = await api.post("/wiki/generate", { title: newPageTitle });
            setNewPageContent(res.data.content || "");
            setNewPageCategory(res.data.category || "");
            toast.success("Content generated — review and save");
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to generate content");
        } finally {
            setGeneratingPage(false);
        }
    };

    const createPage = async () => {
        if (!newPageTitle.trim() || !newPageContent.trim()) {
            toast.error("Title and content are required");
            return;
        }
        try {
            const res = await api.post("/wiki/pages", {
                title: newPageTitle,
                content: newPageContent,
                category: newPageCategory || "uncategorized",
            });
            toast.success("Page created");
            setShowNewPageModal(false);
            setNewPageTitle("");
            setNewPageCategory("");
            setNewPageContent("");
            fetchPages();
            fetchStats();
            loadPage(res.data.slug);
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to create page");
        }
    };

    // ========================================================================
    // Ingest
    // ========================================================================

    const handleIngest = async () => {
        if (!ingestContent.trim()) {
            toast.error(ingestType === "url" ? "Enter a URL" : "Enter some text");
            return;
        }
        setIngesting(true);
        setIngestResult(null);
        try {
            const res = await api.post("/wiki/ingest", {
                type: ingestType,
                content: ingestContent,
                title: ingestTitle || undefined,
            });
            setIngestResult(res.data.pagesAffected || []);
            toast.success(`Ingested! ${res.data.pagesAffected?.length || 0} page(s) affected`);
            fetchPages();
            fetchStats();
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to ingest source");
        } finally {
            setIngesting(false);
        }
    };

    // ========================================================================
    // Search
    // ========================================================================

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;
        setSearching(true);
        try {
            const res = await api.post("/wiki/query", { query: searchQuery });
            setSearchResults(res.data.results || []);
        } catch (error) {
            toast.error("Search failed");
        } finally {
            setSearching(false);
        }
    };

    // ========================================================================
    // Filtering
    // ========================================================================

    const filteredPages = pages.filter((p) => {
        if (!searchFilter) return true;
        const q = searchFilter.toLowerCase();
        return p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
    });

    const categories = [...new Set(pages.map((p) => p.category))].sort();

    // ========================================================================
    // Render helpers
    // ========================================================================

    const formatRelativeTime = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return "just now";
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 30) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const categoryColor = (cat: string) => {
        const colors: Record<string, string> = {
            infrastructure: "bg-blue-100 text-blue-700",
            "ai-ml": "bg-purple-100 text-purple-700",
            devops: "bg-green-100 text-green-700",
            business: "bg-amber-100 text-amber-700",
            security: "bg-red-100 text-red-700",
            uncategorized: "bg-slate-100 text-slate-600",
        };
        return colors[cat] || "bg-slate-100 text-slate-600";
    };

    // ========================================================================
    // JSX
    // ========================================================================

    return (
        <div className="min-h-screen bg-slate-50/30">
            <Toaster position="bottom-right" />

            {/* Header */}
            <div className="border-b bg-white px-8 py-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                            <Library className="h-6 w-6" />
                            Knowledgebase
                        </h1>
                        <p className="text-sm text-slate-500 mt-1">
                            Import articles, notes, and reference material so DraftFlow can ground better LinkedIn posts.
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {stats && (
                            <div className="flex items-center gap-4 text-sm text-slate-500 mr-4">
                                <span className="flex items-center gap-1">
                                    <FileText className="h-4 w-4" />
                                    {stats.pageCount} pages
                                </span>
                                <span className="flex items-center gap-1">
                                    <BarChart3 className="h-4 w-4" />
                                    {stats.sourcesIngested} ingested
                                </span>
                            </div>
                        )}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowSearchModal(true)}
                        >
                            <Search className="h-4 w-4 mr-1" />
                            Search Knowledgebase
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                setShowIngestModal(true);
                                setIngestResult(null);
                                setIngestContent("");
                                setIngestTitle("");
                            }}
                        >
                            <Download className="h-4 w-4 mr-1" />
                            Ingest Source
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => {
                                setShowNewPageModal(true);
                                setNewPageTitle("");
                                setNewPageCategory("");
                                setNewPageContent("");
                            }}
                        >
                            <Plus className="h-4 w-4 mr-1" />
                            New Page
                        </Button>
                    </div>
                </div>
            </div>

            <div className="border-b bg-sky-50/70 px-8 py-4">
                <div className="grid gap-3 text-sm text-slate-700 md:grid-cols-3">
                    <div>
                        <p className="font-medium text-slate-900">Import sources</p>
                        <p>Use <span className="font-medium">Ingest Source</span> for URLs, article text, research notes, customer insights, or saved feed items.</p>
                    </div>
                    <div>
                        <p className="font-medium text-slate-900">Let AI organize</p>
                        <p>DraftFlow extracts durable knowledge and creates or updates pages with source links for later reference.</p>
                    </div>
                    <div>
                        <p className="font-medium text-slate-900">Use it while writing</p>
                        <p>The writing assistant can search this knowledgebase before web search to add relevant proof and context.</p>
                    </div>
                </div>
            </div>

            {/* Main content: two-column layout */}
            <div className="flex h-[calc(100vh-220px)]">
                {/* Left: Page list */}
                <div className="w-80 border-r bg-white overflow-y-auto flex-shrink-0">
                    <div className="p-4 border-b">
                        <Input
                            placeholder="Filter pages..."
                            value={searchFilter}
                            onChange={(e) => setSearchFilter(e.target.value)}
                            className="h-9"
                        />
                    </div>

                    {loading ? (
                        <div className="p-8 text-center text-slate-400">
                            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                            Loading...
                        </div>
                    ) : filteredPages.length === 0 ? (
                        <div className="p-8 text-center text-slate-400">
                            <Library className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p className="text-sm">No knowledgebase pages yet</p>
                            <p className="text-xs mt-1">Ingest a source or create a page</p>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {filteredPages.map((page) => (
                                <button
                                    key={page.slug}
                                    onClick={() => loadPage(page.slug)}
                                    className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${
                                        selectedPage?.slug === page.slug ? "bg-slate-100" : ""
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-900 truncate">
                                                {page.title}
                                            </p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span
                                                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${categoryColor(
                                                        page.category
                                                    )}`}
                                                >
                                                    {page.category}
                                                </span>
                                                <span className="text-[10px] text-slate-400">
                                                    {formatRelativeTime(page.lastModified)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Activity log toggle */}
                    {pages.length > 0 && (
                        <div className="border-t">
                            <button
                                onClick={() => {
                                    setShowLog(!showLog);
                                    if (!showLog) fetchLog();
                                }}
                                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-slate-500 hover:bg-slate-50"
                            >
                                {showLog ? (
                                    <ChevronDown className="h-4 w-4" />
                                ) : (
                                    <ChevronRight className="h-4 w-4" />
                                )}
                                <Clock className="h-4 w-4" />
                                Activity Log
                            </button>
                            {showLog && (
                                <div className="px-4 pb-3 max-h-48 overflow-y-auto">
                                    {logEntries.length === 0 ? (
                                        <p className="text-xs text-slate-400">No activity yet</p>
                                    ) : (
                                        logEntries.map((entry, i) => (
                                            <p key={i} className="text-[11px] text-slate-500 py-0.5">
                                                {entry.replace(/^- /, "")}
                                            </p>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right: Page content */}
                <div className="flex-1 overflow-y-auto">
                    {pageLoading ? (
                        <div className="p-12 text-center text-slate-400">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                            Loading page...
                        </div>
                    ) : selectedPage ? (
                        <div className="max-w-3xl mx-auto p-8">
                            {/* Page header */}
                            <div className="flex items-start justify-between mb-6">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900">
                                        {selectedPage.title}
                                    </h2>
                                    <div className="flex items-center gap-3 mt-2">
                                        <span
                                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColor(
                                                selectedPage.category
                                            )}`}
                                        >
                                            {selectedPage.category}
                                        </span>
                                        <span className="text-xs text-slate-400">
                                            Last modified: {formatRelativeTime(selectedPage.lastModified)}
                                        </span>
                                        {selectedPage.sources.length > 0 && (
                                            <span className="text-xs text-slate-400 flex items-center gap-1">
                                                <LinkIcon className="h-3 w-3" />
                                                {selectedPage.sources.length} source(s)
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {isEditing ? (
                                        <>
                                            <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                                                Cancel
                                            </Button>
                                            <Button size="sm" onClick={savePage}>
                                                Save
                                            </Button>
                                        </>
                                    ) : (
                                        <>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                    setIsEditing(true);
                                                    setEditContent(selectedPage.content);
                                                }}
                                            >
                                                <Pencil className="h-3.5 w-3.5 mr-1" />
                                                Edit
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => deletePage(selectedPage.slug)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Page content */}
                            {isEditing ? (
                                <Textarea
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    className="min-h-[500px] font-mono text-sm"
                                    placeholder="Write markdown content..."
                                />
                            ) : (
                                <div className="prose prose-slate prose-sm max-w-none">
                                    <ReactMarkdown>{selectedPage.content}</ReactMarkdown>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-400">
                            <div className="text-center">
                                <Library className="h-12 w-12 mx-auto mb-3 opacity-30" />
                                <p className="text-sm">Select a page or ingest a new source</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ================================================================ */}
            {/* New Page Modal */}
            {/* ================================================================ */}
            {showNewPageModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b">
                            <h3 className="text-lg font-semibold">New Knowledgebase Page</h3>
                            <button onClick={() => setShowNewPageModal(false)}>
                                <X className="h-5 w-5 text-slate-400" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <Label>Title / Topic</Label>
                                <div className="flex gap-2">
                                    <Input
                                        value={newPageTitle}
                                        onChange={(e) => setNewPageTitle(e.target.value)}
                                        placeholder="e.g., Kubernetes Scaling Strategies"
                                        className="flex-1"
                                        onKeyDown={(e) => e.key === "Enter" && !generatingPage && generatePageContent()}
                                    />
                                    <Button
                                        variant="outline"
                                        onClick={generatePageContent}
                                        disabled={generatingPage || !newPageTitle.trim()}
                                    >
                                        {generatingPage ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <>
                                                <Sparkles className="h-4 w-4 mr-1" />
                                                Generate
                                            </>
                                        )}
                                    </Button>
                                </div>
                                <p className="text-[11px] text-slate-400 mt-1">
                                    Enter a topic and click Generate, or write content manually below
                                </p>
                            </div>
                            <div>
                                <Label>Category</Label>
                                <Input
                                    value={newPageCategory}
                                    onChange={(e) => setNewPageCategory(e.target.value)}
                                    placeholder="Auto-filled by AI, or type manually"
                                />
                            </div>
                            <div>
                                <Label>Content (Markdown)</Label>
                                <Textarea
                                    value={newPageContent}
                                    onChange={(e) => setNewPageContent(e.target.value)}
                                    placeholder={generatingPage ? "Generating content..." : "# Page Title\n\nWrite content here, or use Generate above..."}
                                    className="min-h-[250px] font-mono text-sm"
                                    disabled={generatingPage}
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 p-6 border-t">
                            <Button variant="outline" onClick={() => setShowNewPageModal(false)}>
                                Cancel
                            </Button>
                            <Button onClick={createPage} disabled={!newPageTitle.trim() || !newPageContent.trim()}>
                                Create Page
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ================================================================ */}
            {/* Ingest Modal */}
            {/* ================================================================ */}
            {showIngestModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b">
                            <h3 className="text-lg font-semibold">Ingest Source</h3>
                            <button onClick={() => setShowIngestModal(false)}>
                                <X className="h-5 w-5 text-slate-400" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="rounded-lg border border-sky-100 bg-sky-50 p-3 text-sm text-slate-700">
                                <p className="font-medium text-slate-900">Import data into your knowledgebase</p>
                                <p className="mt-1">
                                    Add a public URL or paste raw notes, article excerpts, customer conversations, research summaries, or internal docs. The AI extracts reusable facts, patterns, and source links into organized pages.
                                </p>
                            </div>

                            {/* Source type toggle */}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setIngestType("url"); setIngestContent(""); }}
                                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                                        ingestType === "url"
                                            ? "bg-slate-900 text-white border-slate-900"
                                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                    }`}
                                >
                                    <Globe className="h-4 w-4" />
                                    URL
                                </button>
                                <button
                                    onClick={() => { setIngestType("text"); setIngestContent(""); }}
                                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                                        ingestType === "text"
                                            ? "bg-slate-900 text-white border-slate-900"
                                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                    }`}
                                >
                                    <Type className="h-4 w-4" />
                                    Paste Text
                                </button>
                            </div>

                            <div>
                                <Label>Title (optional)</Label>
                                <Input
                                    value={ingestTitle}
                                    onChange={(e) => setIngestTitle(e.target.value)}
                                    placeholder="Source title for reference"
                                />
                            </div>

                            <div>
                                <Label>{ingestType === "url" ? "URL" : "Content"}</Label>
                                {ingestType === "url" ? (
                                    <Input
                                        value={ingestContent}
                                        onChange={(e) => setIngestContent(e.target.value)}
                                        placeholder="https://example.com/article-or-report"
                                        type="url"
                                    />
                                ) : (
                                    <Textarea
                                        value={ingestContent}
                                        onChange={(e) => setIngestContent(e.target.value)}
                                        placeholder="Paste article text, notes, customer insights, research summaries, or reusable context..."
                                        className="min-h-[200px] text-sm"
                                    />
                                )}
                            </div>

                            {/* Results */}
                            {ingestResult && (
                                <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                                    <p className="text-sm font-medium text-green-800 mb-2">
                                        {ingestResult.length} page(s) affected:
                                    </p>
                                    {ingestResult.map((r, i) => (
                                        <div key={i} className="flex items-center gap-2 text-sm text-green-700">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                                                r.action === "create" ? "bg-green-200" : "bg-blue-200 text-blue-700"
                                            }`}>
                                                {r.action}
                                            </span>
                                            <button
                                                onClick={() => {
                                                    setShowIngestModal(false);
                                                    loadPage(r.slug);
                                                }}
                                                className="hover:underline"
                                            >
                                                {r.title}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex justify-end gap-3 p-6 border-t">
                            <Button variant="outline" onClick={() => setShowIngestModal(false)}>
                                {ingestResult ? "Done" : "Cancel"}
                            </Button>
                            {!ingestResult && (
                                <Button onClick={handleIngest} disabled={ingesting}>
                                    {ingesting ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            <Download className="h-4 w-4 mr-1" />
                                            Ingest
                                        </>
                                    )}
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ================================================================ */}
            {/* Search Modal */}
            {/* ================================================================ */}
            {showSearchModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b">
                            <h3 className="text-lg font-semibold">Search Knowledgebase</h3>
                            <button onClick={() => setShowSearchModal(false)}>
                                <X className="h-5 w-5 text-slate-400" />
                            </button>
                        </div>
                        <div className="p-6">
                            <div className="flex gap-2 mb-4">
                                <Input
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="Search for topics, keywords..."
                                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                                />
                                <Button onClick={handleSearch} disabled={searching}>
                                    {searching ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Search className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>

                            {searchResults.length > 0 ? (
                                <div className="space-y-3">
                                    {searchResults.map((result) => (
                                        <button
                                            key={result.slug}
                                            onClick={() => {
                                                setShowSearchModal(false);
                                                loadPage(result.slug);
                                            }}
                                            className="w-full text-left p-4 rounded-lg border hover:bg-slate-50 transition-colors"
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-medium text-sm text-slate-900">
                                                    {result.title}
                                                </span>
                                                <span className="text-[10px] text-slate-400">
                                                    score: {result.relevanceScore}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 line-clamp-3">
                                                {result.excerpt}
                                            </p>
                                        </button>
                                    ))}
                                </div>
                            ) : searchQuery && !searching ? (
                                <p className="text-sm text-slate-400 text-center py-8">
                                    No results found for &ldquo;{searchQuery}&rdquo;
                                </p>
                            ) : null}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
