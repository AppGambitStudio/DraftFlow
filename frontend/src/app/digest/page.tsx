"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import toast, { Toaster } from "react-hot-toast";
import {
    Newspaper,
    Loader2,
    Plus,
    X,
    Copy,
    Check,
    Send,
    Sparkles,
    ExternalLink,
    Clock,
    Save,
    History,
    Trash2,
    ChevronDown,
    ChevronUp,
} from "lucide-react";

interface Story {
    headline: string;
    summary: string;
    url: string;
}

interface DigestConfig {
    topics: string[];
    platform: string;
    storyCount: number;
    additionalContext: string;
    scheduleEnabled: boolean;
    scheduleDayOfWeek: number;
    scheduleTime: string;
    authorUrn: string | null;
}

interface DigestHistoryItem {
    id: number;
    content: string;
    topics: string[];
    stories: Story[];
    platform: string;
    storyCount: number;
    status: string;
    postId: number | null;
    createdAt: string;
}

const DAYS_OF_WEEK = [
    { value: 0, label: "Sunday" },
    { value: 1, label: "Monday" },
    { value: 2, label: "Tuesday" },
    { value: 3, label: "Wednesday" },
    { value: 4, label: "Thursday" },
    { value: 5, label: "Friday" },
    { value: 6, label: "Saturday" },
];

