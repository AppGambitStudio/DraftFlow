"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import toast, { Toaster } from "react-hot-toast";
import {
    Presentation, Loader2, Download, ArrowRight, RefreshCw,
    ChevronLeft, ChevronRight, Search, ChevronDown, ChevronUp,
    User, Save, Trash2, FileText,
} from "lucide-react";

interface CarouselTemplate {
    key: string;
    name: string;
    description: string;
    icon: string;
}

interface SavedCarousel {
    id: number;
    title: string;
    content: string;
    template: string;
    slideCount: number;
    pdfUrl: string;
    fileName: string;
    fileSize: number;
    createdAt: string;
}

export default function CarouselsPage() {
    const router = useRouter();
    const [templates, setTemplates] = useState<CarouselTemplate[]>([]);
    const [content, setContent] = useState("");
    const [selectedTemplate, setSelectedTemplate] = useState("step-guide");
    const [slideCount, setSlideCount] = useState(5);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<{
        pdfUrl: string;
        html: string;
        name: string;
        type: string;
        size: number;
        slideCount: number;
    } | null>(null);
    const [currentSlide, setCurrentSlide] = useState(0);
    const [additionalComments, setAdditionalComments] = useState("");
    const [showBranding, setShowBranding] = useState(false);
    const [branding, setBranding] = useState({
        name: "",
        handle: "",
        tagline: "",
        cta: "",
    });
    const [savedCarousels, setSavedCarousels] = useState<SavedCarousel[]>([]);
    const [showSaved, setShowSaved] = useState(false);
    const [saveTitle, setSaveTitle] = useState("");
    const [showSaveInput, setShowSaveInput] = useState(false);

    useEffect(() => {
        api.get("/ai/carousel-builder/templates")
            .then((res) => setTemplates(res.data.templates))
            .catch(() => {});

        api.get("/ai/carousel-builder/branding")
            .then((res) => {
                setBranding(res.data);
                if (res.data.name || res.data.handle || res.data.tagline || res.data.cta) {
                    setShowBranding(true);
                }
            })
            .catch(() => {});

        loadSavedCarousels();
    }, []);

    const loadSavedCarousels = () => {
        api.get("/ai/carousel-builder/saved")
            .then((res) => setSavedCarousels(res.data))
            .catch(() => {});
    };

    const updateBranding = (field: string, value: string) => {
        setBranding({ ...branding, [field]: value });
    };

    const saveBranding = () => {
        api.put("/ai/carousel-builder/branding", branding)
            .then(() => toast.success("Branding saved"))
            .catch(() => toast.error("Failed to save branding"));
    };

    const handleGenerate = async (withResearch: boolean = false) => {
        if (!content.trim()) {
            toast.error("Please enter content for the carousel");
            return;
        }
        setLoading(true);
        setResult(null);
        setCurrentSlide(0);
        try {
            const endpoint = withResearch
                ? "/ai/carousel-builder/research"
                : "/ai/carousel-builder";
            const hasBranding = branding.name || branding.handle || branding.tagline || branding.cta;
            const res = await api.post(endpoint, {
                content,
                template: selectedTemplate,
                slideCount,
                additionalComments: additionalComments.trim() || undefined,
                branding: hasBranding ? branding : undefined,
            });
            setResult(res.data);
            toast.success(`Carousel generated (${res.data.slideCount} slides)`);
        } catch (err: any) {
            toast.error(err.response?.data?.error || "Failed to generate carousel");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!result || !saveTitle.trim()) {
            toast.error("Please enter a title");
            return;
        }
        try {
            await api.post("/ai/carousel-builder/save", {
                title: saveTitle.trim(),
                content,
                template: selectedTemplate,
                slideCount: result.slideCount,
                pdfUrl: result.pdfUrl,
                fileName: result.name,
                fileSize: result.size,
            });
            toast.success("Carousel saved");
            setSaveTitle("");
            setShowSaveInput(false);
            loadSavedCarousels();
        } catch {
            toast.error("Failed to save carousel");
        }
    };

    const handleDeleteSaved = async (id: number) => {
        try {
            await api.delete(`/ai/carousel-builder/saved/${id}`);
            toast.success("Deleted");
            setSavedCarousels((prev) => prev.filter((c) => c.id !== id));
        } catch {
            toast.error("Failed to delete");
        }
    };

    const handleUseSaved = (carousel: SavedCarousel) => {
        localStorage.setItem(
            "draftPostAttachments",
            JSON.stringify([{
                url: carousel.pdfUrl,
                name: carousel.fileName,
                type: "application/pdf",
                size: carousel.fileSize,
            }])
        );
        localStorage.setItem("draftPostContent", carousel.content);
        router.push("/create?source=carousel");
    };

    const handleCreatePost = () => {
        if (!result) return;
        localStorage.setItem(
            "draftPostAttachments",
            JSON.stringify([{
                url: result.pdfUrl,
                name: result.name,
                type: result.type,
                size: result.size,
            }])
        );
        localStorage.setItem("draftPostContent", content);
        router.push("/create?source=carousel");
    };

    const handleDownload = () => {
        if (!result) return;
        const baseUrl = `http://${window.location.hostname}:5002`;
        const link = document.createElement("a");
        link.href = `${baseUrl}${result.pdfUrl}`;
        link.download = result.name;
        link.click();
    };

    const formatDate = (d: string) => {
        const date = new Date(d);
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };

    const slideCountOptions = [3, 5, 7, 10];

    return (
        <div className="min-h-screen bg-slate-50">
            <Toaster position="top-right" />

            {/* Header */}
            <div className="border-b bg-white px-8 py-6">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3">
                            <Presentation className="h-6 w-6 text-blue-600" />
                            <h1 className="text-2xl font-bold text-slate-900">Carousel Builder</h1>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                            Generate multi-slide PDF carousels for LinkedIn. Carousels get 3-5x more engagement than text posts.
                        </p>
                    </div>
                    {savedCarousels.length > 0 && (
                        <button
                            onClick={() => setShowSaved(!showSaved)}
                            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
                                showSaved
                                    ? "border-blue-500 bg-blue-50 text-blue-700"
                                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                            }`}
                        >
                            <FileText className="h-4 w-4" />
                            Saved ({savedCarousels.length})
                        </button>
                    )}
                </div>
            </div>

            <div className="mx-auto max-w-5xl px-8 py-8">
                {/* Saved Carousels */}
                {showSaved && savedCarousels.length > 0 && (
                    <div className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
                        <h2 className="mb-4 text-sm font-semibold text-slate-900">Saved Carousels</h2>
                        <div className="space-y-2">
                            {savedCarousels.map((c) => (
                                <div
                                    key={c.id}
                                    className="flex items-center justify-between rounded-lg border border-slate-100 p-3 hover:bg-slate-50"
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-medium text-slate-900 truncate">
                                                {c.title}
                                            </span>
                                            <span className="flex-shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                                                {c.slideCount} slides
                                            </span>
                                            <span className="flex-shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                                                {c.template}
                                            </span>
                                        </div>
                                        <p className="mt-0.5 text-xs text-slate-400 truncate">
                                            {c.content.substring(0, 100)}{c.content.length > 100 ? "..." : ""} &middot; {formatDate(c.createdAt)}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 ml-4">
                                        <a
                                            href={`http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:5002${c.pdfUrl}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                                            title="View PDF"
                                        >
                                            <Download className="h-4 w-4" />
                                        </a>
                                        <button
                                            onClick={() => handleUseSaved(c)}
                                            className="flex items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                                        >
                                            Create Post
                                            <ArrowRight className="h-3 w-3" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteSaved(c.id)}
                                            className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                                            title="Delete"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Input Section */}
                <div className="rounded-xl border bg-white p-6 shadow-sm">
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                        Content / Topic
                    </label>
                    <textarea
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        placeholder="Paste your post content, or describe a topic for the carousel (e.g., '5 tips for writing better LinkedIn posts')"
                        className="w-full rounded-lg border border-slate-200 p-4 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        rows={5}
                    />

                    {/* Template Selection */}
                    <div className="mt-6">
                        <label className="mb-3 block text-sm font-semibold text-slate-700">
                            Template
                        </label>
                        <div className="grid grid-cols-5 gap-3">
                            {templates.map((t) => (
                                <button
                                    key={t.key}
                                    onClick={() => setSelectedTemplate(t.key)}
                                    className={`rounded-lg border p-3 text-left transition-all ${
                                        selectedTemplate === t.key
                                            ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500"
                                            : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                                    }`}
                                >
                                    <div className="text-xl">{t.icon}</div>
                                    <div className="mt-1 text-xs font-semibold text-slate-900">
                                        {t.name}
                                    </div>
                                    <div className="mt-0.5 text-[10px] text-slate-500 line-clamp-2">
                                        {t.description}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Branding (collapsible) */}
                    <div className="mt-6">
                        <button
                            onClick={() => setShowBranding(!showBranding)}
                            className="flex items-center gap-2 text-sm font-semibold text-slate-700 hover:text-slate-900"
                        >
                            <User className="h-4 w-4" />
                            Branding
                            {showBranding ? (
                                <ChevronUp className="h-3.5 w-3.5 text-slate-400" />
                            ) : (
                                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                            )}
                            {!showBranding && (branding.name || branding.handle) && (
                                <span className="text-xs font-normal text-slate-400">
                                    ({branding.name || branding.handle})
                                </span>
                            )}
                        </button>
                        {showBranding && (
                            <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-slate-500">Name</label>
                                        <input type="text" value={branding.name} onChange={(e) => updateBranding("name", e.target.value)} placeholder="John Doe" className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-slate-500">Handle / URL</label>
                                        <input type="text" value={branding.handle} onChange={(e) => updateBranding("handle", e.target.value)} placeholder="@johndoe or linkedin.com/in/johndoe" className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-slate-500">Tagline</label>
                                        <input type="text" value={branding.tagline} onChange={(e) => updateBranding("tagline", e.target.value)} placeholder="Cloud Architect | AWS Community Builder" className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none" />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs font-medium text-slate-500">CTA (last slide)</label>
                                        <input type="text" value={branding.cta} onChange={(e) => updateBranding("cta", e.target.value)} placeholder="Follow me for daily AWS tips" className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none" />
                                    </div>
                                </div>
                                <div className="mt-3 flex justify-end">
                                    <button onClick={saveBranding} className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800">
                                        Save Branding
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Slide Count + Generate */}
                    <div className="mt-6 flex items-end gap-4">
                        <div>
                            <label className="mb-2 block text-sm font-semibold text-slate-700">Slides</label>
                            <div className="flex gap-2">
                                {slideCountOptions.map((n) => (
                                    <button
                                        key={n}
                                        onClick={() => setSlideCount(n)}
                                        className={`rounded-lg border px-4 py-2 text-sm font-medium transition-all ${
                                            slideCount === n
                                                ? "border-blue-500 bg-blue-50 text-blue-700"
                                                : "border-slate-200 text-slate-600 hover:border-slate-300"
                                        }`}
                                    >
                                        {n}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="flex-1" />
                        <button
                            onClick={() => handleGenerate(true)}
                            disabled={loading || !content.trim()}
                            className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-5 py-2.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                            Research & Generate
                        </button>
                        <button
                            onClick={() => handleGenerate(false)}
                            disabled={loading || !content.trim()}
                            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Presentation className="h-4 w-4" />}
                            Generate
                        </button>
                    </div>
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="mt-8 flex flex-col items-center justify-center rounded-xl border bg-white p-16 shadow-sm">
                        <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                        <p className="mt-4 text-sm font-medium text-slate-600">Generating {slideCount}-slide carousel...</p>
                        <p className="mt-1 text-xs text-slate-400">This may take 15-30 seconds</p>
                    </div>
                )}

                {/* Result Preview */}
                {result && !loading && (
                    <div className="mt-8 rounded-xl border bg-white p-6 shadow-sm">
                        <div className="mb-4 flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-slate-900">Preview</h2>
                            <span className="text-xs text-slate-500">
                                {result.slideCount} slides &middot; {(result.size / 1024).toFixed(0)} KB
                            </span>
                        </div>

                        {/* PDF Preview */}
                        <div className="flex justify-center rounded-lg bg-slate-100 p-4">
                            <iframe
                                src={`http://${typeof window !== 'undefined' ? window.location.hostname : 'localhost'}:5002${result.pdfUrl}`}
                                className="rounded-lg shadow-lg"
                                style={{ width: 800, height: 820 }}
                                title="Carousel Preview"
                            />
                        </div>

                        {/* Additional Comments for Regeneration */}
                        <div className="mt-5">
                            <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                                Additional comments (used on regenerate)
                            </label>
                            <textarea
                                value={additionalComments}
                                onChange={(e) => setAdditionalComments(e.target.value)}
                                placeholder="e.g., Make slide 3 more specific, add AWS CLI commands, use simpler language..."
                                className="w-full rounded-lg border border-slate-200 p-3 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                rows={2}
                            />
                        </div>

                        {/* Actions */}
                        <div className="mt-4 flex items-center justify-center gap-3">
                            <button
                                onClick={() => handleGenerate(false)}
                                className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                            >
                                <RefreshCw className="h-4 w-4" />
                                Regenerate
                            </button>
                            <button
                                onClick={handleDownload}
                                className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                            >
                                <Download className="h-4 w-4" />
                                Download PDF
                            </button>
                            {!showSaveInput ? (
                                <button
                                    onClick={() => setShowSaveInput(true)}
                                    className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
                                >
                                    <Save className="h-4 w-4" />
                                    Save
                                </button>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={saveTitle}
                                        onChange={(e) => setSaveTitle(e.target.value)}
                                        placeholder="Give it a name..."
                                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none w-48"
                                        autoFocus
                                        onKeyDown={(e) => e.key === "Enter" && handleSave()}
                                    />
                                    <button
                                        onClick={handleSave}
                                        disabled={!saveTitle.trim()}
                                        className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                                    >
                                        Save
                                    </button>
                                    <button
                                        onClick={() => { setShowSaveInput(false); setSaveTitle(""); }}
                                        className="text-xs text-slate-400 hover:text-slate-600"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            )}
                            <button
                                onClick={handleCreatePost}
                                className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
                            >
                                Create Post
                                <ArrowRight className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
