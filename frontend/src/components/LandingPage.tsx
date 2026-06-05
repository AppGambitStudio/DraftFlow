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
    Check,
    Clock,
    CheckCircle2,
    Eye,
    ThumbsUp,
    MessageSquare,
    Share2,
    Search,
    Filter,
    PenSquare,
    Zap,
    Shield,
} from "lucide-react";

// Real APPGAMBIT posts from the database to use as showcase references
const SHOWCASE_POSTS = [
    {
        id: "post-1",
        title: "Cron Jobs vs Event-Driven Architecture",
        status: "SCHEDULED",
        statusText: "Scheduled for Jun 12, 2026 • 5:45 AM",
        category: "Cloud Architecture",
        content: `Cron jobs persist in modern stacks because a crontab entry is easy to read. But time-based scheduling assumes upstream systems always deliver on time.

A 2 AM batch job processes whatever arrived by 1:59 AM. If an upstream feed delays by 15 minutes, the job processes incomplete data. The failure doesn't surface until a dashboard looks wrong three days later.

Switching to event-driven triggers like EventBridge, S3 notifications, or SQS fixes this by tying execution to actual state changes. The pipeline runs when the data lands.

But replacing a schedule with a causal chain introduces a stricter engineering constraint: idempotency. A daily cron job that overwrites a partition is naturally idempotent. Event-driven consumers will inevitably receive duplicate or out-of-order messages. If your processing logic isn't strictly idempotent, swapping cron for SQS just trades missing data for corrupted data.

Make your consumers idempotent before you rip out the scheduler.

#EventDrivenArchitecture #CloudModernization #Serverless #SystemArchitecture #AWSEventBridge`,
    },
    {
        id: "post-2",
        title: "AWS Bedrock Quotas vs Budgets",
        status: "PUBLISHED",
        statusText: "Published to LinkedIn",
        category: "Generative AI",
        content: `Ever hit a brick wall with Amazon Bedrock before you even shipped a single line of code? We are talking about the dreaded ThrottlingException on a fresh dev account.

I was recently experimenting with Bedrock Agents and Knowledge Bases. No production traffic. Just simple testing. Suddenly, everything stopped.

The errors? "Request rate is too high" and "Too many tokens today."

It didn't make sense. I knew I hadn't spent any real money yet. But here is the hard truth I learned about managed AI services:

Your Budget is not your Quota.

You might have plenty of credits or budget alerts set up, but AWS enforces distinct limits on TPM (Tokens Per Minute) and RPM (Requests Per Minute).

For new accounts (or specific regions), these default quotas are often much tighter than you expect.

How to unblock yourself:
1️⃣ Don't guess, check. Go to the actual Service Quotas console. Amazon Bedrock limits are model-specific and region-specific.
2️⃣ Monitor the Throttle. You can't just watch the bill. You need to look at ThrottledRequests in AWS CloudWatch to see real-time blocks.
3️⃣ Tooling. There are community tools that allow you to fetch quota limits across regions via CloudShell to see where you actually have capacity.

#AWS #AmazonBedrock #Serverless #GenAI #CloudArchitecture #DevOps`,
    },
    {
        id: "post-3",
        title: "SecOps 'Guardian' Agent on AWS",
        status: "PUBLISHED",
        statusText: "Published to LinkedIn",
        category: "Security & Ops",
        content: `For founders, this means you can stop building chatbots and start building digital employees.

Here is a blueprint for a automated SecOps Agent—the "Guardian" workflow—that handles compliance so your engineers can focus on shipping product.

The "Guardian" Architecture on AWS:
📌 The Trigger: An anomaly is detected through Config (e.g., an S3 bucket is accidentally made public).
Service: AWS Security Hub → EventBridge

🧠 The Brain (Reasoning): The event wakes up the agent. It reviews the finding against your corporate policy (RAG) to decide if it's a feature or a bug.
Service: Amazon Bedrock Agents (using Anthropic Claude)

🛠 The Tooling (MCP): This is the game changer. Instead of hard-coding integration logic, the agent connects to a remote MCP Server running on serverless compute. This decouples the AI from the tools, creating a secure, standard interface for action.
Service: AWS Lambda (hosting the MCP server)

⚡ The Action: The agent safely executes the fix via the MCP tool set—encrypting the bucket or stripping public access.
Service: AWS Systems Manager (SSM)

#AIAgents #AWS #Startups #DevSecOps #CloudArchitecture #ModelContextProtocol`,
    }
];