export default function WeeklyDigestPage() {
    const router = useRouter();
    const [topics, setTopics] = useState<string[]>([]);
    const [topicInput, setTopicInput] = useState("");
    const [storyCount, setStoryCount] = useState(5);
    const [platform, setPlatform] = useState("linkedin");
    const [additionalContext, setAdditionalContext] = useState("");
    const [scheduleEnabled, setScheduleEnabled] = useState(false);
    const [scheduleDayOfWeek, setScheduleDayOfWeek] = useState(1);
    const [scheduleTime, setScheduleTime] = useState("09:00");
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [configLoaded, setConfigLoaded] = useState(false);
    const [generatedContent, setGeneratedContent] = useState("");
    const [currentDigestId, setCurrentDigestId] = useState<number | null>(null);
    const [stories, setStories] = useState<Story[]>([]);
    const [copied, setCopied] = useState(false);

    // History
    const [history, setHistory] = useState<DigestHistoryItem[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [expandedHistoryId, setExpandedHistoryId] = useState<number | null>(null);

    // Load config on mount
    useEffect(() => {
        loadConfig();
        loadHistory();
    }, []);

    const loadConfig = async () => {
        try {
            const res = await api.get("/ai/digest-config");
            if (res.data.config) {
                const c: DigestConfig = res.data.config;
                setTopics(c.topics || []);
                setPlatform(c.platform || "linkedin");
                setStoryCount(c.storyCount || 5);
                setAdditionalContext(c.additionalContext || "");
                setScheduleEnabled(c.scheduleEnabled || false);
                setScheduleDayOfWeek(c.scheduleDayOfWeek ?? 1);
                setScheduleTime(c.scheduleTime || "09:00");
            }
        } catch (error) {
            console.error("Failed to load digest config:", error);
        } finally {
            setConfigLoaded(true);
        }
    };

    const loadHistory = async () => {
        setHistoryLoading(true);
        try {
            const res = await api.get("/ai/weekly-digest/history?limit=20");
            setHistory(res.data.digests || []);
        } catch (error) {
            console.error("Failed to load digest history:", error);
        } finally {
            setHistoryLoading(false);
        }
    };

    const saveConfig = async () => {
        setSaving(true);
        try {
            await api.put("/ai/digest-config", {
                topics,
                platform,
                storyCount,
                additionalContext,
                scheduleEnabled,
                scheduleDayOfWeek,
                scheduleTime,
            });
            toast.success("Configuration saved!");
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to save config");
        } finally {
            setSaving(false);
        }
    };

    const addTopic = () => {
        const trimmed = topicInput.trim();
        if (trimmed && !topics.includes(trimmed)) {
            setTopics([...topics, trimmed]);
            setTopicInput("");
        }
    };

    const removeTopic = (index: number) => {
        setTopics(topics.filter((_, i) => i !== index));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault();
            addTopic();
        }
    };

    const handleGenerate = async () => {
        if (topics.length === 0) {
            toast.error("Add at least one topic to search for");
            return;
        }

        setLoading(true);
        setGeneratedContent("");
        setStories([]);
        setCurrentDigestId(null);

        try {
            const res = await api.post("/ai/weekly-digest", {
                topics,
                platform,
                storyCount,
                additionalContext: additionalContext || undefined,
            });

            setGeneratedContent(res.data.content);
            setStories(res.data.stories || []);
            setCurrentDigestId(res.data.digestId || null);
            toast.success("Weekly digest generated!");

            // Refresh history
            loadHistory();
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to generate digest");
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = async (content?: string) => {
        await navigator.clipboard.writeText(content || generatedContent);
        setCopied(true);
        toast.success("Copied to clipboard!");
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSaveAsDraft = async (digestId?: number) => {
        const id = digestId || currentDigestId;
        if (!id) {
            toast.error("No digest to save");
            return;
        }

        try {
            const res = await api.post(`/ai/weekly-digest/${id}/save-draft`);
            toast.success("Saved as draft!");
            loadHistory();
            setTimeout(() => router.push("/"), 1500);
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to save draft");
        }
    };

    const handleDeleteDigest = async (id: number) => {
        try {
            await api.delete(`/ai/weekly-digest/${id}`);
            setHistory((prev) => prev.filter((h) => h.id !== id));
            toast.success("Digest deleted");
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to delete digest");
        }
    };

    const handleViewHistoryItem = (item: DigestHistoryItem) => {
        setGeneratedContent(item.content);
        setStories(item.stories || []);
        setCurrentDigestId(item.id);
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const suggestedTopics = [
        "AI Coding Tools",
        "Claude Code",
        "AWS",
        "LLM",
        "Agentic AI",
        "Software Engineering",
        "DevOps",
        "Open Source",
        "Startups",
        "Cloud Computing",
    ];

    if (!configLoaded) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <Toaster position="top-right" />
            <div className="max-w-5xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <Newspaper className="h-7 w-7 text-slate-700" />
                        <div>
                            <h1 className="text-2xl font-bold text-slate-900">Weekly Digest</h1>
                            <p className="text-sm text-slate-500">
                                Curate the biggest stories of the week into a short, impactful post
                            </p>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowHistory(!showHistory)}
                    >
                        <History className="h-4 w-4 mr-1.5" />
                        History ({history.length})
                    </Button>
                </div>

                {/* History panel */}
                {showHistory && (
                    <Card className="mb-6">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base">Past Digests</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {historyLoading ? (
                                <div className="flex justify-center py-4">
                                    <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                                </div>
                            ) : history.length === 0 ? (
                                <p className="text-sm text-slate-400 text-center py-4">No digests generated yet</p>
                            ) : (
                                <div className="space-y-2">
                                    {history.map((item) => (
                                        <div key={item.id} className="border rounded-lg">
                                            <div
                                                className="flex items-center justify-between p-3 cursor-pointer hover:bg-slate-50"
                                                onClick={() => setExpandedHistoryId(expandedHistoryId === item.id ? null : item.id)}
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <span className="font-medium text-slate-700">
                                                            {formatDate(item.createdAt)}
                                                        </span>
                                                        <span className="text-slate-400">|</span>
                                                        <span className="text-xs text-slate-500 truncate">
                                                            {item.topics.join(", ")}
                                                        </span>
                                                        {item.postId && (
                                                            <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                                                                Saved
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 ml-2">
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleViewHistoryItem(item);
                                                        }}
                                                        className="h-7 text-xs"
                                                    >
                                                        View
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteDigest(item.id);
                                                        }}
                                                        className="h-7 text-xs text-red-500 hover:text-red-700"
                                                    >
                                                        <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                    {expandedHistoryId === item.id ? (
                                                        <ChevronUp className="h-4 w-4 text-slate-400" />
                                                    ) : (
                                                        <ChevronDown className="h-4 w-4 text-slate-400" />
                                                    )}
                                                </div>
                                            </div>
                                            {expandedHistoryId === item.id && (
                                                <div className="px-3 pb-3 border-t">
                                                    <div className="whitespace-pre-wrap text-xs text-slate-600 mt-2 max-h-48 overflow-y-auto">
                                                        {item.content}
                                                    </div>
                                                    <div className="flex gap-2 mt-2">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() => handleCopy(item.content)}
                                                            className="h-7 text-xs"
                                                        >
                                                            <Copy className="h-3 w-3 mr-1" />
                                                            Copy
                                                        </Button>
                                                        {!item.postId && (
                                                            <Button
                                                                size="sm"
                                                                onClick={() => handleSaveAsDraft(item.id)}
                                                                className="h-7 text-xs"
                                                            >
                                                                <Send className="h-3 w-3 mr-1" />
                                                                Save as Draft
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left: Configuration */}
                    <div className="space-y-4">
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Topics to Track</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="flex gap-2">
                                    <Input
                                        value={topicInput}
                                        onChange={(e) => setTopicInput(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="e.g., AI Coding Tools, AWS..."
                                        className="flex-1"
                                    />
                                    <Button
                                        onClick={addTopic}
                                        size="sm"
                                        variant="outline"
                                        disabled={!topicInput.trim()}
                                    >
                                        <Plus className="h-4 w-4" />
                                    </Button>
                                </div>

                                {/* Topic tags */}
                                {topics.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                        {topics.map((topic, i) => (
                                            <span
                                                key={i}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border"
                                            >
                                                {topic}
                                                <button
                                                    onClick={() => removeTopic(i)}
                                                    className="hover:text-red-500 transition-colors"
                                                >
                                                    <X className="h-3 w-3" />
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Quick-add suggestions (show when no topics or when user might want more) */}
                                <div>
                                    <p className="text-xs text-slate-400 mb-2">Quick add:</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {suggestedTopics
                                            .filter((t) => !topics.includes(t))
                                            .map((t) => (
                                                <button
                                                    key={t}
                                                    onClick={() => setTopics([...topics, t])}
                                                    className="px-2 py-0.5 text-xs rounded-full border border-dashed border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700 transition-colors"
                                                >
                                                    + {t}
                                                </button>
                                            ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base">Options</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-xs">Platform</Label>
                                        <select
                                            value={platform}
                                            onChange={(e) => setPlatform(e.target.value)}
                                            className="w-full mt-1 text-sm border border-slate-200 rounded-md p-2 bg-white"
                                        >
                                            <option value="linkedin">LinkedIn</option>
                                            <option value="twitter">Twitter/X</option>
                                        </select>
                                    </div>
                                    <div>
                                        <Label className="text-xs">Stories</Label>
                                        <select
                                            value={storyCount}
                                            onChange={(e) => setStoryCount(Number(e.target.value))}
                                            className="w-full mt-1 text-sm border border-slate-200 rounded-md p-2 bg-white"
                                        >
                                            <option value={3}>3 stories</option>
                                            <option value={4}>4 stories</option>
                                            <option value={5}>5 stories</option>
                                            <option value={7}>7 stories</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <Label className="text-xs">Additional context (optional)</Label>
                                    <Textarea
                                        value={additionalContext}
                                        onChange={(e) => setAdditionalContext(e.target.value)}
                                        placeholder="e.g., Focus on developer tools, Write for CTOs, Include a contrarian take..."
                                        rows={2}
                                        className="mt-1 text-sm"
                                    />
                                </div>

                                <Button
                                    onClick={handleGenerate}
                                    disabled={loading || topics.length === 0}
                                    className="w-full"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Searching &amp; curating stories...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="h-4 w-4 mr-2" />
                                            Generate Weekly Digest
                                        </>
                                    )}
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Schedule & Save Config */}
                        <Card>
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Clock className="h-4 w-4" />
                                    Auto-Schedule
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={scheduleEnabled}
                                        onChange={(e) => setScheduleEnabled(e.target.checked)}
                                        className="rounded border-slate-300"
                                    />
                                    <span className="text-sm text-slate-700">
                                        Auto-generate weekly digest
                                    </span>
                                </label>

                                {scheduleEnabled && (
                                    <div className="grid grid-cols-2 gap-3 pl-6">
                                        <div>
                                            <Label className="text-xs">Day</Label>
                                            <select
                                                value={scheduleDayOfWeek}
                                                onChange={(e) => setScheduleDayOfWeek(Number(e.target.value))}
                                                className="w-full mt-1 text-sm border border-slate-200 rounded-md p-2 bg-white"
                                            >
                                                {DAYS_OF_WEEK.map((d) => (
                                                    <option key={d.value} value={d.value}>
                                                        {d.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <Label className="text-xs">Time</Label>
                                            <Input
                                                type="time"
                                                value={scheduleTime}
                                                onChange={(e) => setScheduleTime(e.target.value)}
                                                className="mt-1 text-sm"
                                            />
                                        </div>
                                    </div>
                                )}

                                {scheduleEnabled && (
                                    <p className="text-xs text-slate-400 pl-6">
                                        Digest will be auto-generated every {DAYS_OF_WEEK.find(d => d.value === scheduleDayOfWeek)?.label} at {scheduleTime} and saved as a draft post.
                                    </p>
                                )}

                                <Button
                                    variant="outline"
                                    onClick={saveConfig}
                                    disabled={saving}
                                    className="w-full"
                                >
                                    {saving ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <Save className="h-4 w-4 mr-2" />
                                    )}
                                    Save Configuration
                                </Button>
                            </CardContent>
                        </Card>

                        {/* Sources panel */}
                        {stories.length > 0 && (
                            <Card>
                                <CardHeader className="pb-3">
                                    <CardTitle className="text-base">Sources ({stories.length})</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2">
                                        {stories.map((story, i) => (
                                            <div key={i} className="text-sm border-b last:border-0 pb-2 last:pb-0">
                                                <div className="font-medium text-slate-700">{story.headline}</div>
                                                <div className="text-xs text-slate-500 mt-0.5">{story.summary}</div>
                                                {story.url && (
                                                    <a
                                                        href={story.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1 mt-1"
                                                    >
                                                        <ExternalLink className="h-3 w-3" />
                                                        {(() => { try { return new URL(story.url).hostname; } catch { return story.url; } })()}
                                                    </a>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </div>

                    {/* Right: Generated content */}
                    <div>
                        <Card className="sticky top-6">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <CardTitle className="text-base">Preview</CardTitle>
                                    {generatedContent && (
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleCopy()}
                                            >
                                                {copied ? (
                                                    <Check className="h-3.5 w-3.5 mr-1" />
                                                ) : (
                                                    <Copy className="h-3.5 w-3.5 mr-1" />
                                                )}
                                                {copied ? "Copied" : "Copy"}
                                            </Button>
                                            <Button
                                                size="sm"
                                                onClick={() => handleSaveAsDraft()}
                                            >
                                                <Send className="h-3.5 w-3.5 mr-1" />
                                                Save as Draft
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </CardHeader>
                            <CardContent>
                                {generatedContent ? (
                                    <div className="whitespace-pre-wrap text-sm text-slate-800 leading-relaxed bg-white border rounded-lg p-4 min-h-[300px]">
                                        {generatedContent}
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center justify-center text-center py-16 text-slate-400">
                                        <Newspaper className="h-12 w-12 mb-3 opacity-30" />
                                        <p className="text-sm">
                                            Add topics and generate to see your weekly digest here
                                        </p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
