"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Sparkles,
    Calendar,
    Lightbulb,
    Presentation,
    Newspaper,
    Users,
    ArrowRight,
    ChevronRight,
    Zap,
    Play,
    RefreshCw,
    Shield,
    FileText,
    Check,
} from "lucide-react";

// Mock drafts for the Interactive Simulator
const INITIAL_DRAFT = `In today's fast-paced digital landscape, it's absolutely critical to double down on your marketing synergy. Trust me, it's a total game changer! 🚀

Leveraging cutting-edge AI technologies will allow you to scale your operations and drive unparalleled efficiency.

What is your experience with this? How do you handle it in your team? Thoughts? Agree or disagree?`;

const CLICHE_CLEANED_DRAFT = `Stop writing generic posts about "synergy" and "game changers".

Most teams don't need to scale their tools — they need to simplify them. Leverage is about focus, not volume.

Here is the simple checklist we use to audit our stack:
1. One tool per department.
2. Direct integration or get rid of it.
3. No licenses for features we "might" use.`;

const DEPTH_ADDED_DRAFT = `Most engineering leaders talk about "adopting AI" without discussing the infrastructure trade-offs.

Here is the real cost breakdown of fine-tuning vs. RAG in production:
• Fine-tuning: High capital cost ($10k+ training runs), static knowledge, but latency is cut by 40%.
• RAG: Low upfront cost, dynamic context, but API round-trip latency increases by 250ms.

If your use case requires sub-100ms response times, RAG alone will fail. You have to hybridize or cache heavily.`;

const HOOKS = [
    "Most startups are wasting $5,000/month on tools they don't use. Here is how to audit your SaaS stack in 10 minutes:",
    "If your response latency is over 200ms, you aren't ready for production AI. Let's talk about the hard trade-offs:",
    "We audits 15 workspaces this quarter. The biggest productivity killer? It wasn't bad code, it was meeting synergy."
];