export function LandingPage() {
    const { user } = useAuth();
    const [selectedPostId, setSelectedPostId] = useState(SHOWCASE_POSTS[0].id);
    const [activeAiTab, setActiveAiTab] = useState<"search" | "filter" | "write">("write");

    const activePost = SHOWCASE_POSTS.find((p) => p.id === selectedPostId) || SHOWCASE_POSTS[0];

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 selection:bg-indigo-500 selection:text-white font-sans overflow-x-hidden font-normal">
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
                        <a href="#ai-engine" className="hover:text-white transition-colors">AI Engine</a>
                        <a href="#showcase" className="hover:text-white transition-colors">Showcase Reference</a>
                        <a href="#features" className="hover:text-white transition-colors">Features</a>
                        <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
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
                    <a href="#ai-engine">
                        <Button size="lg" variant="outline" className="border-slate-700 hover:bg-slate-800 text-slate-200 font-semibold text-base rounded-xl px-8 py-6">
                            Explore AI Engine
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

            {/* AI Engine Section (Search, Filter, Write) */}
            <section id="ai-engine" className="py-24 border-t border-slate-800 bg-slate-950/20 relative">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <span className="text-xs font-bold uppercase tracking-widest text-indigo-400">The Multi-Agent Framework</span>
                        <h2 className="text-3xl md:text-5xl font-extrabold text-white mt-2 mb-4">
                            Exposing DraftFlow's AI Core
                        </h2>
                        <p className="text-slate-400 text-lg">
                            We don't just layer single text boxes on Claude. DraftFlow runs a coordinate sequence of agents configured to research, structure, and verify your drafts.
                        </p>
                    </div>

                    {/* AI Tab Selector */}
                    <div className="flex justify-center mb-12">
                        <div className="bg-slate-900 border border-slate-800 p-1.5 rounded-xl flex gap-2">
                            <button
                                onClick={() => setActiveAiTab("write")}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                                    activeAiTab === "write"
                                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/15"
                                        : "text-slate-400 hover:text-white"
                                }`}
                            >
                                <PenSquare className="h-4 w-4" />
                                <span>AI Write</span>
                            </button>
                            <button
                                onClick={() => setActiveAiTab("search")}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                                    activeAiTab === "search"
                                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/15"
                                        : "text-slate-400 hover:text-white"
                                }`}
                            >
                                <Search className="h-4 w-4" />
                                <span>AI Search</span>
                            </button>
                            <button
                                onClick={() => setActiveAiTab("filter")}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                                    activeAiTab === "filter"
                                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/15"
                                        : "text-slate-400 hover:text-white"
                                }`}
                            >
                                <Filter className="h-4 w-4" />
                                <span>AI Filter</span>
                            </button>
                        </div>
                    </div>

                    {/* AI Content Display */}
                    <div className="max-w-5xl mx-auto bg-slate-900/60 border border-slate-800 rounded-2xl p-8 md:p-12 shadow-2xl relative">
                        {activeAiTab === "write" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                                <div className="space-y-5">
                                    <div className="h-10 w-10 bg-indigo-500/10 text-indigo-400 rounded-lg flex items-center justify-center border border-indigo-500/20">
                                        <PenSquare className="h-5 w-5" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-white">The Writer Agent & Style Corpus</h3>
                                    <p className="text-slate-300 text-sm leading-relaxed">
                                        DraftFlow uses a dedicated writing model that ingests your historical LinkedIn publications (your <strong>Personal Voice Corpus</strong>). Instead of returning standard AI essays, it maps your structural style:
                                    </p>
                                    <ul className="space-y-2.5 text-xs text-slate-400">
                                        <li className="flex items-center gap-2">
                                            <Check className="h-4 w-4 text-indigo-400" />
                                            Adopts your spacing density and paragraph styles.
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="h-4 w-4 text-indigo-400" />
                                            Matches standard vocabulary choices and capitalization logic.
                                            </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="h-4 w-4 text-indigo-400" />
                                            Anchors generation to your specific core themes automatically.
                                        </li>
                                    </ul>
                                </div>
                                <div className="bg-slate-950/80 rounded-xl p-6 border border-slate-800 font-mono text-xs text-slate-400 space-y-3">
                                    <div className="text-indigo-400 font-bold border-b border-slate-800 pb-2 flex items-center justify-between">
                                        <span>[Mastra] writerAgent.run()</span>
                                        <span className="text-[9px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded">Active</span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 leading-tight">// Inputting voice parameters...</p>
                                    <div className="bg-slate-900/60 p-3 rounded border border-slate-850">
                                        <span className="text-slate-500 font-semibold uppercase tracking-wider block text-[9px] mb-1">Tone Config</span>
                                        <span className="text-slate-300">Tone: "Tech Authority" | Format: "Bullet-Dense"</span>
                                    </div>
                                    <div className="bg-slate-900/60 p-3 rounded border border-slate-850">
                                        <span className="text-slate-500 font-semibold uppercase tracking-wider block text-[9px] mb-1">Generated Output</span>
                                        <span className="text-slate-300">"API thread exhaustion cascades outages. Drop payload to SQS and continue."</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeAiTab === "search" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                                <div className="space-y-5">
                                    <div className="h-10 w-10 bg-indigo-500/10 text-indigo-400 rounded-lg flex items-center justify-center border border-indigo-500/20">
                                        <Search className="h-5 w-5" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-white">The Researcher Agent & LLM Wiki</h3>
                                    <p className="text-slate-300 text-sm leading-relaxed">
                                        Before drafting, the <strong>Researcher Agent</strong> scans all previously curated sources in your LLM Wiki knowledge base (RSS Feeds, Case Studies, and articles) using semantic lookup. If the local knowledge base needs support, it executes Tavily web searches to:
                                    </p>
                                    <ul className="space-y-2.5 text-xs text-slate-400">
                                        <li className="flex items-center gap-2">
                                            <Check className="h-4 w-4 text-indigo-400" />
                                            Retrieve accurate, real-world statistics to anchor assertions.
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="h-4 w-4 text-indigo-400" />
                                            Expose fresh angles by scanning current announcements.
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="h-4 w-4 text-indigo-400" />
                                            Auto-exclude concepts or topics the author has covered recently.
                                        </li>
                                    </ul>
                                </div>
                                <div className="bg-slate-950/80 rounded-xl p-6 border border-slate-800 font-mono text-xs text-slate-400 space-y-3">
                                    <div className="text-indigo-400 font-bold border-b border-slate-800 pb-2 flex items-center justify-between">
                                        <span>[Mastra] researcherAgent.run()</span>
                                        <span className="text-[9px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded">Active</span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 leading-tight">// Semantic retrieval trigger...</p>
                                    <div className="bg-slate-900/60 p-3 rounded border border-slate-850">
                                        <span className="text-slate-500 font-semibold uppercase tracking-wider block text-[9px] mb-1">Tool execution</span>
                                        <span className="text-indigo-300">searchWikiTool(query: "serverless streaming")</span>
                                        <span className="text-slate-400 block mt-1 text-[10px]">Found 2 documents in knowledge base</span>
                                    </div>
                                    <div className="bg-slate-900/60 p-3 rounded border border-slate-850">
                                        <span className="text-slate-500 font-semibold uppercase tracking-wider block text-[9px] mb-1">Web Search plugin</span>
                                        <span className="text-indigo-300">webSearchTool(query: "AppSync Event limits")</span>
                                        <span className="text-slate-400 block mt-1 text-[10px]">Returned current limits from AWS Compute Blog</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeAiTab === "filter" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                                <div className="space-y-5">
                                    <div className="h-10 w-10 bg-indigo-500/10 text-indigo-400 rounded-lg flex items-center justify-center border border-indigo-500/20">
                                        <Filter className="h-5 w-5" />
                                    </div>
                                    <h3 className="text-2xl font-bold text-white">The Editor Agent & Depth Bar</h3>
                                    <p className="text-slate-300 text-sm leading-relaxed">
                                        The final gatekeeper is the <strong>Editor Agent</strong>. It scans the generated content against structural and formatting rules, ensuring it passes our strict **Depth Bar** policy before scheduling:
                                    </p>
                                    <ul className="space-y-2.5 text-xs text-slate-400">
                                        <li className="flex items-center gap-2">
                                            <Check className="h-4 w-4 text-indigo-400" />
                                            <strong>No Clichés</strong>: Scrubs buzzwords like "game changer", "synergy", or "double down".
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="h-4 w-4 text-indigo-400" />
                                            <strong>Trade-off Constraint</strong>: Rewrites posts that only make simple claims, forcing the inclusion of clear engineering drawbacks.
                                        </li>
                                        <li className="flex items-center gap-2">
                                            <Check className="h-4 w-4 text-indigo-400" />
                                            <strong>Audit loop</strong>: Compares the resulting draft directly against the author's published-post voice corpus.
                                        </li>
                                    </ul>
                                </div>
                                <div className="bg-slate-950/80 rounded-xl p-6 border border-slate-800 font-mono text-xs text-slate-400 space-y-3">
                                    <div className="text-indigo-400 font-bold border-b border-slate-800 pb-2 flex items-center justify-between">
                                        <span>[Mastra] editorAgent.run()</span>
                                        <span className="text-[9px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded">Active</span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 leading-tight">// Quality audits running...</p>
                                    <div className="bg-red-500/10 border border-red-500/20 p-2.5 rounded text-red-400 text-[10px]">
                                        <span className="font-bold">WARN:</span> Hit banned cliché pattern ("total game changer").
                                    </div>
                                    <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded text-amber-400 text-[10px]">
                                        <span className="font-bold">WARN:</span> Post lacks trade-off depth. Proposing rewrite query.
                                    </div>
                                    <div className="bg-emerald-500/10 border border-emerald-500/20 p-2.5 rounded text-emerald-400 text-[10px]">
                                        <span className="font-bold">SUCCESS:</span> Self-review loop complete. Post published.
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Showcase Reference Section */}
            <section id="showcase" className="py-24 border-b border-slate-800 bg-slate-950/30 relative">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center max-w-3xl mx-auto mb-16">
                        <h2 className="text-3xl md:text-5xl font-extrabold text-white mb-4">
                            Real Content, Scheduled & Published
                        </h2>
                        <p className="text-slate-400 text-lg">
                            Review live posts managed directly through DraftFlow. These are real architectural insights scheduled and published to the **APPGAMBIT** page.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
                        {/* Selector Sidebar */}
                        <div className="lg:col-span-4 space-y-4 flex flex-col justify-start">
                            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                                <h3 className="text-sm font-semibold uppercase tracking-wider text-indigo-400 mb-2">
                                    Select Reference Post
                                </h3>

                                <div className="space-y-2.5">
                                    {SHOWCASE_POSTS.map((post) => (
                                        <button
                                            key={post.id}
                                            onClick={() => setSelectedPostId(post.id)}
                                            className={`w-full text-left p-3.5 rounded-lg border text-sm font-medium transition-all ${
                                                selectedPostId === post.id
                                                    ? "bg-indigo-600/10 border-indigo-500/40 text-white"
                                                    : "bg-transparent border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white"
                                            }`}
                                        >
                                            <div className="flex items-center justify-between mb-1.5">
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                    post.status === "PUBLISHED"
                                                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                                        : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                                }`}>
                                                    {post.status}
                                                </span>
                                                <span className="text-[10px] text-slate-500">{post.category}</span>
                                            </div>
                                            <span className="font-semibold block truncate">{post.title}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 text-xs text-slate-500 space-y-2">
                                <p className="font-semibold text-slate-400">Content Enforcements Applied:</p>
                                <ul className="space-y-1.5 list-disc pl-4">
                                    <li>Strict Banned-Words audit (clean of typical AI jargon).</li>
                                    <li>Technical Depth Bar verification (explicit cost/constraint ratios).</li>
                                    <li>Voice analysis matched precisely to current style corpus.</li>
                                </ul>
                            </div>
                        </div>

                        {/* LinkedIn Card Showcase */}
                        <div className="lg:col-span-8 flex flex-col">
                            <div className="flex-1 bg-white text-slate-900 border border-slate-200 rounded-xl overflow-hidden shadow-2xl flex flex-col justify-between">
                                {/* LinkedIn Header */}
                                <div className="p-4 border-b border-slate-100 bg-white flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="h-11 w-11 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-lg text-white shadow-md">
                                            AG
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-slate-900 text-base">APPGAMBIT</span>
                                                <span className="text-xs text-slate-400">• 1st</span>
                                            </div>
                                            <span className="text-xs text-slate-500 block leading-tight">
                                                AWS Cloud & Serverless Modernization Advisors
                                            </span>
                                            <div className="flex items-center gap-1 mt-1 text-[11px] text-slate-400">
                                                {activePost.status === "PUBLISHED" ? (
                                                    <span className="text-emerald-600 font-semibold flex items-center gap-1">
                                                        <CheckCircle2 className="h-3 w-3" /> Published via DraftFlow
                                                    </span>
                                                ) : (
                                                    <span className="text-amber-600 font-semibold flex items-center gap-1">
                                                        <Clock className="h-3 w-3" /> {activePost.statusText}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="h-8 px-3 rounded-full border border-indigo-600/30 bg-indigo-50 text-indigo-700 text-xs font-semibold flex items-center gap-1">
                                        <Eye className="h-3.5 w-3.5" />
                                        <span>DraftFlow Preview</span>
                                    </div>
                                </div>

                                {/* Post Text Area */}
                                <div className="p-6 font-sans text-base leading-relaxed text-slate-800 whitespace-pre-wrap min-h-[260px] bg-slate-50/30">
                                    {activePost.content}
                                </div>

                                {/* LinkedIn Engagement Bar */}
                                <div className="border-t border-slate-100 p-3 bg-white flex items-center justify-around text-slate-500 text-xs font-semibold">
                                    <button className="flex items-center gap-2 hover:bg-slate-100 py-1.5 px-3 rounded-lg transition-colors">
                                        <ThumbsUp className="h-4 w-4" />
                                        <span>Like</span>
                                    </button>
                                    <button className="flex items-center gap-2 hover:bg-slate-100 py-1.5 px-3 rounded-lg transition-colors">
                                        <MessageSquare className="h-4 w-4" />
                                        <span>Comment</span>
                                    </button>
                                    <button className="flex items-center gap-2 hover:bg-slate-100 py-1.5 px-3 rounded-lg transition-colors">
                                        <Share2 className="h-4 w-4" />
                                        <span>Share</span>
                                    </button>
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
                        <a href="#ai-engine" className="hover:text-slate-300">AI Core</a>
                        <a href="#showcase" className="hover:text-slate-300">Showcase</a>
                        <a href="#features" className="hover:text-slate-300">Features</a>
                        <a href="#pricing" className="hover:text-slate-300">Pricing</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
