"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import toast, { Toaster } from "react-hot-toast";
import { useSettings } from "@/contexts/SettingsContext";
import { useAuthors } from "@/contexts/AuthorsContext";
import {
    ArrowLeft,
    ArrowRight,
    Building2,
    Sparkles,
    Lightbulb,
    Check,
    X,
    Plus,
    Loader2,
    CheckCircle2,
    BrainCircuit,
    Target,
} from "lucide-react";

interface GeneratedIdea {
    title: string;
    description: string;
    tags: string[];
    suggestedPostShape?: string;
    suggestedEffortLevel?: string;
    selected: boolean;
}

export default function GenerateIdeasPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { settings, refreshSettings } = useSettings();
    const { authors } = useAuthors();

    // Wizard step
    const [step, setStep] = useState(1);
    const totalSteps = 5;

    // Step 1: Business Profile
    const [companyName, setCompanyName] = useState("");
    const [companyDescription, setCompanyDescription] = useState("");
    const [industry, setIndustry] = useState("");
    const [expertiseAreas, setExpertiseAreas] = useState<string[]>([]);
    const [newExpertise, setNewExpertise] = useState("");

    // Step 2: Content Pillars
    const [pillars, setPillars] = useState<string[]>([]);
    const [newPillar, setNewPillar] = useState("");
    const [suggestingPillars, setSuggestingPillars] = useState(false);

    // Step 3: Audience & Tone
    const [targetAudience, setTargetAudience] = useState("");
    const [audiencePainPoints, setAudiencePainPoints] = useState("");
    const [toneOverride, setToneOverride] = useState("");
    const [authorUrn, setAuthorUrn] = useState("");

    // Step 4: Generate Ideas
    const [ideaCount, setIdeaCount] = useState(5);
    const [batchTheme, setBatchTheme] = useState("");
    const [trendingTopics, setTrendingTopics] = useState("");
    const [generatedIdeas, setGeneratedIdeas] = useState<GeneratedIdea[]>([]);
    const [generatingIdeas, setGeneratingIdeas] = useState(false);

    // Step 5: Save
    const [saving, setSaving] = useState(false);

    // Existing ideas for deduplication
    const [existingIdeaTitles, setExistingIdeaTitles] = useState<string[]>([]);

    // Pre-fill from settings
    useEffect(() => {
        if (settings.companyName) setCompanyName(settings.companyName);
        if (settings.companyDescription) setCompanyDescription(settings.companyDescription);
        if (settings.industry) setIndustry(settings.industry);
        if (settings.expertiseAreas && settings.expertiseAreas.length > 0) {
            setExpertiseAreas(settings.expertiseAreas);
        }
        if (settings.contentPillars && settings.contentPillars.length > 0) {
            setPillars(settings.contentPillars);
        }
        if (settings.targetAudiences && settings.targetAudiences.length > 0) {
            setTargetAudience(settings.targetAudiences.join(", "));
        }
        if (settings.globalTone) {
            setToneOverride(settings.globalTone);
        }
    }, [settings]);

    // Pre-fill author
    useEffect(() => {
        if (authors.length > 0 && !authorUrn) {
            setAuthorUrn(authors[0].urn);
        }
    }, [authors]);

    // Pre-fill trendingTopics from URL params (from Trends page)
    useEffect(() => {
        const urlTrendingTopics = searchParams.get("trendingTopics");
        if (urlTrendingTopics) {
            setTrendingTopics(urlTrendingTopics);
        }
    }, [searchParams]);

    // Fetch existing ideas for deduplication
    useEffect(() => {
        const fetchExisting = async () => {
            try {
                const res = await api.get("/ideas");
                setExistingIdeaTitles(res.data.map((idea: any) => idea.title));
            } catch (e) {
                // non-critical
            }
        };
        fetchExisting();
    }, []);

    // --- Step 1: Expertise helpers ---
    const handleAddExpertise = () => {
        const trimmed = newExpertise.trim();
        if (!trimmed) return;
        if (expertiseAreas.includes(trimmed)) {
            toast.error("This expertise area already exists");
            return;
        }
        setExpertiseAreas([...expertiseAreas, trimmed]);
        setNewExpertise("");
    };

    const handleRemoveExpertise = (index: number) => {
        setExpertiseAreas(expertiseAreas.filter((_, i) => i !== index));
    };

    // --- Step 2: Pillar helpers ---
    const handleSuggestPillars = async () => {
        if (!companyDescription) {
            toast.error("Business description is required to suggest pillars");
            return;
        }
        setSuggestingPillars(true);
        try {
            const res = await api.post("/ai/suggest-pillars", {
                companyName: companyName || undefined,
                companyDescription,
                industry: industry || undefined,
                expertiseAreas: expertiseAreas.length > 0 ? expertiseAreas : undefined,
            });
            if (res.data.pillars && res.data.pillars.length > 0) {
                setPillars(res.data.pillars);
                toast.success(`Suggested ${res.data.pillars.length} content pillars`);
            } else {
                toast.error("No pillars were suggested. Try adding more details.");
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to suggest pillars");
        } finally {
            setSuggestingPillars(false);
        }
    };

    const handleAddPillar = () => {
        const trimmed = newPillar.trim();
        if (!trimmed) return;
        if (pillars.includes(trimmed)) {
            toast.error("This pillar already exists");
            return;
        }
        setPillars([...pillars, trimmed]);
        setNewPillar("");
    };

    const handleRemovePillar = (index: number) => {
        setPillars(pillars.filter((_, i) => i !== index));
    };

    // --- Step 4: Generate ---
    const handleGenerateIdeas = async () => {
        if (pillars.length === 0) {
            toast.error("Add at least one content pillar first");
            return;
        }
        setGeneratingIdeas(true);
        try {
            const res = await api.post("/ai/generate-ideas", {
                companyName: companyName || undefined,
                industry: industry || undefined,
                companyDescription: companyDescription || undefined,
                expertiseAreas: expertiseAreas.length > 0 ? expertiseAreas : undefined,
                contentPillars: pillars,
                targetAudience: targetAudience || undefined,
                audiencePainPoints: audiencePainPoints || undefined,
                toneOverride: toneOverride || undefined,
                batchTheme: batchTheme || undefined,
                trendingTopics: trendingTopics || undefined,
                count: ideaCount,
                authorUrn: authorUrn || undefined,
                excludeTitles: existingIdeaTitles.length > 0 ? existingIdeaTitles : undefined,
            });
            if (res.data.ideas && res.data.ideas.length > 0) {
                setGeneratedIdeas(res.data.ideas.map((idea: any) => ({ ...idea, selected: true })));
                toast.success(`Generated ${res.data.ideas.length} ideas`);
            } else {
                toast.error("No ideas were generated. Try adjusting your inputs.");
            }
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to generate ideas");
        } finally {
            setGeneratingIdeas(false);
        }
    };

    const toggleIdeaSelection = (index: number) => {
        setGeneratedIdeas(prev =>
            prev.map((idea, i) => i === index ? { ...idea, selected: !idea.selected } : idea)
        );
    };

    const selectedIdeas = generatedIdeas.filter(idea => idea.selected);

    // --- Step 5: Batch Save ---
    const handleSaveIdeas = async () => {
        if (selectedIdeas.length === 0) {
            toast.error("Select at least one idea to save");
            return;
        }
        setSaving(true);

        const selectedAuthor = authors.find(a => a.urn === authorUrn);
        const defaultAuthorUrn = authorUrn || (authors.length > 0 ? authors[0].urn : "");
        const defaultAuthorName = selectedAuthor?.name || (authors.length > 0 ? authors[0].name : "");

        try {
            const payload = {
                ideas: selectedIdeas.map(idea => ({
                    title: idea.title,
                    description: idea.description,
                    tags: idea.tags || [],
                    postShape: idea.suggestedPostShape || "auto",
                    effortLevel: idea.suggestedEffortLevel || "\u{1F9E0} Medium",
                    targetAudience: targetAudience || undefined,
                    authorUrn: defaultAuthorUrn,
                    authorName: defaultAuthorName,
                })),
            };

            const res = await api.post("/ideas/batch", payload);
            toast.success(`Saved ${res.data.length} ideas to your board`);

            // Persist business profile & pillars to settings
            try {
                await api.post("/settings", {
                    companyName: companyName || undefined,
                    companyDescription: companyDescription || undefined,
                    industry: industry || undefined,
                    contentPillars: pillars.length > 0 ? pillars : undefined,
                });
                refreshSettings();
            } catch (e) {
                // non-critical
            }

            setTimeout(() => router.push("/ideas"), 1500);
        } catch (error: any) {
            // Fallback: save individually if batch endpoint not available
            if (error.response?.status === 404) {
                let count = 0;
                for (const idea of selectedIdeas) {
                    try {
                        await api.post("/ideas", {
                            title: idea.title,
                            description: idea.description,
                            tags: idea.tags || [],
                            isRecurring: false,
                            authorUrn: defaultAuthorUrn,
                            authorName: defaultAuthorName,
                            targetAudience: targetAudience || undefined,
                            postShape: idea.suggestedPostShape || "auto",
                            effortLevel: idea.suggestedEffortLevel || "\u{1F9E0} Medium",
                        });
                        count++;
                    } catch (err) {
                        console.error(`Failed to save idea: ${idea.title}`, err);
                    }
                }
                if (count > 0) {
                    toast.success(`Saved ${count} ideas to your board`);
                    try {
                        await api.post("/settings", {
                            companyName: companyName || undefined,
                            companyDescription: companyDescription || undefined,
                            industry: industry || undefined,
                            contentPillars: pillars.length > 0 ? pillars : undefined,
                        });
                        refreshSettings();
                    } catch (e) { /* non-critical */ }
                    setTimeout(() => router.push("/ideas"), 1500);
                } else {
                    toast.error("Failed to save any ideas");
                }
            } else {
                toast.error(error.response?.data?.error || "Failed to save ideas");
            }
        } finally {
            setSaving(false);
        }
    };

    const canProceed = () => {
        switch (step) {
            case 1: return companyName.trim().length > 0 && companyDescription.trim().length > 0;
            case 2: return pillars.length > 0;
            case 3: return true; // audience & tone are optional
            case 4: return generatedIdeas.length > 0;
            case 5: return selectedIdeas.length > 0;
            default: return false;
        }
    };

    const handleNext = () => {
        if (step < totalSteps) setStep(step + 1);
    };

    const handleBack = () => {
        if (step > 1) setStep(step - 1);
    };

    const stepLabels = ["Profile", "Pillars", "Audience", "Generate", "Review & Save"];

    return (
        <div className="container max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
            <Toaster />

            {/* Header */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => router.push("/ideas")}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Ideas
                </Button>
            </div>

            <div className="flex flex-col gap-2">
                <h2 className="text-3xl font-bold tracking-tight">Generate New Ideas</h2>
                <p className="text-muted-foreground">
                    Use AI to brainstorm content ideas based on your business profile and content pillars.
                </p>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((s) => (
                    <div key={s} className="flex items-center gap-2">
                        <div
                            className={`flex items-center justify-center h-8 w-8 rounded-full text-sm font-medium transition-colors ${
                                s < step
                                    ? "bg-indigo-600 text-white"
                                    : s === step
                                    ? "bg-indigo-100 text-indigo-700 border-2 border-indigo-600"
                                    : "bg-slate-100 text-slate-400"
                            }`}
                        >
                            {s < step ? <Check className="h-4 w-4" /> : s}
                        </div>
                        <span className={`text-sm hidden sm:inline ${s === step ? "font-medium text-slate-900" : "text-slate-400"}`}>
                            {stepLabels[s - 1]}
                        </span>
                        {s < 5 && <div className={`h-px w-6 ${s < step ? "bg-indigo-600" : "bg-slate-200"}`} />}
                    </div>
                ))}
            </div>

            {/* Step 1: Business Profile */}
            {step === 1 && (
                <Card className="overflow-hidden border-slate-200">
                    <CardHeader className="bg-slate-50/50 border-b">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white rounded-lg border shadow-sm">
                                <Building2 className="h-5 w-5 text-emerald-600" />
                            </div>
                            <div>
                                <CardTitle>Business Profile</CardTitle>
                                <CardDescription>Tell the AI about your business to generate relevant content ideas.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="companyName">Company / Brand Name *</Label>
                                <Input
                                    id="companyName"
                                    value={companyName}
                                    onChange={(e) => setCompanyName(e.target.value)}
                                    placeholder="Acme Corp"
                                    className="bg-slate-50/30"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="industry">Industry</Label>
                                <Input
                                    id="industry"
                                    value={industry}
                                    onChange={(e) => setIndustry(e.target.value)}
                                    placeholder="e.g., SaaS, Fintech, Healthcare"
                                    className="bg-slate-50/30"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="companyDescription">Business Description *</Label>
                            <Textarea
                                id="companyDescription"
                                value={companyDescription}
                                onChange={(e) => setCompanyDescription(e.target.value)}
                                placeholder="Describe what your business does, your unique value proposition, and what makes you stand out..."
                                className="min-h-[120px] bg-slate-50/30"
                            />
                        </div>

                        {/* Expertise Areas */}
                        <div className="space-y-3">
                            <Label>Expertise / Focus Areas</Label>
                            {expertiseAreas.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    {expertiseAreas.map((area, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium"
                                        >
                                            {area}
                                            <button
                                                onClick={() => handleRemoveExpertise(index)}
                                                className="text-emerald-400 hover:text-emerald-700 transition-colors"
                                            >
                                                <X className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <div className="flex gap-2">
                                <Input
                                    value={newExpertise}
                                    onChange={(e) => setNewExpertise(e.target.value)}
                                    placeholder="e.g., Cloud Architecture, DevOps, AI/ML"
                                    className="bg-slate-50/30"
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            handleAddExpertise();
                                        }
                                    }}
                                />
                                <Button variant="outline" onClick={handleAddExpertise} disabled={!newExpertise.trim()}>
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Key topics or domains your business specializes in. These help shape more targeted content ideas.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Step 2: Content Pillars */}
            {step === 2 && (
                <Card className="overflow-hidden border-slate-200">
                    <CardHeader className="bg-slate-50/50 border-b">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white rounded-lg border shadow-sm">
                                <BrainCircuit className="h-5 w-5 text-indigo-600" />
                            </div>
                            <div>
                                <CardTitle>Content Pillars</CardTitle>
                                <CardDescription>
                                    Define the core themes your content will revolve around. Let AI suggest them or add your own.
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                        <div className="flex gap-3">
                            <Button
                                onClick={handleSuggestPillars}
                                disabled={suggestingPillars || !companyDescription}
                                className="bg-indigo-600 hover:bg-indigo-700"
                            >
                                {suggestingPillars ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Suggesting...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="mr-2 h-4 w-4" />
                                        Suggest with AI
                                    </>
                                )}
                            </Button>
                            {pillars.length > 0 && (
                                <p className="text-sm text-muted-foreground self-center">
                                    {pillars.length} pillars defined
                                </p>
                            )}
                        </div>

                        {pillars.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {pillars.map((pillar, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm font-medium"
                                    >
                                        {pillar}
                                        <button
                                            onClick={() => handleRemovePillar(index)}
                                            className="text-indigo-400 hover:text-indigo-700 transition-colors"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className="flex gap-2">
                            <Input
                                value={newPillar}
                                onChange={(e) => setNewPillar(e.target.value)}
                                placeholder="Add a custom pillar..."
                                className="bg-slate-50/30"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleAddPillar();
                                    }
                                }}
                            />
                            <Button variant="outline" onClick={handleAddPillar} disabled={!newPillar.trim()}>
                                <Plus className="h-4 w-4" />
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Content pillars are the core themes your posts will be about. Good pillars are specific enough to guide writing but broad enough to generate many ideas.
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Step 3: Audience & Tone */}
            {step === 3 && (
                <Card className="overflow-hidden border-slate-200">
                    <CardHeader className="bg-slate-50/50 border-b">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white rounded-lg border shadow-sm">
                                <Target className="h-5 w-5 text-fuchsia-600" />
                            </div>
                            <div>
                                <CardTitle>Audience & Tone</CardTitle>
                                <CardDescription>
                                    Fine-tune who you are writing for and how the content should sound. All fields are optional.
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="targetAudience">Target Audience</Label>
                                <Input
                                    id="targetAudience"
                                    value={targetAudience}
                                    onChange={(e) => setTargetAudience(e.target.value)}
                                    placeholder="e.g., CTOs, Startup Founders, DevOps Engineers"
                                    className="bg-slate-50/30"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Pre-filled from your global audience settings if configured.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="authorUrn">Post As</Label>
                                <select
                                    id="authorUrn"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none"
                                    value={authorUrn}
                                    onChange={(e) => setAuthorUrn(e.target.value)}
                                >
                                    {authors.map((author) => (
                                        <option key={author.urn} value={author.urn}>
                                            {author.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="audiencePainPoints">Audience Pain Points</Label>
                            <Textarea
                                id="audiencePainPoints"
                                value={audiencePainPoints}
                                onChange={(e) => setAudiencePainPoints(e.target.value)}
                                placeholder="What challenges or frustrations does your audience face? e.g., scaling infrastructure, hiring senior engineers, reducing cloud costs..."
                                className="min-h-[80px] bg-slate-50/30"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="toneOverride">Tone / Voice Override</Label>
                            <Textarea
                                id="toneOverride"
                                value={toneOverride}
                                onChange={(e) => setToneOverride(e.target.value)}
                                placeholder="e.g., Authoritative but approachable, data-driven, witty..."
                                className="min-h-[80px] bg-slate-50/30"
                            />
                            <p className="text-xs text-muted-foreground">
                                Leave blank to use your global brand voice from Settings.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Step 4: Generate Ideas */}
            {step === 4 && (
                <Card className="overflow-hidden border-slate-200">
                    <CardHeader className="bg-slate-50/50 border-b">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white rounded-lg border shadow-sm">
                                <Lightbulb className="h-5 w-5 text-amber-500" />
                            </div>
                            <div>
                                <CardTitle>Generate Ideas</CardTitle>
                                <CardDescription>
                                    AI will create content ideas based on your profile, pillars, and audience.
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="ideaCount">Number of Ideas</Label>
                                <select
                                    id="ideaCount"
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none"
                                    value={ideaCount}
                                    onChange={(e) => setIdeaCount(parseInt(e.target.value))}
                                >
                                    <option value={3}>3 ideas</option>
                                    <option value={5}>5 ideas</option>
                                    <option value={7}>7 ideas</option>
                                    <option value={10}>10 ideas</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="batchTheme">Batch Theme (optional)</Label>
                                <Input
                                    id="batchTheme"
                                    value={batchTheme}
                                    onChange={(e) => setBatchTheme(e.target.value)}
                                    placeholder="e.g., Q1 product launch, Year-end recap"
                                    className="bg-slate-50/30"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="trendingTopics">Trending Topics (optional, comma-separated)</Label>
                            <Input
                                id="trendingTopics"
                                value={trendingTopics}
                                onChange={(e) => setTrendingTopics(e.target.value)}
                                placeholder="e.g., AI Agents, MCP Protocol, Vibe Coding"
                                className="bg-slate-50/30"
                            />
                            <p className="text-xs text-muted-foreground">
                                Include current trends to make ideas more timely and relevant.
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <Button
                                onClick={handleGenerateIdeas}
                                disabled={generatingIdeas}
                                className="bg-indigo-600 hover:bg-indigo-700"
                            >
                                {generatingIdeas ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="mr-2 h-4 w-4" />
                                        {generatedIdeas.length > 0 ? "Regenerate" : "Generate Ideas"}
                                    </>
                                )}
                            </Button>
                            {existingIdeaTitles.length > 0 && (
                                <p className="text-xs text-muted-foreground self-center">
                                    {existingIdeaTitles.length} existing ideas will be excluded for deduplication.
                                </p>
                            )}
                        </div>

                        {generatedIdeas.length > 0 && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm font-medium text-slate-700">
                                        {generatedIdeas.length} ideas generated &middot; {selectedIdeas.length} selected
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        Click to select/deselect ideas
                                    </p>
                                </div>
                                {generatedIdeas.map((idea, index) => (
                                    <div
                                        key={index}
                                        onClick={() => toggleIdeaSelection(index)}
                                        className={`p-4 rounded-xl border cursor-pointer transition-all ${
                                            idea.selected
                                                ? "bg-indigo-50/50 border-indigo-200 shadow-sm"
                                                : "bg-slate-50/50 border-slate-200 opacity-60"
                                        }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div className={`mt-0.5 flex items-center justify-center h-5 w-5 rounded border shrink-0 transition-colors ${
                                                idea.selected
                                                    ? "bg-indigo-600 border-indigo-600 text-white"
                                                    : "border-slate-300 bg-white"
                                            }`}>
                                                {idea.selected && <Check className="h-3 w-3" />}
                                            </div>
                                            <div className="flex-1 space-y-2">
                                                <div className="flex items-start justify-between gap-2">
                                                    <h4 className="font-semibold text-slate-900 text-sm">{idea.title}</h4>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        {idea.suggestedPostShape && (
                                                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                                                                {idea.suggestedPostShape}
                                                            </span>
                                                        )}
                                                        {idea.suggestedEffortLevel && (
                                                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                                                                {idea.suggestedEffortLevel}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <p className="text-sm text-muted-foreground leading-relaxed">
                                                    {idea.description}
                                                </p>
                                                {idea.tags && idea.tags.length > 0 && (
                                                    <div className="flex flex-wrap gap-1.5">
                                                        {idea.tags.map((tag, tagIdx) => (
                                                            <span
                                                                key={tagIdx}
                                                                className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600"
                                                            >
                                                                {tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {generatedIdeas.length === 0 && !generatingIdeas && (
                            <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg text-muted-foreground">
                                <Lightbulb className="h-10 w-10 mb-3 opacity-30" />
                                <p className="text-sm">Click "Generate Ideas" to get AI-powered content suggestions.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Step 5: Review & Save */}
            {step === 5 && (
                <Card className="overflow-hidden border-slate-200">
                    <CardHeader className="bg-slate-50/50 border-b">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white rounded-lg border shadow-sm">
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                            </div>
                            <div>
                                <CardTitle>Review & Save</CardTitle>
                                <CardDescription>
                                    {selectedIdeas.length} of {generatedIdeas.length} ideas selected. These will be added to your Idea Board.
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        {selectedIdeas.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                                <p className="text-sm">No ideas selected. Go back and select some ideas to save.</p>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-3">
                                    {selectedIdeas.map((idea, index) => (
                                        <div key={index} className="p-4 rounded-xl border border-green-200 bg-green-50/30">
                                            <div className="flex items-start gap-3">
                                                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 shrink-0" />
                                                <div className="flex-1 space-y-1">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <h4 className="font-semibold text-slate-900 text-sm">{idea.title}</h4>
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            {idea.suggestedPostShape && (
                                                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                                                                    {idea.suggestedPostShape}
                                                                </span>
                                                            )}
                                                            {idea.suggestedEffortLevel && (
                                                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                                                                    {idea.suggestedEffortLevel}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">{idea.description}</p>
                                                    {idea.tags && idea.tags.length > 0 && (
                                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                                            {idea.tags.map((tag, tagIdx) => (
                                                                <span
                                                                    key={tagIdx}
                                                                    className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600"
                                                                >
                                                                    {tag}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {saving && (
                                    <div className="flex items-center gap-3 p-3 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 text-sm">
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Saving {selectedIdeas.length} ideas to your board...
                                    </div>
                                )}

                                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-muted-foreground">
                                    <p>Your business profile and content pillars will also be saved to Settings for future use.</p>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-2">
                <Button
                    variant="outline"
                    onClick={handleBack}
                    disabled={step === 1}
                >
                    <ArrowLeft className="mr-2 h-4 w-4" />
                    Back
                </Button>

                <div className="flex gap-3">
                    {step < totalSteps && (
                        <Button
                            onClick={handleNext}
                            disabled={!canProceed()}
                        >
                            Next
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    )}

                    {step === totalSteps && (
                        <Button
                            onClick={handleSaveIdeas}
                            disabled={saving || selectedIdeas.length === 0}
                            className="bg-indigo-600 hover:bg-indigo-700 px-8"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                    Save {selectedIdeas.length} Ideas
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
