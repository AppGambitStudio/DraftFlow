"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import toast, { Toaster } from "react-hot-toast";
import {
    TrendingUp,
    Sparkles,
    Loader2,
    Lightbulb,
    ArrowRight,
    Flame,
    Zap,
    Target,
    RefreshCw,
    PenSquare,
} from "lucide-react";

interface TrendingTopic {
    id?: number;
    topic: string;
    description: string;
    relevance: string;
    suggestedAngles: string[];
    trendType: string;
    industry?: string;
    fetchedAt?: string;
}

export default function TrendsPage() {
    const router = useRouter();
    const [industry, setIndustry] = useState("");
    const [topics, setTopics] = useState<TrendingTopic[]>([]);
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null);
    const [totalCount, setTotalCount] = useState(0);

    // Load saved trends on mount
    useEffect(() => {
        const loadSavedTrends = async () => {
            try {
                const res = await api.get("/ai/saved-trends");
                if (res.data.topics && res.data.topics.length > 0) {
                    setTopics(res.data.topics);
                    setLastFetchedAt(res.data.lastFetchedAt);
                    setTotalCount(res.data.totalCount || res.data.topics.length);
                    // Restore the industry filter if available
                    if (res.data.topics[0]?.industry) {
                        setIndustry(res.data.topics[0].industry);
                    }
                }
            } catch (error) {
                console.error("Failed to load saved trends:", error);
            } finally {
                setInitialLoading(false);
            }
        };
        loadSavedTrends();
    }, []);

    const formatLastFetched = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return "just now";
        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    };

    const handleFetchTrends = async () => {
        setLoading(true);
        try {
            const res = await api.post("/ai/trending-topics", {
                industry: industry || undefined,
            });
            if (res.data.topics && res.data.topics.length > 0) {
                // Add fetchedAt to new topics for display
                const newTopics = res.data.topics.map((t: TrendingTopic) => ({
                    ...t,
                    fetchedAt: new Date().toISOString()
                }));
                // Prepend new topics to existing list
                setTopics([...newTopics, ...topics]);
                setLastFetchedAt(new Date().toISOString());
                setTotalCount(prev => prev + res.data.topics.length);
                toast.success(`Added ${res.data.topics.length} new trending topics`);
            } else {
                toast.error("No trending topics found. Try a different industry.");
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to fetch trending topics");
        } finally {
            setLoading(false);
        }
    };

    const handleUseForIdeas = (topic: TrendingTopic) => {
        // Navigate to the generate ideas page with trending topics pre-filled
        const trendingParam = encodeURIComponent(topic.topic);
        router.push(`/ideas/generate?trendingTopics=${trendingParam}`);
    };

    const handleUseForPost = (topic: TrendingTopic) => {
        // Store trend data for the Create page to pick up
        const postContext = {
            topic: topic.topic,
            description: topic.description,
            relevance: topic.relevance,
            suggestedAngles: topic.suggestedAngles,
            trendType: topic.trendType
        };
        localStorage.setItem('trendForPost', JSON.stringify(postContext));
        router.push('/create?fromTrend=true');
    };

    const getTrendTypeIcon = (trendType: string) => {
        switch (trendType?.toLowerCase()) {
            case "hot":
            case "viral":
                return <Flame className="h-4 w-4 text-orange-500" />;
            case "emerging":
            case "rising":
                return <Zap className="h-4 w-4 text-yellow-500" />;
            case "steady":
            case "evergreen":
                return <Target className="h-4 w-4 text-green-500" />;
            default:
                return <TrendingUp className="h-4 w-4 text-blue-500" />;
        }
    };

    const getTrendTypeBadgeClass = (trendType: string) => {
        switch (trendType?.toLowerCase()) {
            case "hot":
            case "viral":
                return "bg-orange-50 text-orange-700 border-orange-200";
            case "emerging":
            case "rising":
                return "bg-yellow-50 text-yellow-700 border-yellow-200";
            case "steady":
            case "evergreen":
                return "bg-green-50 text-green-700 border-green-200";
            default:
                return "bg-blue-50 text-blue-700 border-blue-200";
        }
    };

    return (
        <div className="space-y-6">
            <Toaster />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Trending Topics</h2>
                    <p className="text-muted-foreground">
                        Discover what's trending in your industry and turn insights into content ideas.
                    </p>
                </div>
            </div>

            {/* Fetch Controls */}
            <Card className="border-slate-200">
                <CardHeader className="pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-50 rounded-lg border border-indigo-100">
                            <TrendingUp className="h-5 w-5 text-indigo-600" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">Find Trending Topics</CardTitle>
                            <CardDescription>
                                Enter your industry to discover relevant trends
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <Label htmlFor="industry" className="sr-only">
                                Industry
                            </Label>
                            <Input
                                id="industry"
                                value={industry}
                                onChange={(e) => setIndustry(e.target.value)}
                                placeholder="e.g., SaaS, Fintech, Healthcare, AI/ML, DevOps..."
                                className="bg-slate-50/30"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleFetchTrends();
                                    }
                                }}
                            />
                        </div>
                        <Button
                            onClick={handleFetchTrends}
                            disabled={loading}
                            className="bg-indigo-600 hover:bg-indigo-700 px-6"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Searching...
                                </>
                            ) : topics.length > 0 ? (
                                <>
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Refresh
                                </>
                            ) : (
                                <>
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    Find Trends
                                </>
                            )}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Results */}
            {initialLoading ? (
                <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mb-4 opacity-50" />
                    <p className="text-sm">Loading saved trends...</p>
                </div>
            ) : topics.length > 0 ? (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold">
                                {totalCount > topics.length
                                    ? `${topics.length} of ${totalCount} Saved Trends`
                                    : `${topics.length} Saved Trends`}
                            </h3>
                            {lastFetchedAt && (
                                <p className="text-xs text-muted-foreground">
                                    Latest batch: {formatLastFetched(lastFetchedAt)}
                                </p>
                            )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Use for Ideas (recurring) or Post (immediate)
                        </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        {topics.map((topic, index) => (
                            <Card
                                key={index}
                                className="group border-slate-200 hover:border-indigo-200 hover:shadow-md transition-all"
                            >
                                <CardContent className="pt-6 space-y-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="space-y-1 flex-1">
                                            <div className="flex items-center gap-2">
                                                {getTrendTypeIcon(topic.trendType)}
                                                <h4 className="font-semibold text-slate-900">
                                                    {topic.topic}
                                                </h4>
                                            </div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span
                                                    className={`inline-flex items-center text-[10px] font-medium px-2 py-0.5 rounded-full border ${getTrendTypeBadgeClass(
                                                        topic.trendType
                                                    )}`}
                                                >
                                                    {topic.trendType}
                                                </span>
                                                {topic.fetchedAt && (
                                                    <span className="text-[10px] text-slate-400">
                                                        {formatLastFetched(topic.fetchedAt)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                        {topic.description}
                                    </p>

                                    {topic.relevance && (
                                        <div className="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                            <span className="font-medium">Why it matters:</span>{" "}
                                            {topic.relevance}
                                        </div>
                                    )}

                                    {topic.suggestedAngles && topic.suggestedAngles.length > 0 && (
                                        <div className="space-y-2">
                                            <p className="text-xs font-medium text-slate-600">
                                                Suggested Angles:
                                            </p>
                                            <ul className="space-y-1">
                                                {topic.suggestedAngles.slice(0, 3).map((angle, i) => (
                                                    <li
                                                        key={i}
                                                        className="text-xs text-muted-foreground flex items-start gap-2"
                                                    >
                                                        <Lightbulb className="h-3 w-3 mt-0.5 text-amber-500 shrink-0" />
                                                        {angle}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    <div className="pt-2 border-t flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1 group-hover:bg-indigo-50 group-hover:text-indigo-700 group-hover:border-indigo-200 transition-colors"
                                            onClick={() => handleUseForIdeas(topic)}
                                        >
                                            <Lightbulb className="mr-2 h-4 w-4" />
                                            Use for Ideas
                                        </Button>
                                        <Button
                                            variant="default"
                                            size="sm"
                                            className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                                            onClick={() => handleUseForPost(topic)}
                                        >
                                            <PenSquare className="mr-2 h-4 w-4" />
                                            Use for Post
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            ) : !loading && !initialLoading ? (
                <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg text-muted-foreground">
                    <TrendingUp className="h-12 w-12 mb-4 opacity-30" />
                    <p className="text-sm">Enter your industry and click "Find Trends" to discover trending topics.</p>
                </div>
            ) : null}
        </div>
    );
}