export function LandingPage() {
    const { user } = useAuth();

    // Simulator State
    const [simulatorText, setSimulatorText] = useState(INITIAL_DRAFT);
    const [activeTab, setActiveTab] = useState<"cliche" | "depth" | "hook" | "original">("original");
    const [isProcessing, setIsProcessing] = useState(false);
    const [progressLabel, setProgressLabel] = useState("");

    // Simulate AI processing
    const runAIAction = (tab: "cliche" | "depth" | "hook" | "original", targetText: string, label: string) => {
        if (activeTab === tab) return;
        setIsProcessing(true);
        setProgressLabel(label);

        setTimeout(() => {
            setSimulatorText(targetText);
            setActiveTab(tab);
            setIsProcessing(false);
        }, 1200);
    };

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 selection:bg-indigo-500 selection:text-white font-sans overflow-x-hidden">
            {/* Background Glows */}
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute top-[600px] right-1/4 w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />

            {/* Header / Navbar */}
            <header className="sticky top-0 z-50 backdrop-blur-md bg-slate-900/80 border-b border-slate-800">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <Sparkles className="h-5 w-5 text-white animate-pulse" />
                        </div>
                        <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-400 bg-clip-text text-transparent">
                            DraftFlow
                        </span>
                    </div>

                    <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-400">
                        <a href="#features" className="hover:text-white transition-colors">Features</a>
                        <a href="#simulator" className="hover:text-white transition-colors">Interactive Demo</a>
                        <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
                        <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
                    </nav>

                    <div className="flex items-center gap-4">
                        {user ? (
                            <Link href="/">
                                <Button className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-600/20 rounded-xl px-5">
                                    Go to Dashboard
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </Button>
                            </Link>
                        ) : (
                            <>
                                <Link href="/login">
                                    <span className="text-sm font-semibold text-slate-300 hover:text-white cursor-pointer transition-colors px-3 py-2">
                                        Sign In
                                    </span>
                                </Link>
                                <Link href="/signup">
                                    <Button className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold shadow-lg shadow-indigo-600/20 rounded-xl px-5">
                                        Get Started
                                    </Button>
                                </Link>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <section className="relative max-w-7xl mx-auto px-6 pt-24 pb-20 text-center flex flex-col items-center">
                {/* Promo Badge */}
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/5 text-indigo-300 text-xs font-semibold mb-8">
                    <span className="flex h-2 w-2 rounded-full bg-indigo-400 animate-ping" />
                    DraftFlow v1.0 is Live
                </div>

                <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white max-w-4xl leading-[1.15] mb-6">
                    Write, refine & schedule LinkedIn posts in{" "}
                    <span className="bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                        your own voice.
                    </span>
                </h1>

                <p className="text-lg md:text-xl text-slate-400 max-w-2xl mb-10 leading-relaxed">
                    Stop posting generic, AI-generated jargon. DraftFlow trains a voice corpus on your historical writing, enforces standard depth criteria, and publishes directly to LinkedIn.
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-4 mb-16">
                    {user ? (
                        <Link href="/">
                            <Button size="lg" className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-base rounded-xl px-8 py-6 shadow-xl shadow-indigo-600/25">
                                Go to Dashboard
                                <ArrowRight className="ml-2.5 h-5 w-5" />
                            </Button>
                        </Link>
                    ) : (
                        <Link href="/signup">
                            <Button size="lg" className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-base rounded-xl px-8 py-6 shadow-xl shadow-indigo-600/25">
                                Create Free Workspace
                                <ChevronRight className="ml-1.5 h-5 w-5" />
                            </Button>
                        </Link>
                    )}
                    <a href="#simulator">
                        <Button size="lg" variant="outline" className="border-slate-700 hover:bg-slate-800 text-slate-200 font-semibold text-base rounded-xl px-8 py-6">
                            <Play className="mr-2 h-4 w-4 text-indigo-400 fill-indigo-400" />
                            Try Interactive Simulator
                        </Button>
                    </a>
                </div>

                {/* Dashboard Screenshot Mock */}
                <div className="w-full max-w-5xl rounded-2xl border border-slate-800 bg-slate-950/40 p-4 backdrop-blur-sm shadow-2xl shadow-indigo-500/5">
                    <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden aspect-[16/9] flex flex-col text-left">
                        {/* Header Bar */}
                        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="h-3.5 w-3.5 rounded-full bg-red-500/20 border border-red-500/40" />
                                <span className="h-3.5 w-3.5 rounded-full bg-yellow-500/20 border border-yellow-500/40" />
                                <span className="h-3.5 w-3.5 rounded-full bg-green-500/20 border border-green-500/40" />
                                <span className="text-xs text-slate-500 ml-4 font-mono">dashboard.draftflow.app/calendar</span>
                            </div>
                            <div className="h-5 w-24 bg-slate-800 rounded-md animate-pulse" />
                        </div>
                        {/* Body Simulator */}
                        <div className="flex-1 grid grid-cols-12 bg-slate-950 p-4 gap-4">
                            <div className="col-span-3 border border-slate-800 rounded-lg p-3 space-y-3 bg-slate-900/50">
                                <div className="h-6 w-3/4 bg-slate-800 rounded-md" />
                                <div className="space-y-2">
                                    <div className="h-4 bg-slate-800/80 rounded w-full" />
                                    <div className="h-4 bg-slate-800/80 rounded w-5/6" />
                                    <div className="h-4 bg-slate-800/80 rounded w-4/5" />
                                </div>
                                <div className="pt-4 border-t border-slate-800 space-y-2">
                                    <div className="h-7 bg-indigo-600/20 border border-indigo-500/30 rounded-md w-full" />
                                    <div className="h-7 bg-slate-800 rounded-md w-full" />
                                    <div className="h-7 bg-slate-800 rounded-md w-full" />
                                </div>
                            </div>
                            <div className="col-span-9 border border-slate-800 rounded-lg p-4 bg-slate-900 flex flex-col justify-between">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-full bg-indigo-900 border border-indigo-700 flex items-center justify-center font-bold text-xs text-indigo-200">
                                                DF
                                            </div>
                                            <div>
                                                <div className="h-4 w-32 bg-slate-800 rounded-md" />
                                                <div className="h-3 w-20 bg-slate-800 rounded mt-1.5" />
                                            </div>
                                        </div>
                                        <div className="h-6 w-20 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-2 py-0.5 rounded-full flex items-center justify-center font-medium">
                                            Scheduled
                                        </div>
                                    </div>
                                    <div className="space-y-2.5 pt-2">
                                        <div className="h-4 bg-slate-800 rounded w-11/12" />
                                        <div className="h-4 bg-slate-800 rounded w-full" />
                                        <div className="h-4 bg-slate-800 rounded w-4/5" />
                                        <div className="h-4 bg-slate-800 rounded w-5/6" />
                                    </div>
                                </div>
                                <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                                    <div className="h-5 w-28 bg-slate-800 rounded" />
                                    <div className="flex gap-2">
                                        <div className="h-8 w-16 bg-slate-800 rounded-md" />
                                        <div className="h-8 w-24 bg-indigo-600 rounded-md" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Interactive Simulator Section */}
            <section id="simulator" className="py-24 border-y border-slate-800 bg-slate-950/30 relative">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4">
                            Interactive Content Simulator
                        </h2>
                        <p className="text-slate-400 text-lg">
                            Experience DraftFlow's intelligent editing engine. Click any helper below to see the AI automatically rewrite boring drafts into high-authority publications.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                        {/* Editor Controls */}
                        <div className="lg:col-span-4 space-y-4 flex flex-col justify-start">
                            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-6">
                                <h3 className="text-sm font-semibold uppercase tracking-wider text-indigo-400">
                                    AI Refinement Tools
                                </h3>

                                <div className="space-y-3">
                                    <button
                                        onClick={() => runAIAction("original", INITIAL_DRAFT, "Restoring original draft...")}
                                        className={`w-full flex items-center justify-between p-3 rounded-lg border text-left text-sm font-medium transition-all ${
                                            activeTab === "original"
                                                ? "bg-slate-800 border-slate-700 text-white"
                                                : "bg-transparent border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white"
                                        }`}
                                    >
                                        <span>Show Default Draft</span>
                                        <FileText className="h-4.5 w-4.5 text-slate-500" />
                                    </button>

                                    <button
                                        onClick={() => runAIAction("cliche", CLICHE_CLEANED_DRAFT, "Scanning for cliches and fluff...")}
                                        className={`w-full flex items-center justify-between p-3 rounded-lg border text-left text-sm font-medium transition-all ${
                                            activeTab === "cliche"
                                                ? "bg-indigo-600/10 border-indigo-500/40 text-indigo-300"
                                                : "bg-transparent border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white"
                                        }`}
                                    >
                                        <div className="flex flex-col">
                                            <span>Clean Buzzwords</span>
                                            <span className="text-[10px] text-slate-500 font-normal">Remove "Game Changer", "Synergy", etc.</span>
                                        </div>
                                        <Zap className="h-4.5 w-4.5 text-indigo-400" />
                                    </button>

                                    <button
                                        onClick={() => runAIAction("depth", DEPTH_ADDED_DRAFT, "Analyzing architectural constraints & costs...")}
                                        className={`w-full flex items-center justify-between p-3 rounded-lg border text-left text-sm font-medium transition-all ${
                                            activeTab === "depth"
                                                ? "bg-indigo-600/10 border-indigo-500/40 text-indigo-300"
                                                : "bg-transparent border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white"
                                        }`}
                                    >
                                        <div className="flex flex-col">
                                            <span>Pass The Depth Bar</span>
                                            <span className="text-[10px] text-slate-500 font-normal">Inject engineering trade-offs</span>
                                        </div>
                                        <Shield className="h-4.5 w-4.5 text-indigo-400" />
                                    </button>

                                    <button
                                        onClick={() => {
                                            const randomHook = HOOKS[Math.floor(Math.random() * HOOKS.length)];
                                            runAIAction("hook", `${randomHook}\n\n${simulatorText.split("\n\n").slice(1).join("\n\n")}`, "Crafting hook templates...");
                                        }}
                                        className={`w-full flex items-center justify-between p-3 rounded-lg border text-left text-sm font-medium transition-all ${
                                            activeTab === "hook"
                                                ? "bg-indigo-600/10 border-indigo-500/40 text-indigo-300"
                                                : "bg-transparent border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white"
                                        }`}
                                    >
                                        <div className="flex flex-col">
                                            <span>Optimize Hook</span>
                                            <span className="text-[10px] text-slate-500 font-normal">Create pattern-interrupt opening</span>
                                        </div>
                                        <Sparkles className="h-4.5 w-4.5 text-indigo-400" />
                                    </button>
                                </div>
                            </div>

                            <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 text-xs text-slate-500">
                                <p className="font-semibold text-slate-400 mb-1">How this works in DraftFlow:</p>
                                When writing inside our editor, the agent runs background audits to catch shallow advice. Your published voice corpus acts as an anchor to keep it sounding exactly like you.
                            </div>
                        </div>

                        {/* Interactive Editor Mock */}
                        <div className="lg:col-span-8 flex flex-col">
                            <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col min-h-[350px]">
                                {/* Editor Header */}
                                <div className="bg-slate-900 border-b border-slate-800 px-4 py-3 flex items-center justify-between text-xs text-slate-400 font-mono">
                                    <div className="flex items-center gap-2">
                                        <span className="h-2 w-2 rounded-full bg-indigo-500" />
                                        <span>active_writer.ts</span>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        {isProcessing ? (
                                            <span className="text-indigo-400 flex items-center gap-1.5 animate-pulse">
                                                <RefreshCw className="h-3 w-3 animate-spin" />
                                                {progressLabel}
                                            </span>
                                        ) : (
                                            <span className="text-slate-500">Editor Ready</span>
                                        )}
                                    </div>
                                </div>

                                {/* Editor Text Area */}
                                <div className="flex-1 p-6 font-mono text-sm leading-relaxed text-slate-300 relative select-none">
                                    {isProcessing && (
                                        <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-[1px] flex items-center justify-center z-10">
                                            <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 px-5 py-3 rounded-xl shadow-lg">
                                                <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-700 border-t-indigo-500" />
                                                <span className="text-sm font-semibold text-slate-300">Auditing draft quality...</span>
                                            </div>
                                        </div>
                                    )}
                                    <div className="whitespace-pre-wrap font-sans text-base min-h-[220px]">
                                        {simulatorText}
                                    </div>
                                </div>

                                {/* Editor Actions Bar */}
                                <div className="bg-slate-900/60 border-t border-slate-800 px-5 py-3.5 flex items-center justify-between">
                                    <div className="flex gap-2">
                                        <span className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-300">
                                            Word Count: {simulatorText.split(/\s+/).filter(Boolean).length}
                                        </span>
                                        <span className={`px-2.5 py-1 rounded border text-xs font-semibold ${
                                            activeTab === "depth"
                                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                                                : activeTab === "original"
                                                ? "bg-red-500/10 border-red-500/20 text-red-400"
                                                : "bg-amber-500/10 border-amber-500/20 text-amber-400"
                                        }`}>
                                            Quality Score: {activeTab === "original" ? "D+" : activeTab === "cliche" ? "B" : "A+"}
                                        </span>
                                    </div>

                                    <Link href="/signup">
                                        <Button className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs py-1.5 px-4 rounded-lg shadow-md">
                                            Save Draft
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Core Features Grid */}
            <section id="features" className="py-24 max-w-7xl mx-auto px-6">
                <div className="text-center max-w-3xl mx-auto mb-20">
                    <h2 className="text-4xl font-extrabold text-white mb-4">
                        Everything you need to master LinkedIn content
                    </h2>
                    <p className="text-slate-400 text-lg">
                        DraftFlow brings scheduling, writing reviews, team feedback, and industry trends together in a single workspace.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {/* Feature 1 */}
                    <Card className="bg-slate-900/60 border-slate-800 rounded-2xl hover:border-indigo-500/40 transition-colors shadow-xl group">
                        <CardContent className="p-8 space-y-4">
                            <div className="h-12 w-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                                <Sparkles className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-bold text-white">Voice Corpus Engine</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                Upload or parse your past top LinkedIn posts. DraftFlow models your typical sentence structures, formatting styles, and vocabulary to generate matching drafts.
                            </p>
                        </CardContent>
                    </Card>

                    {/* Feature 2 */}
                    <Card className="bg-slate-900/60 border-slate-800 rounded-2xl hover:border-indigo-500/40 transition-colors shadow-xl group">
                        <CardContent className="p-8 space-y-4">
                            <div className="h-12 w-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                                <Calendar className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-bold text-white">Drag & Drop Calendar</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                Schedule posts visually. Maintain a structured pipeline and track publishing slots across days, weeks, or months to remain highly consistent.
                            </p>
                        </CardContent>
                    </Card>

                    {/* Feature 3 */}
                    <Card className="bg-slate-900/60 border-slate-800 rounded-2xl hover:border-indigo-500/40 transition-colors shadow-xl group">
                        <CardContent className="p-8 space-y-4">
                            <div className="h-12 w-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                                <Lightbulb className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-bold text-white">Idea Board</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                Never hit writer's block. Capture quick content seeds, group them dynamically, and advance them through status lanes from inception to final draft.
                            </p>
                        </CardContent>
                    </Card>

                    {/* Feature 4 */}
                    <Card className="bg-slate-900/60 border-slate-800 rounded-2xl hover:border-indigo-500/40 transition-colors shadow-xl group">
                        <CardContent className="p-8 space-y-4">
                            <div className="h-12 w-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                                <Presentation className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-bold text-white">Carousel Slides Builder</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                Convert standard text into premium PDF carousels directly inside the dashboard. Choose templates, edit layouts, and download slides ready for upload.
                            </p>
                        </CardContent>
                    </Card>

                    {/* Feature 5 */}
                    <Card className="bg-slate-900/60 border-slate-800 rounded-2xl hover:border-indigo-500/40 transition-colors shadow-xl group">
                        <CardContent className="p-8 space-y-4">
                            <div className="h-12 w-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                                <Newspaper className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-bold text-white">RSS & Trends Curation</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                Stay integrated with current industry events. Pull articles and trending announcements directly into the sidebar to write timely, news-driven authority pieces.
                            </p>
                        </CardContent>
                    </Card>

                    {/* Feature 6 */}
                    <Card className="bg-slate-900/60 border-slate-800 rounded-2xl hover:border-indigo-500/40 transition-colors shadow-xl group">
                        <CardContent className="p-8 space-y-4">
                            <div className="h-12 w-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                                <Users className="h-6 w-6" />
                            </div>
                            <h3 className="text-xl font-bold text-white">Workspace Teams</h3>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                Invite clients, editors, or peer reviewers into your custom workspace. Set granular roles, coordinate reviews, and manage multiple author brand streams.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* How It Works Section */}
            <section id="how-it-works" className="py-24 border-t border-slate-800/80 bg-slate-950/20">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center max-w-3xl mx-auto mb-20">
                        <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4">
                            Publishing, streamlined
                        </h2>
                        <p className="text-slate-400 text-lg">
                            An end-to-end framework built explicitly for professional LinkedIn writing.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
                        {/* Connecting Line (Only Desktop) */}
                        <div className="hidden md:block absolute top-16 left-[15%] right-[15%] h-[1px] bg-gradient-to-r from-indigo-500/10 via-indigo-500/40 to-indigo-500/10 z-0" />

                        {/* Step 1 */}
                        <div className="flex flex-col items-center text-center space-y-5 relative z-10">
                            <div className="h-14 w-14 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-xl font-black text-indigo-400 shadow-xl">
                                1
                            </div>
                            <h3 className="text-xl font-bold text-white">Sync Your Voice</h3>
                            <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
                                Connect your LinkedIn account or input typical posts. The engine extracts your authentic vocabulary patterns and saves them as templates.
                            </p>
                        </div>

                        {/* Step 2 */}
                        <div className="flex flex-col items-center text-center space-y-5 relative z-10">
                            <div className="h-14 w-14 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-xl font-black text-indigo-400 shadow-xl">
                                2
                            </div>
                            <h3 className="text-xl font-bold text-white">Write with Audits</h3>
                            <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
                                Compose inside the editor. The self-correction agent highlights clichés, forces technical depth, and restructures formatting for readability.
                            </p>
                        </div>

                        {/* Step 3 */}
                        <div className="flex flex-col items-center text-center space-y-5 relative z-10">
                            <div className="h-14 w-14 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-xl font-black text-indigo-400 shadow-xl">
                                3
                            </div>
                            <h3 className="text-xl font-bold text-white">Automate Publishing</h3>
                            <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
                                Queue drafts in our visual calendar. The scheduler handles posting on time with attachments and carousels fully optimized.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Value / Stats Banner */}
            <section className="py-16 bg-indigo-600">
                <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center text-white">
                    <div className="space-y-1">
                        <div className="text-4xl md:text-5xl font-black">1.2M+</div>
                        <div className="text-xs md:text-sm font-semibold uppercase tracking-wider text-indigo-100">Posts Audited</div>
                    </div>
                    <div className="space-y-1">
                        <div className="text-4xl md:text-5xl font-black">10x</div>
                        <div className="text-xs md:text-sm font-semibold uppercase tracking-wider text-indigo-100">Consistency Multiplier</div>
                    </div>
                    <div className="space-y-1">
                        <div className="text-4xl md:text-5xl font-black">45%</div>
                        <div className="text-xs md:text-sm font-semibold uppercase tracking-wider text-indigo-100">Better Impressions</div>
                    </div>
                    <div className="space-y-1">
                        <div className="text-4xl md:text-5xl font-black">20k+</div>
                        <div className="text-xs md:text-sm font-semibold uppercase tracking-wider text-indigo-100">Carousels Generated</div>
                    </div>
                </div>
            </section>

            {/* Pricing Section */}
            <section id="pricing" className="py-24 max-w-7xl mx-auto px-6">
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4">
                        Simple, transparent plans
                    </h2>
                    <p className="text-slate-400 text-lg">
                        Scale your personal writing or team workspace without limits.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                    {/* Free / Trial */}
                    <Card className="bg-slate-900 border-slate-800 rounded-2xl flex flex-col justify-between">
                        <CardContent className="p-8 space-y-6 flex-1 flex flex-col justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-slate-300">Creator Workspace</h3>
                                <p className="text-slate-500 text-xs mt-1">Perfect for individuals starting on LinkedIn.</p>
                                <div className="mt-6 flex items-baseline gap-1">
                                    <span className="text-4xl font-extrabold text-white">$0</span>
                                    <span className="text-slate-500 text-sm">/ forever</span>
                                </div>
                                <ul className="mt-8 space-y-4 text-sm text-slate-400">
                                    <li className="flex items-center gap-3">
                                        <Check className="h-4.5 w-4.5 text-indigo-400" />
                                        <span>Single brand profile</span>
                                    </li>
                                    <li className="flex items-center gap-3">
                                        <Check className="h-4.5 w-4.5 text-indigo-400" />
                                        <span>Voice Corpus Analysis (basic)</span>
                                    </li>
                                    <li className="flex items-center gap-3">
                                        <Check className="h-4.5 w-4.5 text-indigo-400" />
                                        <span>Content Calendar & Scheduling</span>
                                    </li>
                                    <li className="flex items-center gap-3">
                                        <Check className="h-4.5 w-4.5 text-indigo-400" />
                                        <span>Idea Board & Draft storage</span>
                                    </li>
                                </ul>
                            </div>
                            <div className="pt-8">
                                <Link href="/signup" className="w-full">
                                    <Button className="w-full border-slate-700 bg-transparent border hover:bg-slate-800 text-white font-semibold rounded-xl py-6">
                                        Get Started Free
                                    </Button>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Pro */}
                    <Card className="bg-slate-900 border-indigo-500/40 rounded-2xl relative shadow-2xl shadow-indigo-500/5 flex flex-col justify-between">
                        <div className="absolute top-0 right-8 -translate-y-1/2 px-3 py-1 bg-indigo-600 text-white text-[10px] font-bold uppercase tracking-wider rounded-full">
                            Popular
                        </div>
                        <CardContent className="p-8 space-y-6 flex-1 flex flex-col justify-between">
                            <div>
                                <h3 className="text-lg font-bold text-white">Growth Agency</h3>
                                <p className="text-indigo-400/80 text-xs mt-1">For multi-tenant workspaces and agencies.</p>
                                <div className="mt-6 flex items-baseline gap-1">
                                    <span className="text-4xl font-extrabold text-white">$49</span>
                                    <span className="text-slate-500 text-sm">/ month</span>
                                </div>
                                <ul className="mt-8 space-y-4 text-sm text-slate-400">
                                    <li className="flex items-center gap-3">
                                        <Check className="h-4.5 w-4.5 text-indigo-400" />
                                        <span className="text-white">Unlimited workspaces (multi-tenant)</span>
                                    </li>
                                    <li className="flex items-center gap-3">
                                        <Check className="h-4.5 w-4.5 text-indigo-400" />
                                        <span>Deep Voice Corpus Analysis</span>
                                    </li>
                                    <li className="flex items-center gap-3">
                                        <Check className="h-4.5 w-4.5 text-indigo-400" />
                                        <span>PDF Carousels Generator (unlimited)</span>
                                    </li>
                                    <li className="flex items-center gap-3">
                                        <Check className="h-4.5 w-4.5 text-indigo-400" />
                                        <span>Team roles & invitation links</span>
                                    </li>
                                    <li className="flex items-center gap-3">
                                        <Check className="h-4.5 w-4.5 text-indigo-400" />
                                        <span>Automated Weekly Digests</span>
                                    </li>
                                </ul>
                            </div>
                            <div className="pt-8">
                                <Link href="/signup" className="w-full">
                                    <Button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl py-6 shadow-lg shadow-indigo-600/25">
                                        Start Free Trial
                                    </Button>
                                </Link>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </section>

            {/* Bottom CTA Block */}
            <section className="py-24 max-w-7xl mx-auto px-6 text-center">
                <div className="bg-gradient-to-tr from-slate-900 via-indigo-950/20 to-purple-950/20 border border-slate-800 rounded-3xl p-12 md:p-20 relative overflow-hidden max-w-5xl mx-auto">
                    <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-500/10 rounded-full blur-[80px]" />
                    <div className="absolute bottom-0 left-0 w-80 h-80 bg-purple-500/10 rounded-full blur-[80px]" />

                    <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-6">
                        Start building your high-authority presence today
                    </h2>
                    <p className="text-slate-400 text-lg max-w-xl mx-auto mb-10">
                        Create your account in 30 seconds. Audits run automatically. Free forever workspace included.
                    </p>

                    <Link href="/signup">
                        <Button size="lg" className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-base rounded-xl px-10 py-6 shadow-xl shadow-indigo-600/25">
                            Get Started Free
                            <ArrowRight className="ml-2.5 h-5 w-5" />
                        </Button>
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="border-t border-slate-800/80 bg-slate-950 py-12 text-center text-slate-500 text-sm">
                <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-md bg-indigo-600 flex items-center justify-center">
                            <Sparkles className="h-3.5 w-3.5 text-white" />
                        </div>
                        <span className="font-bold text-white text-base tracking-tight">DraftFlow</span>
                    </div>
                    <div>
                        &copy; {new Date().getFullYear()} APPGAMBiT. All rights reserved.
                    </div>
                    <div className="flex gap-4">
                        <a href="#features" className="hover:text-slate-300">Features</a>
                        <a href="#simulator" className="hover:text-slate-300">Simulator</a>
                        <a href="#pricing" className="hover:text-slate-300">Pricing</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
