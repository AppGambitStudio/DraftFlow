"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Lightbulb, Pencil, Trash2, Sparkles } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";


interface Idea {
    id: number;
    title: string;
    description: string;
    tags: string;
    status: string;
    createdAt: string;
}

export default function IdeasPage() {
    const router = useRouter();
    const [ideas, setIdeas] = useState<Idea[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentIdea, setCurrentIdea] = useState<Idea | null>(null);
    const [formData, setFormData] = useState({ title: "", description: "" });
    const [generatingId, setGeneratingId] = useState<number | null>(null);

    useEffect(() => {
        fetchIdeas();
    }, []);

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
            setFormData({ title: idea.title, description: idea.description });
        } else {
            setCurrentIdea(null);
            setFormData({ title: "", description: "" });
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

    const handleGeneratePost = async (idea: Idea) => {
        setGeneratingId(idea.id);
        try {
            const res = await api.post(`/ideas/${idea.id}/generate`, { platform: 'LINKEDIN' });
            const content = res.data.content;

            // Redirect to create page with content
            // We can pass it via query param or local storage. 
            // Query param is cleaner but has length limits. Local storage is safer for long content.
            localStorage.setItem('draftPostContent', content);
            router.push('/create?source=idea');
        } catch (error) {
            toast.error("Failed to generate post");
        } finally {
            setGeneratingId(null);
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
                <Button onClick={() => handleOpenModal()}>
                    <Plus className="mr-2 h-4 w-4" />
                    New Idea
                </Button>
            </div>

            {loading ? (
                <div>Loading ideas...</div>
            ) : ideas.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg text-muted-foreground">
                    <Lightbulb className="h-12 w-12 mb-4 opacity-50" />
                    <p>No ideas yet. Start capturing your thoughts!</p>
                </div>
            ) : (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {ideas.map((idea) => (
                        <div key={idea.id} className="group relative flex flex-col justify-between rounded-xl border bg-card p-6 shadow-sm transition-all hover:shadow-md">
                            <div className="space-y-4">
                                <div className="flex items-start justify-between">
                                    <h3 className="font-semibold leading-none tracking-tight">{idea.title}</h3>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => handleOpenModal(idea)} className="text-muted-foreground hover:text-primary">
                                            <Pencil className="h-4 w-4" />
                                        </button>
                                        <button onClick={() => handleDelete(idea.id)} className="text-muted-foreground hover:text-red-500">
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
            )}

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-lg rounded-xl bg-background p-6 shadow-2xl border border-border animate-in zoom-in-95 duration-200">
                        <div className="mb-6">
                            <h2 className="text-xl font-bold text-foreground">{currentIdea ? "Edit Idea" : "New Idea"}</h2>
                        </div>
                        <div className="space-y-4">
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
                                <Label htmlFor="description">Description / Raw Thoughts</Label>
                                <Textarea
                                    id="description"
                                    placeholder="Jot down your key points here..."
                                    className="min-h-[150px]"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="mt-6 flex justify-end gap-3">
                            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                            <Button onClick={handleSave}>Save Idea</Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
