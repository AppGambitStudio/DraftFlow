"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import toast, { Toaster } from "react-hot-toast";
import {
    Rss,
    Loader2,
    Plus,
    RefreshCw,
    Trash2,
    ExternalLink,
    Bookmark,
    BookmarkCheck,
    PenSquare,
    ChevronDown,
    ChevronUp,
    Pause,
    Play,
    AlertCircle,
    CheckCheck,
    Search,
    X,
} from "lucide-react";

interface Feed {
    id: number;
    url: string;
    title: string | null;
    description: string | null;
    siteUrl: string | null;
    imageUrl: string | null;
    status: string;
    lastFetchedAt: string | null;
    lastError: string | null;
    totalItems: number;
    unreadItems: number;
}

interface FeedItem {
    id: number;
    feedId: number;
    title: string;
    description: string | null;
    content: string | null;
    link: string | null;
    author: string | null;
    pubDate: string | null;
    imageUrl: string | null;
    categories: string[];
    isBookmarked: boolean;
    isRead: boolean;
    isUsed: boolean;
    usedForPostId: number | null;
    feed?: { id: number; title: string; siteUrl: string | null; imageUrl: string | null };
}

export default function FeedsPage() {
    const router = useRouter();
    const [feeds, setFeeds] = useState<Feed[]>([]);
    const [items, setItems] = useState<FeedItem[]>([]);
    const [feedUrl, setFeedUrl] = useState("");
    const [addingFeed, setAddingFeed] = useState(false);
    const [loadingFeeds, setLoadingFeeds] = useState(true);
    const [loadingItems, setLoadingItems] = useState(false);
    const [refreshingAll, setRefreshingAll] = useState(false);
    const [refreshingId, setRefreshingId] = useState<number | null>(null);
    const [selectedFeedId, setSelectedFeedId] = useState<string | "all" | "bookmarked">("all");
    const [showFeedManager, setShowFeedManager] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [itemsTotal, setItemsTotal] = useState(0);
    const [itemsOffset, setItemsOffset] = useState(0);
    const ITEMS_PER_PAGE = 20;

    useEffect(() => {
        loadFeeds();
    }, []);

    // Debounce search input
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchQuery);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    useEffect(() => {
        loadItems(0);
    }, [selectedFeedId, debouncedSearch]);

    const loadFeeds = async () => {
        try {
            const res = await api.get("/feeds");
            setFeeds(res.data);
        } catch (error) {
            console.error("Failed to load feeds:", error);
        } finally {
            setLoadingFeeds(false);
        }
    };

    const loadItems = async (offset: number) => {
        setLoadingItems(true);
        try {
            const params: any = { limit: ITEMS_PER_PAGE, offset };
            if (selectedFeedId === "bookmarked") {
                params.bookmarked = "true";
            } else if (selectedFeedId !== "all") {
                params.feedId = selectedFeedId;
            }
            if (debouncedSearch) {
                params.search = debouncedSearch;
            }

            const res = await api.get("/feeds/items", { params });
            if (offset === 0) {
                setItems(res.data.items);
            } else {
                setItems((prev) => [...prev, ...res.data.items]);
            }
            setItemsTotal(res.data.total);
            setItemsOffset(offset);
        } catch (error) {
            console.error("Failed to load items:", error);
        } finally {
            setLoadingItems(false);
        }
    };

    const handleAddFeed = async () => {
        if (!feedUrl.trim()) return;
        setAddingFeed(true);
        try {
            await api.post("/feeds", { url: feedUrl.trim() });
            setFeedUrl("");
            toast.success("Feed added!");
            loadFeeds();
            loadItems(0);
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to add feed");
        } finally {
            setAddingFeed(false);
        }
    };

    const handleRefreshFeed = async (id: number) => {
        setRefreshingId(id);
        try {
            const res = await api.post(`/feeds/${id}/refresh`);
            toast.success(`${res.data.newItems} new items`);
            loadFeeds();
            loadItems(0);
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to refresh");
        } finally {
            setRefreshingId(null);
        }
    };

    const handleRefreshAll = async () => {
        setRefreshingAll(true);
        try {
            const res = await api.post("/feeds/refresh-all");
            toast.success(`Refreshed ${res.data.refreshed} feeds — ${res.data.newItems} new items`);
            loadFeeds();
            loadItems(0);
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to refresh");
        } finally {
            setRefreshingAll(false);
        }
    };

    const handleDeleteFeed = async (id: number) => {
        try {
            await api.delete(`/feeds/${id}`);
            setFeeds((prev) => prev.filter((f) => f.id !== id));
            toast.success("Feed removed");
            if (selectedFeedId === String(id)) setSelectedFeedId("all");
            loadItems(0);
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to delete");
        }
    };

    const handleToggleFeed = async (id: number, currentStatus: string) => {
        const newStatus = currentStatus === "ACTIVE" ? "PAUSED" : "ACTIVE";
        try {
            await api.put(`/feeds/${id}`, { status: newStatus });
            setFeeds((prev) => prev.map((f) => (f.id === id ? { ...f, status: newStatus } : f)));
            toast.success(newStatus === "ACTIVE" ? "Feed resumed" : "Feed paused");
        } catch (error: any) {
            toast.error("Failed to update feed");
        }
    };

    const handleToggleBookmark = async (itemId: number) => {
        try {
            const res = await api.put(`/feeds/items/${itemId}/bookmark`);
            setItems((prev) =>
                prev.map((item) =>
                    item.id === itemId ? { ...item, isBookmarked: res.data.isBookmarked } : item
                )
            );
        } catch (error: any) {
            toast.error("Failed to bookmark");
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await api.put("/feeds/items/mark-read", { ids: [] });
            setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
            loadFeeds(); // refresh unread counts
            toast.success("All marked as read");
        } catch (error: any) {
            toast.error("Failed to mark as read");
        }
    };

    const markItemUsed = async (itemId: number) => {
        try {
            await api.put(`/feeds/items/${itemId}/mark-used`);
            setItems((prev) =>
                prev.map((i) => (i.id === itemId ? { ...i, isUsed: true, isRead: true } : i))
            );
        } catch (error) {
            // non-blocking — still navigate
        }
    };

    const handleUseForPost = async (item: FeedItem) => {
        await markItemUsed(item.id);
        const context = {
            title: item.title,
            description: item.description || "",
            link: item.link || "",
            author: item.author || "",
            source: item.feed?.title || "",
        };
        localStorage.setItem("feedItemForPost", JSON.stringify(context));
        router.push("/create?fromFeed=true");
    };

    const handleUseForIdea = async (item: FeedItem) => {
        await markItemUsed(item.id);
        const ideaData = {
            title: item.title,
            description: item.description || "",
            sourceLinks: item.link ? [item.link] : [],
        };
        localStorage.setItem("feedItemForIdea", JSON.stringify(ideaData));
        router.push("/ideas?fromFeed=true");
    };

    const formatDate = (dateStr: string | null) => {
        if (!dateStr) return "";
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffHours < 1) return "just now";
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };

    const totalUnread = feeds.reduce((sum, f) => sum + f.unreadItems, 0);

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <Toaster position="top-right" />
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <Rss className="h-7 w-7 text-slate-700" />
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">RSS Feeds</h1>
                            <p className="text-sm text-slate-500">
                                {feeds.length} feed{feeds.length !== 1 ? "s" : ""} · {totalUnread} unread
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleMarkAllRead}
                            disabled={totalUnread === 0}
                        >
                            <CheckCheck className="h-4 w-4 mr-1.5" />
                            Mark All Read
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRefreshAll}
                            disabled={refreshingAll}
                        >
                            <RefreshCw className={`h-4 w-4 mr-1.5 ${refreshingAll ? "animate-spin" : ""}`} />
                            Refresh All
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => setShowFeedManager(!showFeedManager)}
                        >
                            {showFeedManager ? "Hide" : "Manage Feeds"}
                        </Button>
                    </div>
                </div>

                {/* Feed Manager Panel */}
                {showFeedManager && (
                    <Card className="mb-6">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Manage Feeds</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Add feed */}
                            <div className="flex gap-2">
                                <Input
                                    value={feedUrl}
                                    onChange={(e) => setFeedUrl(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleAddFeed()}
                                    placeholder="Paste RSS feed URL..."
                                    className="flex-1"
                                />
                                <Button onClick={handleAddFeed} disabled={addingFeed || !feedUrl.trim()}>
                                    {addingFeed ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Plus className="h-4 w-4 mr-1" />
                                    )}
                                    Add Feed
                                </Button>
                            </div>

                            {/* Feed list */}
                            {feeds.length === 0 ? (
                                <p className="text-sm text-slate-400 text-center py-4">
                                    No feeds yet. Add an RSS feed URL above.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {feeds.map((feed) => (
                                        <div
                                            key={feed.id}
                                            className="flex items-center justify-between p-3 border rounded-lg bg-white"
                                        >
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-sm text-slate-700 truncate">
                                                        {feed.title || feed.url}
                                                    </span>
                                                    {feed.status === "ERROR" && (
                                                        <span title={feed.lastError || "Error"}>
                                                            <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                                                        </span>
                                                    )}
                                                    {feed.status === "PAUSED" && (
                                                        <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded">
                                                            Paused
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-slate-400 mt-0.5">
                                                    {feed.totalItems} items · {feed.unreadItems} unread
                                                    {feed.lastFetchedAt && ` · Updated ${formatDate(feed.lastFetchedAt)}`}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 ml-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0"
                                                    onClick={() => handleToggleFeed(feed.id, feed.status)}
                                                    title={feed.status === "ACTIVE" ? "Pause" : "Resume"}
                                                >
                                                    {feed.status === "ACTIVE" ? (
                                                        <Pause className="h-3.5 w-3.5" />
                                                    ) : (
                                                        <Play className="h-3.5 w-3.5" />
                                                    )}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0"
                                                    onClick={() => handleRefreshFeed(feed.id)}
                                                    disabled={refreshingId === feed.id}
                                                >
                                                    <RefreshCw className={`h-3.5 w-3.5 ${refreshingId === feed.id ? "animate-spin" : ""}`} />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                                    onClick={() => handleDeleteFeed(feed.id)}
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Search bar */}
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search articles by keyword..."
                        className="pl-9 pr-9"
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>

                {/* Filter tabs */}
                <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
                    <button
                        onClick={() => setSelectedFeedId("all")}
                        className={`px-3 py-1.5 text-sm rounded-full border whitespace-nowrap transition-colors ${
                            selectedFeedId === "all"
                                ? "bg-slate-900 text-white border-slate-900"
                                : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                        }`}
                    >
                        All Feeds
                    </button>
                    <button
                        onClick={() => setSelectedFeedId("bookmarked")}
                        className={`px-3 py-1.5 text-sm rounded-full border whitespace-nowrap transition-colors ${
                            selectedFeedId === "bookmarked"
                                ? "bg-slate-900 text-white border-slate-900"
                                : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                        }`}
                    >
                        <span className="flex items-center gap-1">
                            <BookmarkCheck className="h-3.5 w-3.5" />
                            Bookmarked
                        </span>
                    </button>
                    {feeds.map((feed) => (
                        <button
                            key={feed.id}
                            onClick={() => setSelectedFeedId(String(feed.id))}
                            className={`px-3 py-1.5 text-sm rounded-full border whitespace-nowrap transition-colors ${
                                selectedFeedId === String(feed.id)
                                    ? "bg-slate-900 text-white border-slate-900"
                                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                            }`}
                        >
                            {feed.title || "Untitled"}
                            {feed.unreadItems > 0 && (
                                <span className="ml-1.5 text-xs opacity-70">({feed.unreadItems})</span>
                            )}
                        </button>
                    ))}
                </div>

                {/* Items list */}
                {loadingItems && items.length === 0 ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                    </div>
                ) : items.length === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-16 text-slate-400">
                            <Rss className="h-12 w-12 mb-3 opacity-30" />
                            <p className="text-sm">
                                {feeds.length === 0
                                    ? 'Add RSS feeds to start reading articles'
                                    : 'No items found'}
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-3">
                        {items.map((item) => (
                            <Card
                                key={item.id}
                                className={`transition-colors ${!item.isRead ? "border-l-4 border-l-blue-400" : ""}`}
                            >
                                <CardContent className="p-4">
                                    <div className="flex gap-4">
                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <a
                                                            href={item.link || "#"}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className={`font-medium text-sm hover:text-blue-600 transition-colors line-clamp-2 ${item.isUsed ? "text-slate-400" : "text-slate-900"}`}
                                                        >
                                                            {item.title}
                                                        </a>
                                                        {item.isUsed && (
                                                            <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">
                                                                Used
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-400">
                                                        {item.feed?.title && (
                                                            <span className="font-medium text-slate-500">
                                                                {item.feed.title}
                                                            </span>
                                                        )}
                                                        {item.author && <span>by {item.author}</span>}
                                                        {item.pubDate && (
                                                            <span>{formatDate(item.pubDate)}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {item.description && (
                                                <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                                                    {item.description}
                                                </p>
                                            )}

                                            {/* Categories */}
                                            {item.categories.length > 0 && (
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {item.categories.slice(0, 4).map((cat, i) => (
                                                        <span
                                                            key={i}
                                                            className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500"
                                                        >
                                                            {cat}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Actions */}
                                            <div className="flex items-center gap-1 mt-3">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 text-xs"
                                                    onClick={() => handleToggleBookmark(item.id)}
                                                >
                                                    {item.isBookmarked ? (
                                                        <BookmarkCheck className="h-3.5 w-3.5 mr-1 text-blue-500" />
                                                    ) : (
                                                        <Bookmark className="h-3.5 w-3.5 mr-1" />
                                                    )}
                                                    {item.isBookmarked ? "Saved" : "Save"}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 text-xs"
                                                    onClick={() => handleUseForPost(item)}
                                                >
                                                    <PenSquare className="h-3.5 w-3.5 mr-1" />
                                                    Create Post
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-7 text-xs"
                                                    onClick={() => handleUseForIdea(item)}
                                                >
                                                    <Plus className="h-3.5 w-3.5 mr-1" />
                                                    Save as Idea
                                                </Button>
                                                {item.link && (
                                                    <a
                                                        href={item.link}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                                                    >
                                                        <ExternalLink className="h-3 w-3" />
                                                        Open
                                                    </a>
                                                )}
                                            </div>
                                        </div>

                                        {/* Thumbnail */}
                                        {item.imageUrl && (
                                            <div className="flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-slate-100">
                                                <img
                                                    src={item.imageUrl}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).style.display = "none";
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}

                        {/* Load more */}
                        {items.length < itemsTotal && (
                            <div className="flex justify-center py-4">
                                <Button
                                    variant="outline"
                                    onClick={() => loadItems(itemsOffset + ITEMS_PER_PAGE)}
                                    disabled={loadingItems}
                                >
                                    {loadingItems ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <ChevronDown className="h-4 w-4 mr-2" />
                                    )}
                                    Load More ({itemsTotal - items.length} remaining)
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
