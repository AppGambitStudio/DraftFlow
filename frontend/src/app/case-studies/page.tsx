"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Plus,
    BookOpen,
    Pencil,
    Trash2,
    X,
    Building2,
    Target,
    Lightbulb,
    TrendingUp,
    Quote,
    LayoutGrid,
    List,
    Filter
} from "lucide-react";
import toast, { Toaster } from "react-hot-toast";

interface CaseStudy {
    id: string;
    title: string;
    clientName: string;
    industry: string | null;
    challenge: string;
    solution: string;
    results: string;
    testimonial: string | null;
    tags: string[];
    status: "draft" | "published" | "archived";
    createdAt: string;
    updatedAt: string;
}

export default function CaseStudiesPage() {
    const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentCaseStudy, setCurrentCaseStudy] = useState<CaseStudy | null>(null);
    const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
    const [filterStatus, setFilterStatus] = useState<string>('');
    const [filterIndustry, setFilterIndustry] = useState<string>('');
    const [formData, setFormData] = useState({
        title: "",
        clientName: "",
        industry: "",
        challenge: "",
        solution: "",
        results: "",
        testimonial: "",
        tags: [] as string[],
        status: "draft" as "draft" | "published" | "archived"
    });
    const [tagsInputValue, setTagsInputValue] = useState("");

    useEffect(() => {
        fetchCaseStudies();
    }, [filterStatus, filterIndustry]);

    const fetchCaseStudies = async () => {
        try {
            const params = new URLSearchParams();
            if (filterStatus) params.append('status', filterStatus);
            if (filterIndustry) params.append('industry', filterIndustry);

            const url = params.toString() ? `/case-studies?${params}` : '/case-studies';
            const res = await api.get(url);
            setCaseStudies(res.data);
        } catch (error) {
            console.error("Failed to fetch case studies:", error);
            toast.error("Failed to fetch case studies");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (caseStudy?: CaseStudy) => {
        if (caseStudy) {
            setCurrentCaseStudy(caseStudy);
            setFormData({
                title: caseStudy.title,
                clientName: caseStudy.clientName,
                industry: caseStudy.industry || "",
                challenge: caseStudy.challenge,
                solution: caseStudy.solution,
                results: caseStudy.results,
                testimonial: caseStudy.testimonial || "",
                tags: caseStudy.tags,
                status: caseStudy.status
            });
            setTagsInputValue(caseStudy.tags.join(', '));
        } else {
            setCurrentCaseStudy(null);
            setFormData({
                title: "",
                clientName: "",
                industry: "",
                challenge: "",
                solution: "",
                results: "",
                testimonial: "",
                tags: [],
                status: "draft"
            });
            setTagsInputValue("");
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formData.title || !formData.clientName || !formData.challenge || !formData.solution || !formData.results) {
            toast.error("Please fill in all required fields");
            return;
        }

        try {
            if (currentCaseStudy) {
                await api.put(`/case-studies/${currentCaseStudy.id}`, formData);
                toast.success("Case study updated");
            } else {
                await api.post("/case-studies", formData);
                toast.success("Case study created");
            }
            setIsModalOpen(false);
            fetchCaseStudies();
        } catch (error) {
            console.error("Failed to save case study:", error);
            toast.error("Failed to save case study");
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this case study?")) return;
        try {
            await api.delete(`/case-studies/${id}`);
            toast.success("Case study deleted");
            fetchCaseStudies();
        } catch (error) {
            console.error("Failed to delete case study:", error);
            toast.error("Failed to delete case study");
        }
    };

    const getStatusBadge = (status: CaseStudy["status"]) => {
        if (status === "published") {
            return (
                <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                    Published
                </span>
            );
        } else if (status === "archived") {
            return (
                <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 border border-slate-200">
                    Archived
                </span>
            );
        }
        return (
            <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                Draft
            </span>
        );
    };

    const uniqueIndustries = [...new Set(caseStudies.map(cs => cs.industry).filter(Boolean))];

    return (
        <div className="space-y-6">
            <Toaster />

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Case Studies</h2>
                    <p className="text-muted-foreground">Document and showcase your client success stories.</p>
                </div>
                <div className="flex gap-4 items-center">
                    {/* Filters */}
                    <div className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-muted-foreground" />
                        <select
                            className="h-8 rounded-md border border-input bg-background px-2 py-1 text-sm bg-muted/20"
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                        >
                            <option value="">All Status</option>
                            <option value="draft">Draft</option>
                            <option value="published">Published</option>
                            <option value="archived">Archived</option>
                        </select>
                        {uniqueIndustries.length > 0 && (
                            <select
                                className="h-8 rounded-md border border-input bg-background px-2 py-1 text-sm bg-muted/20"
                                value={filterIndustry}
                                onChange={(e) => setFilterIndustry(e.target.value)}
                            >
                                <option value="">All Industries</option>
                                {uniqueIndustries.map((industry) => (
                                    <option key={industry} value={industry!}>{industry}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* View Toggle */}
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
                        New Case Study
                    </Button>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="text-muted-foreground">Loading case studies...</div>
                </div>
            ) : caseStudies.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg text-muted-foreground">
                    <BookOpen className="h-12 w-12 mb-4 opacity-50" />
                    <p>No case studies yet. Start documenting your success stories!</p>
                </div>
            ) : viewMode === 'card' ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {caseStudies.map((caseStudy) => (
                        <div
                            key={caseStudy.id}
                            className="group relative flex flex-col rounded-xl border bg-card p-6 shadow-sm transition-all hover:shadow-md"
                        >
                            <div className="space-y-4">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1 flex-1 min-w-0">
                                        <h3 className="font-semibold leading-none tracking-tight truncate">{caseStudy.title}</h3>
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Building2 className="h-3.5 w-3.5" />
                                            <span className="truncate">{caseStudy.clientName}</span>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                        <button
                                            onClick={() => handleOpenModal(caseStudy)}
                                            className="text-muted-foreground hover:text-primary"
                                            title="Edit"
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(caseStudy.id)}
                                            className="text-muted-foreground hover:text-red-500"
                                            title="Delete"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    {getStatusBadge(caseStudy.status)}
                                    {caseStudy.industry && (
                                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                            {caseStudy.industry}
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <div className="flex items-start gap-2">
                                        <Target className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                                        <p className="text-sm text-muted-foreground line-clamp-2">{caseStudy.challenge}</p>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                                        <p className="text-sm text-muted-foreground line-clamp-2">{caseStudy.solution}</p>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <TrendingUp className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                                        <p className="text-sm text-muted-foreground line-clamp-2">{caseStudy.results}</p>
                                    </div>
                                </div>

                                {caseStudy.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 pt-2">
                                        {caseStudy.tags.slice(0, 3).map((tag, i) => (
                                            <span
                                                key={i}
                                                className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full"
                                            >
                                                {tag}
                                            </span>
                                        ))}
                                        {caseStudy.tags.length > 3 && (
                                            <span className="text-xs text-muted-foreground">
                                                +{caseStudy.tags.length - 3} more
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="space-y-3">
                    {caseStudies.map((caseStudy) => (
                        <div
                            key={caseStudy.id}
                            className="group flex items-center justify-between p-4 rounded-lg border bg-card shadow-sm hover:shadow-md transition-all"
                        >
                            <div className="flex-1 min-w-0 mr-6">
                                <div className="flex items-center gap-3 mb-1">
                                    <h3 className="font-semibold truncate text-base">{caseStudy.title}</h3>
                                    {getStatusBadge(caseStudy.status)}
                                    {caseStudy.industry && (
                                        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full shrink-0">
                                            {caseStudy.industry}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                        <Building2 className="h-3.5 w-3.5" />
                                        {caseStudy.clientName}
                                    </span>
                                    <span className="truncate max-w-md">{caseStudy.challenge}</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-primary"
                                    onClick={() => handleOpenModal(caseStudy)}
                                    title="Edit"
                                >
                                    <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-red-500"
                                    onClick={() => handleDelete(caseStudy.id)}
                                    title="Delete"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create/Edit Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="w-full max-w-2xl rounded-xl bg-background p-6 shadow-2xl border border-border animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between mb-6 shrink-0">
                            <h2 className="text-xl font-bold text-foreground">
                                {currentCaseStudy ? "Edit Case Study" : "New Case Study"}
                            </h2>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-muted-foreground hover:text-foreground"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4 flex-1 overflow-y-auto pr-2">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="title">Title *</Label>
                                    <Input
                                        id="title"
                                        placeholder="e.g., Cloud Migration Success"
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="clientName">Client Name *</Label>
                                    <Input
                                        id="clientName"
                                        placeholder="e.g., Acme Corporation"
                                        value={formData.clientName}
                                        onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="industry">Industry</Label>
                                    <Input
                                        id="industry"
                                        placeholder="e.g., Healthcare, Finance"
                                        value={formData.industry}
                                        onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="status">Status</Label>
                                    <select
                                        id="status"
                                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none"
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value as "draft" | "published" | "archived" })}
                                    >
                                        <option value="draft">Draft</option>
                                        <option value="published">Published</option>
                                        <option value="archived">Archived</option>
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="challenge" className="flex items-center gap-2">
                                    <Target className="h-4 w-4 text-red-500" />
                                    Challenge *
                                </Label>
                                <Textarea
                                    id="challenge"
                                    placeholder="Describe the client's challenge or problem..."
                                    className="min-h-[80px]"
                                    value={formData.challenge}
                                    onChange={(e) => setFormData({ ...formData, challenge: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="solution" className="flex items-center gap-2">
                                    <Lightbulb className="h-4 w-4 text-amber-500" />
                                    Solution *
                                </Label>
                                <Textarea
                                    id="solution"
                                    placeholder="Describe the solution you provided..."
                                    className="min-h-[80px]"
                                    value={formData.solution}
                                    onChange={(e) => setFormData({ ...formData, solution: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="results" className="flex items-center gap-2">
                                    <TrendingUp className="h-4 w-4 text-green-500" />
                                    Results *
                                </Label>
                                <Textarea
                                    id="results"
                                    placeholder="Describe the outcomes and measurable results..."
                                    className="min-h-[80px]"
                                    value={formData.results}
                                    onChange={(e) => setFormData({ ...formData, results: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="testimonial" className="flex items-center gap-2">
                                    <Quote className="h-4 w-4 text-blue-500" />
                                    Testimonial
                                </Label>
                                <Textarea
                                    id="testimonial"
                                    placeholder="Client quote or testimonial (optional)..."
                                    className="min-h-[60px]"
                                    value={formData.testimonial}
                                    onChange={(e) => setFormData({ ...formData, testimonial: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="tags">Tags (comma separated)</Label>
                                <Input
                                    id="tags"
                                    placeholder="e.g., Cloud, Migration, AWS"
                                    value={tagsInputValue}
                                    onChange={(e) => {
                                        setTagsInputValue(e.target.value);
                                        setFormData({
                                            ...formData,
                                            tags: e.target.value.split(',').map(t => t.trim()).filter(Boolean)
                                        });
                                    }}
                                />
                            </div>
                        </div>

                        <div className="mt-6 flex justify-end gap-3 shrink-0 pt-4 border-t">
                            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button onClick={handleSave}>
                                {currentCaseStudy ? "Update" : "Create"} Case Study
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
