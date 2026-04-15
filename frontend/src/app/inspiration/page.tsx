"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import toast, { Toaster } from "react-hot-toast";
import {
    Sparkles,
    Rss,
    FileText,
    Library,
    Star,
    StarOff,
    Copy,
    ArrowRight,
    Search,
    Heart,
    ThumbsUp,
    MessageSquare,
    Repeat2,
    Eye,
    Bookmark,
    BookmarkMinus,
} from "lucide-react";

interface InspirationItem {
    id: string;
    source: "bookmark" | "post" | "wiki";
    title: string;
    content: string;
    date: string;
    engagement?: {
        likes: number;
        comments: number;
        reposts: number;
        impressions: number;
    };
    meta?: {
        feedName?: string;
        author?: string;
        link?: string;
        slug?: string;
        category?: string;
    };
}

type TabKey = "all" | "bookmarks" | "posts" | "frameworks";

export default function InspirationPage() {
    const router = useRouter();
    const [items, setItems] = useState<InspirationItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabKey>("all");
    const [searchQuery, setSearchQuery] = useState("");

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [bookmarksRes, postsRes, wikiRes] = await Promise.allSettled([
                api.get("/feeds/items", { params: { bookmarked: "true", limit: 100 } }),
                api.get("/posts", { params: { favorited: "true" } }),
                api.get("/wiki/pages"),
            ]);

            const merged: InspirationItem[] = [];

            // Bookmarked RSS items
            if (bookmarksRes.status === "fulfilled") {
                const rssItems = bookmarksRes.value.data.items || bookmarksRes.value.data || [];
                for (const item of rssItems) {
                    merged.push({
                        id: `rss-${item.id}`,
                        source: "bookmark",
                        title: item.title || "Untitled",
                        content: item.description || item.content || "",
                        date: item.pubDate || item.createdAt,
                        meta: {
                            feedName: item.feed?.title || item.feedTitle,
                            author: item.author,
                            link: item.link,
                        },
                    });
                }
            }

            // Favorited posts
            if (postsRes.status === "fulfilled") {
                const posts = postsRes.value.data || [];
                for (const post of posts) {
                    merged.push({
                        id: `post-${post.id}`,
                        source: "post",
                        title: post.content?.substring(0, 80) + (post.content?.length > 80 ? "..." : ""),
                        content: post.content || "",
                        date: post.createdAt,
                        engagement: {
                            likes: post.likesCount || 0,
                            comments: post.commentsCount || 0,
                            reposts: post.repostsCount || 0,
                            impressions: post.impressionsCount || 0,
                        },
                    });
                }
            }

            // Wiki framework pages
            if (wikiRes.status === "fulfilled") {
                const pages = wikiRes.value.data.pages || wikiRes.value.data || [];
                for (const page of pages) {
                    merged.push({
                        id: `wiki-${page.slug}`,
                        source: "wiki",
                        title: page.title || page.slug,
                        content: page.content || "",
                        date: page.lastModified || page.lastIngested || "",
                        meta: {
                            slug: page.slug,
                            category: page.category,
                        },
                    });
                }
            }

            // Sort by date (newest first)
            merged.sort((a, b) => {
                const da = a.date ? new Date(a.date).getTime() : 0;
                const db = b.date ? new Date(b.date).getTime() : 0;
                return db - da;
            });

            setItems(merged);
        } catch (err) {
            console.error("Failed to fetch inspiration:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    const filtered = items.filter((item) => {
        // Tab filter
        if (activeTab === "bookmarks" && item.source !== "bookmark") return false;
        if (activeTab === "posts" && item.source !== "post") return false;
        if (activeTab === "frameworks" && item.source !== "wiki") return false;

        // Search filter
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            return (
                item.title.toLowerCase().includes(q) ||
                item.content.toLowerCase().includes(q)
            );
        }
        return true;
    });

    const handleCreatePost = (item: InspirationItem) => {
        localStorage.setItem("draftPostContent", item.content);
        localStorage.setItem("draftPostSource", "inspiration");
        router.push("/create?source=inspiration");
    };

    const handleCopy = async (item: InspirationItem) => {
        try {
            await navigator.clipboard.writeText(item.content);
            toast.success("Copied to clipboard");
        } catch {
            toast.error("Failed to copy");
        }
    };

    const handleRemove = async (item: InspirationItem) => {
        try {
            if (item.source === "bookmark") {
                const rssId = item.id.replace("rss-", "");
                await api.put(`/feeds/items/${rssId}/bookmark`);
                toast.success("Bookmark removed");
            } else if (item.source === "post") {
                const postId = item.id.replace("post-", "");
                await api.put(`/posts/${postId}/favorite`);
                toast.success("Unfavorited");
            }
            setItems((prev) => prev.filter((i) => i.id !== item.id));
        } catch {
            toast.error("Failed to remove");
        }
    };

    const sourceIcon = (source: string) => {
        switch (source) {
            case "bookmark": return <Rss className="h-3.5 w-3.5" />;
            case "post": return <FileText className="h-3.5 w-3.5" />;
            case "wiki": return <Library className="h-3.5 w-3.5" />;
            default: return null;
        }
    };

    const sourceBadge = (source: string) => {
        const styles: Record<string, string> = {
            bookmark: "bg-orange-50 text-orange-700 border-orange-200",
            post: "bg-blue-50 text-blue-700 border-blue-200",
            wiki: "bg-purple-50 text-purple-700 border-purple-200",
        };
        const labels: Record<string, string> = {
            bookmark: "RSS Bookmark",
            post: "My Post",
            wiki: "Wiki",
        };
        return (
            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${styles[source] || ""}`}>
                {sourceIcon(source)}
                {labels[source] || source}
            </span>
        );
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        const now = new Date();
        const diff = now.getTime() - d.getTime();
        const hours = Math.floor(diff / 3600000);
        if (hours < 1) return "just now";
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 30) return `${days}d ago`;
        return d.toLocaleDateString();
    };

    const tabs: { key: TabKey; label: string; count: number }[] = [
        { key: "all", label: "All", count: items.length },
        { key: "bookmarks", label: "Bookmarks", count: items.filter((i) => i.source === "bookmark").length },
        { key: "posts", label: "My Best Posts", count: items.filter((i) => i.source === "post").length },
        { key: "frameworks", label: "Wiki", count: items.filter((i) => i.source === "wiki").length },
    ];

    return (
        <div className="min-h-screen bg-slate-50">
            <Toaster position="top-right" />

            {/* Header */}
            <div className="border-b bg-white px-8 py-6">
                <div className="flex items-center gap-3">
                    <Sparkles className="h-6 w-6 text-amber-500" />
                    <h1 className="text-2xl font-bold text-slate-900">Inspiration</h1>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                    Your curated swipe file — bookmarked articles, top posts, and wiki knowledge in one place.
                </p>
            </div>

            <div className="mx-auto max-w-4xl px-8 py-6">
                {/* Tabs */}
                <div className="flex items-center gap-2 mb-4">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                                activeTab === tab.key
                                    ? "bg-slate-900 text-white"
                                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                            }`}
                        >
                            {tab.label}
                            <span className={`ml-1.5 text-xs ${activeTab === tab.key ? "text-slate-300" : "text-slate-400"}`}>
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Search */}
                <div className="relative mb-6">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search inspiration..."
                        className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </div>

                {/* Loading */}
                {loading && (
                    <div className="flex items-center justify-center py-16">
                        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                    </div>
                )}

                {/* Empty state */}
                {!loading && filtered.length === 0 && (
                    <div className="rounded-xl border bg-white p-12 text-center">
                        <Sparkles className="mx-auto h-10 w-10 text-slate-300" />
                        <h3 className="mt-4 text-sm font-semibold text-slate-900">No inspiration yet</h3>
                        <p className="mt-1 text-xs text-slate-500">
                            {activeTab === "bookmarks"
                                ? "Bookmark RSS articles from the Feeds page to see them here."
                                : activeTab === "posts"
                                ? "Favorite your published posts to save them as inspiration."
                                : activeTab === "frameworks"
                                ? "Add framework pages to your LLM Wiki."
                                : "Bookmark articles, favorite posts, or add wiki pages to build your swipe file."}
                        </p>
                    </div>
                )}

                {/* Items */}
                {!loading && filtered.length > 0 && (
                    <div className="space-y-3">
                        {filtered.map((item) => (
                            <div
                                key={item.id}
                                className="rounded-xl border bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                            >
                                {/* Top row: source badge + date */}
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        {sourceBadge(item.source)}
                                        {item.meta?.feedName && (
                                            <span className="text-xs text-slate-400">{item.meta.feedName}</span>
                                        )}
                                        {item.meta?.category && (
                                            <span className="text-xs text-slate-400">{item.meta.category}</span>
                                        )}
                                    </div>
                                    <span className="text-xs text-slate-400">{formatDate(item.date)}</span>
                                </div>

                                {/* Title / Content */}
                                <h3 className="text-sm font-semibold text-slate-900 line-clamp-2 mb-1">
                                    {item.title}
                                </h3>
                                <p className="text-xs text-slate-500 line-clamp-3 mb-3">
                                    {item.content.replace(/[#*_\[\]]/g, "").substring(0, 300)}
                                </p>

                                {/* Engagement metrics (for posts) */}
                                {item.engagement && (
                                    <div className="flex items-center gap-4 mb-3 text-xs text-slate-400">
                                        <span className="flex items-center gap-1">
                                            <ThumbsUp className="h-3 w-3" />
                                            {item.engagement.likes}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <MessageSquare className="h-3 w-3" />
                                            {item.engagement.comments}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Repeat2 className="h-3 w-3" />
                                            {item.engagement.reposts}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Eye className="h-3 w-3" />
                                            {item.engagement.impressions}
                                        </span>
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleCreatePost(item)}
                                        className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                                    >
                                        Create Post
                                        <ArrowRight className="h-3 w-3" />
                                    </button>
                                    <button
                                        onClick={() => handleCopy(item)}
                                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                                    >
                                        <Copy className="h-3 w-3" />
                                        Copy
                                    </button>
                                    {item.meta?.link && (
                                        <a
                                            href={item.meta.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                                        >
                                            Open
                                        </a>
                                    )}
                                    {item.source !== "wiki" && (
                                        <button
                                            onClick={() => handleRemove(item)}
                                            className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-400 hover:bg-red-50 hover:text-red-600"
                                        >
                                            {item.source === "bookmark" ? (
                                                <BookmarkMinus className="h-3 w-3" />
                                            ) : (
                                                <StarOff className="h-3 w-3" />
                                            )}
                                            Remove
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
