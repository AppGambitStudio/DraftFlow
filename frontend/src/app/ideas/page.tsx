"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Lightbulb, Pencil, Trash2, Sparkles, Repeat, BookOpen, X, Wand2, LayoutGrid, List } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";


interface Idea {
    id: number;
    title: string;
    description: string;
    tags: string;
    status: string;
    createdAt: string;
    isRecurring?: boolean;
    frequency?: string;
    authorUrn?: string;
    authorName?: string;
    targetAudience?: string;
    generatedSummaries?: string; // JSON string
    sourceLinks?: string; // JSON string array
    scheduleTime?: string;
    scheduleDayOfWeek?: number;
    scheduleDayOfMonth?: number;
}

import { useSettings } from "@/contexts/SettingsContext";

export default function IdeasPage() {
    const router = useRouter();
    const { settings } = useSettings();
    const [ideas, setIdeas] = useState<Idea[]>([]);
    const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentIdea, setCurrentIdea] = useState<Idea | null>(null);
    const [formData, setFormData] = useState({
        title: "",
        description: "",
        isRecurring: false,
        frequency: "WEEKLY",
        authorUrn: "",
        authorName: "",
        targetAudience: "",
        sourceLinks: [] as string[],
        scheduleTime: "",
        scheduleDayOfWeek: 1, // 1 = Monday
        scheduleDayOfMonth: 1
    });
    const [generatingId, setGeneratingId] = useState<number | null>(null);
    const [isEnhancing, setIsEnhancing] = useState(false);
    const [authors, setAuthors] = useState<{ urn: string; name: string }[]>([]);
    const [viewingHistoryId, setViewingHistoryId] = useState<number | null>(null);
    const [contextModalOpen, setContextModalOpen] = useState(false);
    const [additionalContext, setAdditionalContext] = useState("");
    const [pendingIdea, setPendingIdea] = useState<Idea | null>(null);

    useEffect(() => {
        fetchIdeas();
        fetchAuthors();
    }, []);

    const fetchAuthors = async () => {
        try {
            const res = await api.get('/settings/linkedin/authors');
            setAuthors(res.data);
        } catch (error) {
            console.error('Failed to fetch authors:', error);
        }
    };

    const fetchIdeas = async () => {
        try {
            const res = await api.get("/ideas");
            setIdeas(res.data);
        } catch (error) {
            toast.error("Failed to fetch ideas");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (idea?: Idea) => {
        if (idea) {
            setCurrentIdea(idea);
            setFormData({
                title: idea.title,
                description: idea.description,
                isRecurring: idea.isRecurring || false,
                frequency: idea.frequency || "WEEKLY",
                authorUrn: idea.authorUrn || (authors.length > 0 ? authors[0].urn : ""),
                authorName: idea.authorName || (authors.length > 0 ? authors[0].name : ""),
                targetAudience: idea.targetAudience || "",
                sourceLinks: JSON.parse(idea.sourceLinks || '[]'),
                scheduleTime: idea.scheduleTime || "",
                scheduleDayOfWeek: idea.scheduleDayOfWeek || 1,
                scheduleDayOfMonth: idea.scheduleDayOfMonth || 1
            });
        } else {
            setCurrentIdea(null);
            setFormData({
                title: "",
                description: "",
                isRecurring: false,
                frequency: "WEEKLY",
                authorUrn: authors.length > 0 ? authors[0].urn : "",
                authorName: authors.length > 0 ? authors[0].name : "",
                targetAudience: "",
                sourceLinks: [],
                scheduleTime: "",
                scheduleDayOfWeek: 1,
                scheduleDayOfMonth: 1
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.title) {
            toast.error("Title is required");
            return;
        }

        try {
            if (currentIdea) {
                await api.put(`/ideas/${currentIdea.id}`, formData);
                toast.success("Idea updated");
            } else {
                await api.post("/ideas", formData);
                toast.success("Idea created");
            }
            setIsModalOpen(false);
            fetchIdeas();
        } catch (error) {
            toast.error("Failed to save idea");
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this idea?")) return;
        try {
            await api.delete(`/ideas/${id}`);
            toast.success("Idea deleted");
            fetchIdeas();
        } catch (error) {
            toast.error("Failed to delete idea");
        }
    };

    const handleEnhanceDescription = async () => {
        if (!formData.description) return;

        setIsEnhancing(true);
        try {
            const res = await api.post("/ai/enhance-idea", {
                title: formData.title,
                description: formData.description
            });

            if (res.data.content) {
                setFormData(prev => ({ ...prev, description: res.data.content }));
                toast.success("Description enhanced!");
            }
        } catch (error) {
            console.error("Failed to enhance description", error);
            toast.error("Failed to enhance description");
        } finally {
            setIsEnhancing(false);
        }
    };

    const handleGeneratePost = (idea: Idea) => {
        setPendingIdea(idea);
        setAdditionalContext("");
        setContextModalOpen(true);
    };

    const confirmGeneration = async () => {
        if (!pendingIdea) return;

        const idea = pendingIdea;
        setGeneratingId(idea.id);
        setContextModalOpen(false);

        try {
            const res = await api.post(`/ideas/${idea.id}/generate`, {
                platform: 'LINKEDIN',
                targetAudience: idea.targetAudience || undefined,
                additionalContext: additionalContext || undefined
            });
            const content = res.data.content;

            // Redirect to create page with content
            localStorage.setItem('draftPostContent', content);
            router.push('/create?source=idea');
        } catch (error) {
            toast.error("Failed to generate post");
        } finally {
            setGeneratingId(null);
            setPendingIdea(null);
        }
    };

    return (
        <div className="space-y-6">
            <Toaster />
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Idea Board</h2>
                    <p className="text-muted-foreground">Capture and organize your content ideas.</p>
                </div>
                <div className="flex gap-4 items-center">
                    <div className="flex items-center border rounded-lg p-1 bg-muted/20">
                        <Button
                            variant={viewMode === 'card' ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setViewMode('card')}
                        >
                            <LayoutGrid className="h-4 w-4" />
                        </Button>
                        <Button
                            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setViewMode('list')}
                        >
                            <List className="h-4 w-4" />
                        </Button>
                    </div>
                    <Button onClick={() => handleOpenModal()}>
                        <Plus className="mr-2 h-4 w-4" />
                        New Idea
                    </Button>
                </div>
            </div>

            {loading ? (
                <div>Loading ideas...</div>
            ) : ideas.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg text-muted-foreground">
                    <Lightbulb className="h-12 w-12 mb-4 opacity-50" />
                    <p>No ideas yet. Start capturing your thoughts!</p>
                </div>
            ) : (
                viewMode === 'card' ? (
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {ideas.map((idea) => (
                            <div key={idea.id} className="group relative flex flex-col justify-between rounded-xl border bg-card p-6 shadow-sm transition-all hover:shadow-md">
                                <div className="space-y-4">
                                    <div className="flex items-start justify-between">
                                        <div className="space-y-1">
                                            <h3 className="font-semibold leading-none tracking-tight">{idea.title}</h3>
                                            {idea.isRecurring && (
                                                <div className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full w-fit">
                                                    <Repeat className="h-3 w-3" />
                                                    <span className="font-medium">{idea.frequency}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => setViewingHistoryId(idea.id)} className="text-muted-foreground hover:text-blue-500" title="Previous Posts">
                                                <BookOpen className="h-4 w-4" />
                                            </button>
                                            <button onClick={() => handleOpenModal(idea)} className="text-muted-foreground hover:text-primary" title="Edit Idea">
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            <button onClick={() => handleDelete(idea.id)} className="text-muted-foreground hover:text-red-500" title="Delete Idea">
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">
                                        {idea.description}
                                    </p>
                                </div>
                                <div className="mt-6 pt-4 border-t">
                                    <Button
                                        variant="outline"
                                        className="w-full"
                                        onClick={() => handleGeneratePost(idea)}
                                        disabled={generatingId === idea.id}
                                    >
                                        <Sparkles className="mr-2 h-4 w-4" />
                                        {generatingId === idea.id ? "Generating..." : "Generate Post"}
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-3">
                        {ideas.map((idea) => (
                            <div key={idea.id} className="group flex items-center justify-between p-4 rounded-lg border bg-card shadow-sm hover:shadow-md transition-all">
                                <div className="flex-1 min-w-0 mr-6">
                                    <div className="flex items-center gap-3 mb-1">
                                        <h3 className="font-semibold truncate text-base">{idea.title}</h3>
                                        {idea.isRecurring && (
                                            <div className="flex items-center gap-1 text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full shrink-0">
                                                <Repeat className="h-3 w-3" />
                                                <span className="font-medium">{idea.frequency}</span>
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-sm text-muted-foreground truncate max-w-2xl">
                                        {idea.description}
                                    </p>
                                </div>

                                <div className="flex items-center gap-4 shrink-0">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleGeneratePost(idea)}
                                        disabled={generatingId === idea.id}
                                        className="h-8"
                                    >
                                        <Sparkles className="mr-2 h-3.5 w-3.5" />
                                        {generatingId === idea.id ? "Generating..." : "Generate"}
                                    </Button>

                                    <div className="flex items-center gap-1 pl-4 border-l">
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-blue-500" onClick={() => setViewingHistoryId(idea.id)} title="History">
                                            <BookOpen className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleOpenModal(idea)} title="Edit">
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-500" onClick={() => handleDelete(idea.id)} title="Delete">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )
            )}

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-2xl rounded-xl bg-background p-6 shadow-2xl border border-border animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
                        <div className="mb-6 shrink-0">
                            <h2 className="text-xl font-bold text-foreground">{currentIdea ? "Edit Idea" : "New Idea"}</h2>
                        </div>
                        <div className="space-y-4 flex-1 overflow-y-auto pr-2">
                            <div className="space-y-2">
                                <Label htmlFor="title">Title</Label>
                                <Input
                                    id="title"
                                    placeholder="e.g., Cloud Migration Benefits"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="description">Description / Raw Thoughts</Label>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-xs text-muted-foreground hover:text-primary"
                                        onClick={handleEnhanceDescription}
                                        disabled={isEnhancing || !formData.description}
                                    >
                                        <Wand2 className="mr-1 h-3 w-3" />
                                        {isEnhancing ? "Improvising..." : "Improvise with AI"}
                                    </Button>
                                </div>
                                <Textarea
                                    id="description"
                                    placeholder="Jot down your key points here..."
                                    className="min-h-[150px]"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Reference Links (One per line)</Label>
                                <Textarea
                                    placeholder="https://example.com/article&#10;https://another-source.com"
                                    className="min-h-[80px]"
                                    value={formData.sourceLinks.join('\n')}
                                    onChange={(e) => setFormData({ ...formData, sourceLinks: e.target.value.split('\n').filter(l => l.trim()) })}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Content from these links will be fetched and used as context for AI generation.
                                </p>
                            </div>

                            <div className="flex items-center space-x-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="isRecurring"
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    checked={formData.isRecurring}
                                    onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                                />
                                <Label htmlFor="isRecurring">Recurring Idea</Label>
                            </div>

                            {formData.isRecurring && (
                                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 p-4 bg-muted/30 rounded-lg border">
                                    <div className="space-y-2">
                                        <Label htmlFor="frequency">Frequency</Label>
                                        <select
                                            id="frequency"
                                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                            value={formData.frequency}
                                            onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                                        >
                                            <option value="DAILY">Daily</option>
                                            <option value="WEEKLY">Weekly</option>
                                            <option value="MONTHLY">Monthly</option>
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="scheduleTime">Time</Label>
                                            <Input
                                                id="scheduleTime"
                                                type="time"
                                                value={formData.scheduleTime}
                                                onChange={(e) => setFormData({ ...formData, scheduleTime: e.target.value })}
                                            />
                                        </div>

                                        {formData.frequency === 'WEEKLY' && (
                                            <div className="space-y-2">
                                                <Label htmlFor="dayOfWeek">Day</Label>
                                                <select
                                                    id="dayOfWeek"
                                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                                    value={formData.scheduleDayOfWeek}
                                                    onChange={(e) => setFormData({ ...formData, scheduleDayOfWeek: parseInt(e.target.value) })}
                                                >
                                                    <option value={1}>Monday</option>
                                                    <option value={2}>Tuesday</option>
                                                    <option value={3}>Wednesday</option>
                                                    <option value={4}>Thursday</option>
                                                    <option value={5}>Friday</option>
                                                    <option value={6}>Saturday</option>
                                                    <option value={0}>Sunday</option>
                                                </select>
                                            </div>
                                        )}

                                        {formData.frequency === 'MONTHLY' && (
                                            <div className="space-y-2">
                                                <Label htmlFor="dayOfMonth">Day of Month</Label>
                                                <select
                                                    id="dayOfMonth"
                                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                                    value={formData.scheduleDayOfMonth}
                                                    onChange={(e) => setFormData({ ...formData, scheduleDayOfMonth: parseInt(e.target.value) })}
                                                >
                                                    {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                                                        <option key={day} value={day}>{day}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>

                                    <p className="text-xs text-muted-foreground">
                                        Drafts will be generated at this time in your browser's timezone.
                                    </p>
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="author">Post As</Label>
                                <select
                                    id="author"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                    value={formData.authorUrn}
                                    onChange={(e) => {
                                        const selectedAuthor = authors.find(a => a.urn === e.target.value);
                                        setFormData({
                                            ...formData,
                                            authorUrn: e.target.value,
                                            authorName: selectedAuthor?.name || ""
                                        });
                                    }}
                                >
                                    {authors.map((author) => (
                                        <option key={author.urn} value={author.urn}>
                                            {author.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {settings.targetAudiences.length > 0 && (
                                <div className="space-y-2">
                                    <Label htmlFor="idea-audience">Target Audience</Label>
                                    <select
                                        id="idea-audience"
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                        value={formData.targetAudience}
                                        onChange={(e) => setFormData({ ...formData, targetAudience: e.target.value })}
                                    >
                                        <option value="">No Target Audience</option>
                                        {settings.targetAudiences.map((audience, index) => (
                                            <option key={index} value={audience}>
                                                {audience}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                        <div className="mt-6 flex justify-end gap-3 shrink-0 pt-2 border-t">
                            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                            <Button onClick={handleSave}>Save Idea</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* History Modal */}
            {viewingHistoryId && (() => {
                const idea = ideas.find(i => i.id === viewingHistoryId);
                const summaries = idea ? JSON.parse(idea.generatedSummaries || '[]') : [];

                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="w-full max-w-2xl rounded-xl bg-background p-6 shadow-2xl border border-border animate-in zoom-in-95 duration-200">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-bold text-foreground">Previous Posts History</h2>
                                <button onClick={() => setViewingHistoryId(null)} className="text-muted-foreground hover:text-foreground">
                                    <X className="h-5 w-5" />
                                </button>
                            </div>

                            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                                <p className="text-sm text-muted-foreground mb-4">
                                    These summaries are used by AI to avoid generating duplicate content.
                                </p>

                                {summaries.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                                        <p>No previous posts generated yet.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {summaries.map((summary: string, idx: number) => (
                                            <div key={idx} className="p-4 rounded-lg bg-muted/50 border">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                                        Run #{summaries.length - idx}
                                                    </span>
                                                </div>
                                                <p className="text-sm text-foreground/90 leading-relaxed">
                                                    {summary}
                                                </p>
                                            </div>
                                        )).reverse()}
                                    </div>
                                )}
                            </div>

                            <div className="mt-6 flex justify-end">
                                <Button onClick={() => setViewingHistoryId(null)}>Close</Button>
                            </div>
                        </div>
                    </div>
                );

            })()}

            {/* Additional Context Modal */}
            {contextModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-md rounded-xl bg-background p-6 shadow-2xl border border-border animate-in zoom-in-95 duration-200">
                        <div className="mb-4">
                            <h2 className="text-xl font-bold text-foreground">Generate Post</h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                Any specific instructions or context for this post?
                            </p>
                        </div>

                        <div className="space-y-4">
                            <Textarea
                                placeholder="e.g. Focus on the cost savings aspect... or Include a joke about deployment..."
                                value={additionalContext}
                                onChange={(e) => setAdditionalContext(e.target.value)}
                                className="min-h-[100px]"
                                autoFocus
                            />

                            <div className="flex justify-end gap-3 pt-2">
                                <Button variant="outline" onClick={() => setContextModalOpen(false)}>
                                    Cancel
                                </Button>
                                <Button onClick={confirmGeneration}>
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    Generate
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
