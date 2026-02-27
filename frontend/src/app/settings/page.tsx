"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import toast, { Toaster } from "react-hot-toast";
import {
    Link2,
    Bot,
    Zap,
    Sparkles,
    History,
    Target,
    RefreshCw,
    AlertCircle,
    Copy,
    Building2,
    Search,
    Plus,
    Trash2,
    Globe,
    ChevronDown,
    ChevronUp,
    CheckCircle2,
    Loader2,
} from "lucide-react";

import { ConfirmationDialog } from "@/components/ConfirmationDialog";

interface MCPServer {
    name: string;
    url: string;
    headers: Record<string, string>;
    enabled: boolean;
    description: string;
}

export default function SettingsPage() {
    const [loading, setLoading] = useState(false);
    const [scannedOrgs, setScannedOrgs] = useState<any[]>([]);
    const [authors, setAuthors] = useState<any[]>([]);
    const [config, setConfig] = useState({
        isLinkedinConfigured: false,
        isTwitterConfigured: false,
        isLinkedinConnected: false,
        isTwitterConnected: false
    });

    // Dialog State
    const [disconnectDialog, setDisconnectDialog] = useState<{
        isOpen: boolean;
        platform: 'linkedin' | 'twitter' | null;
    }>({
        isOpen: false,
        platform: null
    });

    const [formData, setFormData] = useState({
        openRouterApiKey: "",
        openRouterModelId: "",
        targetAudiences: "",
        maxHistoryItems: 5,
        globalTone: "",
        accountTones: {} as Record<string, string>,
        aiPersona: "",
        webhookSecret: "",
        companyName: "",
        industry: "",
        companyDescription: "",
        expertiseAreas: "",
        contentPillars: "",
        tavilyApiKey: "",
        mcpServers: [] as MCPServer[],
    });

    const [mcpTestResults, setMcpTestResults] = useState<Record<number, { loading: boolean; success?: boolean; tools?: string[]; error?: string }>>({});
    const [expandedHeaders, setExpandedHeaders] = useState<Record<number, boolean>>({});
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
        fetchSettings();
        fetchAuthors();
    }, []);

    const fetchAuthors = async () => {
        try {
            const res = await api.get("/settings/linkedin/authors");
            setAuthors(res.data);
        } catch (error) {
            console.error("Failed to fetch authors", error);
        }
    };

    const fetchSettings = async () => {
        try {
            const res = await api.get("/settings");
            setFormData({
                openRouterApiKey: res.data.openRouterApiKey || "",
                openRouterModelId: res.data.openRouterModelId || "",
                targetAudiences: res.data.targetAudiences || "",
                maxHistoryItems: res.data.maxHistoryItems !== undefined ? res.data.maxHistoryItems : 5,
                globalTone: res.data.globalTone || "",
                accountTones: res.data.accountTones ? JSON.parse(res.data.accountTones) : {},
                aiPersona: res.data.aiPersona || "",
                webhookSecret: res.data.webhookSecret || "",
                companyName: res.data.companyName || "",
                industry: res.data.industry || "",
                companyDescription: res.data.companyDescription || "",
                expertiseAreas: res.data.expertiseAreas ? JSON.parse(res.data.expertiseAreas).join(', ') : "",
                contentPillars: res.data.contentPillars ? JSON.parse(res.data.contentPillars).join(', ') : "",
                tavilyApiKey: res.data.tavilyApiKey || "",
                mcpServers: res.data.mcpServers ? JSON.parse(res.data.mcpServers) : [],
            });
            setConfig({
                isLinkedinConfigured: res.data.isLinkedinConfigured || false,
                isTwitterConfigured: res.data.isTwitterConfigured || false,
                isLinkedinConnected: res.data.isLinkedinConnected || false,
                isTwitterConnected: res.data.isTwitterConnected || false
            });
            if (res.data.linkedinOrganizations) {
                try {
                    setScannedOrgs(JSON.parse(res.data.linkedinOrganizations));
                } catch (e) {
                    console.error("Failed to parse existing organizations", e);
                }
            }
        } catch (error) {
            toast.error("Failed to load settings");
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                ...formData,
                expertiseAreas: formData.expertiseAreas
                    ? formData.expertiseAreas.split(',').map((s: string) => s.trim()).filter(Boolean)
                    : [],
                contentPillars: formData.contentPillars
                    ? formData.contentPillars.split(',').map((s: string) => s.trim()).filter(Boolean)
                    : [],
                mcpServers: formData.mcpServers,
            };
            await api.post("/settings", payload);
            toast.success("Settings saved successfully");
        } catch (error) {
            toast.error("Failed to save settings");
        } finally {
            setLoading(false);
        }
    };

    const handleDisconnect = (platform: 'linkedin' | 'twitter') => {
        setDisconnectDialog({ isOpen: true, platform });
    };

    const confirmDisconnect = async () => {
        setLoading(true);
        try {
            await api.post("/settings/disconnect", { platform: disconnectDialog.platform });
            toast.success(`Disconnected from ${disconnectDialog.platform === 'linkedin' ? 'LinkedIn' : 'Twitter'}`);
            fetchSettings(); // Refresh to get updated status
        } catch (error) {
            toast.error("Failed to disconnect");
        } finally {
            setLoading(false);
            setDisconnectDialog({ isOpen: false, platform: null });
        }
    };

    const handleScanLinkedin = async () => {
        setLoading(true);
        try {
            const res = await api.post("/settings/linkedin/scan");
            toast.success(`Scan complete! Found ${res.data.count} organizations.`);
            setScannedOrgs(res.data.organizations || []);
        } catch (error) {
            toast.error("Failed to scan organizations");
        } finally {
            setLoading(false);
        }
    };

    // MCP Server management
    const addMCPServer = () => {
        setFormData({
            ...formData,
            mcpServers: [
                ...formData.mcpServers,
                { name: "", url: "", headers: {}, enabled: true, description: "" },
            ],
        });
    };

    const removeMCPServer = (index: number) => {
        const updated = formData.mcpServers.filter((_: MCPServer, i: number) => i !== index);
        setFormData({ ...formData, mcpServers: updated });
        // Clean up test results and expanded state
        const newResults = { ...mcpTestResults };
        delete newResults[index];
        setMcpTestResults(newResults);
        const newExpanded = { ...expandedHeaders };
        delete newExpanded[index];
        setExpandedHeaders(newExpanded);
    };

    const updateMCPServer = (index: number, field: keyof MCPServer, value: any) => {
        const updated = [...formData.mcpServers];
        updated[index] = { ...updated[index], [field]: value };
        setFormData({ ...formData, mcpServers: updated });
    };

    const updateMCPServerHeader = (index: number, key: string, value: string) => {
        const updated = [...formData.mcpServers];
        updated[index] = { ...updated[index], headers: { ...updated[index].headers, [key]: value } };
        setFormData({ ...formData, mcpServers: updated });
    };

    const testMCPConnection = async (index: number) => {
        const server = formData.mcpServers[index];
        if (!server?.url) {
            toast.error("Please enter a server URL first");
            return;
        }

        setMcpTestResults({ ...mcpTestResults, [index]: { loading: true } });

        try {
            const res = await api.post("/settings/mcp/test", {
                url: server.url,
                headers: server.headers,
            });
            setMcpTestResults({
                ...mcpTestResults,
                [index]: { loading: false, success: true, tools: res.data.tools },
            });
            toast.success(`Connected! Found ${res.data.tools.length} tool(s)`);
        } catch (error: any) {
            const errorMsg = error.response?.data?.error || "Connection failed";
            setMcpTestResults({
                ...mcpTestResults,
                [index]: { loading: false, success: false, error: errorMsg },
            });
            toast.error(errorMsg);
        }
    };

    return (
        <div className="container max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8 space-y-8">
            <Toaster />
            <ConfirmationDialog
                isOpen={disconnectDialog.isOpen}
                title={`Disconnect ${disconnectDialog.platform === 'linkedin' ? 'LinkedIn' : 'Twitter'}?`}
                description="Are you sure you want to disconnect? You will need to re-authenticate to post again."
                confirmLabel="Disconnect"
                variant="destructive"
                onConfirm={confirmDisconnect}
                onCancel={() => setDisconnectDialog({ isOpen: false, platform: null })}
            />

            <div className="flex flex-col gap-2">
                <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
                <p className="text-muted-foreground">Manage your connections, AI services, and global content preferences.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Platform Connections */}
                <Card className="overflow-hidden border-slate-200">
                    <CardHeader className="bg-slate-50/50 border-b">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white rounded-lg border shadow-sm">
                                <Link2 className="h-5 w-5 text-slate-600" />
                            </div>
                            <div>
                                <CardTitle>Platform Connections</CardTitle>
                                <CardDescription>Link your social media profiles to enable cross-platform publishing.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                        {/* LinkedIn */}
                        <div className="space-y-4">
                            <Label className="text-sm font-semibold text-slate-900">LinkedIn</Label>
                            {config.isLinkedinConnected ? (
                                <div className="flex items-center justify-between p-4 border rounded-xl bg-green-50/30 border-green-100">
                                    <div className="flex items-center gap-3">
                                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                        <span className="font-medium text-green-800">Linked to personal profile</span>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDisconnect('linkedin')}
                                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                    >
                                        Disconnect
                                    </Button>
                                </div>
                            ) : (
                                <div>
                                    {config.isLinkedinConfigured ? (
                                        <Button
                                            type="button"
                                            onClick={() => {
                                                if (typeof window !== 'undefined') {
                                                    const token = window.localStorage.getItem('token');
                                                    const tenantId = window.localStorage.getItem('tenantId');
                                                    let url = `${api.defaults.baseURL}/auth/linkedin/connect`;
                                                    if (token) url += `?token=${token}`;
                                                    if (tenantId) url += `${token ? '&' : '?'}tenantId=${tenantId}`;
                                                    window.location.href = url;
                                                }
                                            }}
                                            className="w-full sm:w-auto"
                                        >
                                            <RefreshCw className="mr-2 h-4 w-4" />
                                            Connect LinkedIn
                                        </Button>
                                    ) : (
                                        <div className="flex items-start gap-3 p-4 border border-amber-200 bg-amber-50 rounded-xl text-amber-800 text-sm">
                                            <AlertCircle className="h-5 w-5 shrink-0" />
                                            <p>LinkedIn API credentials are missing. Check your <code>.env</code> file.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex flex-col gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleScanLinkedin}
                                    disabled={loading || !config.isLinkedinConnected}
                                    className="w-full sm:w-auto"
                                >
                                    Scan LinkedIn Pages
                                </Button>
                                <p className="text-xs text-muted-foreground">
                                    Discover pages where you have administrative access.
                                </p>
                            </div>

                            {scannedOrgs.length > 0 && (
                                <div className="p-4 bg-slate-50 border rounded-xl">
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Managed Pages ({scannedOrgs.length})</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {scannedOrgs.map((org: any) => (
                                            <div key={org.urn} className="text-sm p-2 bg-white border rounded-lg shadow-sm truncate">
                                                {org.name}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="h-px bg-slate-100" />

                        {/* Twitter */}
                        <div className="space-y-4">
                            <Label className="text-sm font-semibold text-slate-900">Twitter (X)</Label>
                            {config.isTwitterConnected ? (
                                <div className="flex items-center justify-between p-4 border rounded-xl bg-green-50/30 border-green-100">
                                    <div className="flex items-center gap-3">
                                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                        <span className="font-medium text-green-800">Connected</span>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleDisconnect('twitter')}
                                        className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                    >
                                        Disconnect
                                    </Button>
                                </div>
                            ) : (
                                <div>
                                    {config.isTwitterConfigured ? (
                                        <Button
                                            type="button"
                                            onClick={() => {
                                                if (typeof window !== 'undefined') {
                                                    const token = window.localStorage.getItem('token');
                                                    const tenantId = window.localStorage.getItem('tenantId');
                                                    let url = `${api.defaults.baseURL}/auth/twitter/connect`;
                                                    if (token) url += `?token=${token}`;
                                                    if (tenantId) url += `${token ? '&' : '?'}tenantId=${tenantId}`;
                                                    window.location.href = url;
                                                }
                                            }}
                                            className="w-full sm:w-auto"
                                        >
                                            <RefreshCw className="mr-2 h-4 w-4" />
                                            Connect Twitter
                                        </Button>
                                    ) : (
                                        <div className="flex items-start gap-3 p-4 border border-amber-200 bg-amber-50 rounded-xl text-amber-800 text-sm">
                                            <AlertCircle className="h-5 w-5 shrink-0" />
                                            <p>Twitter API credentials are missing. Check your <code>.env</code> file.</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* AI Configuration */}
                <Card className="overflow-hidden border-slate-200">
                    <CardHeader className="bg-slate-50/50 border-b">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white rounded-lg border shadow-sm">
                                <Bot className="h-5 w-5 text-indigo-600" />
                            </div>
                            <div>
                                <CardTitle>AI Writing Engine</CardTitle>
                                <CardDescription>Configure OpenRouter to power intelligent post drafts and research.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="openRouterApiKey">OpenRouter API Key</Label>
                                <Input
                                    id="openRouterApiKey"
                                    name="openRouterApiKey"
                                    type="password"
                                    value={formData.openRouterApiKey}
                                    onChange={handleChange}
                                    placeholder="sk-or-v1-..."
                                    className="bg-slate-50/30"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Get your key from <a href="https://openrouter.ai" target="_blank" rel="noreferrer" className="text-primary hover:underline font-medium">openrouter.ai</a>
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="openRouterModelId">Model Preference</Label>
                                <Input
                                    id="openRouterModelId"
                                    name="openRouterModelId"
                                    value={formData.openRouterModelId}
                                    onChange={handleChange}
                                    placeholder="anthropic/claude-3.5-sonnet"
                                    className="bg-slate-50/30"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Recommended: <code>anthropic/claude-3.5-sonnet</code>
                                </p>
                            </div>
                        </div>

                        <div className="h-px bg-slate-100" />

                        {/* Web Search API */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <Search className="h-4 w-4 text-slate-400" />
                                <Label className="text-sm font-semibold">Web Search API (Optional)</Label>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label htmlFor="tavilyApiKey">Tavily API Key</Label>
                                    <Input
                                        id="tavilyApiKey"
                                        name="tavilyApiKey"
                                        type="password"
                                        value={formData.tavilyApiKey}
                                        onChange={handleChange}
                                        placeholder="tvly-..."
                                        className="bg-slate-50/30"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Provides more accurate and fresher search results for trend discovery. Get your key from <a href="https://tavily.com" target="_blank" rel="noreferrer" className="text-primary hover:underline font-medium">tavily.com</a>
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="h-px bg-slate-100" />

                        {/* MCP Servers */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Globe className="h-4 w-4 text-slate-400" />
                                    <Label className="text-sm font-semibold">External Data Sources (MCP)</Label>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={addMCPServer}
                                    className="gap-1"
                                >
                                    <Plus className="h-3 w-3" />
                                    Add Server
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Connect external data sources (CRM, analytics, wikis) via MCP servers so the AI can use richer context during content creation.
                            </p>

                            {formData.mcpServers.length === 0 ? (
                                <div className="p-6 border border-dashed rounded-xl text-center text-sm text-muted-foreground">
                                    No MCP servers configured. Click "Add Server" to connect an external data source.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {formData.mcpServers.map((server: MCPServer, index: number) => (
                                        <div key={index} className="p-4 border rounded-xl bg-slate-50/50 space-y-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                                    <button
                                                        type="button"
                                                        onClick={() => updateMCPServer(index, 'enabled', !server.enabled)}
                                                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${server.enabled ? 'bg-indigo-600' : 'bg-slate-200'}`}
                                                    >
                                                        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${server.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                                                    </button>
                                                    <span className={`text-xs font-medium ${server.enabled ? 'text-slate-700' : 'text-slate-400'}`}>
                                                        {server.name || 'Unnamed server'}
                                                    </span>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => removeMCPServer(index)}
                                                    className="text-red-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 p-0"
                                                >
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <Label className="text-xs">Server Name</Label>
                                                    <Input
                                                        value={server.name}
                                                        onChange={(e) => updateMCPServer(index, 'name', e.target.value)}
                                                        placeholder="My CRM"
                                                        className="bg-white h-9 text-sm"
                                                    />
                                                </div>
                                                <div className="space-y-1">
                                                    <Label className="text-xs">Server URL</Label>
                                                    <Input
                                                        value={server.url}
                                                        onChange={(e) => updateMCPServer(index, 'url', e.target.value)}
                                                        placeholder="https://mcp.example.com/sse"
                                                        className="bg-white h-9 text-sm"
                                                    />
                                                </div>
                                            </div>

                                            {/* Description - when to use this server */}
                                            <div className="space-y-1">
                                                <Label className="text-xs">When to use (helps AI pick the right server)</Label>
                                                <Input
                                                    value={server.description || ''}
                                                    onChange={(e) => updateMCPServer(index, 'description', e.target.value)}
                                                    placeholder="e.g., Web search for current news, statistics, and fact-checking"
                                                    className="bg-white h-9 text-sm"
                                                />
                                            </div>

                                            {/* Collapsible Auth Headers */}
                                            <div>
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedHeaders({ ...expandedHeaders, [index]: !expandedHeaders[index] })}
                                                    className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
                                                >
                                                    {expandedHeaders[index] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                                    Auth Headers (optional)
                                                </button>
                                                {expandedHeaders[index] && (
                                                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        <div className="space-y-1">
                                                            <Label className="text-xs">Header Name</Label>
                                                            <Input
                                                                value={Object.keys(server.headers || {})[0] || ''}
                                                                onChange={(e) => {
                                                                    const oldKey = Object.keys(server.headers || {})[0] || '';
                                                                    const oldValue = server.headers?.[oldKey] || '';
                                                                    const newHeaders: Record<string, string> = {};
                                                                    if (e.target.value) newHeaders[e.target.value] = oldValue;
                                                                    updateMCPServer(index, 'headers', newHeaders);
                                                                }}
                                                                placeholder="Authorization"
                                                                className="bg-white h-9 text-sm"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-xs">Header Value</Label>
                                                            <Input
                                                                type="password"
                                                                value={Object.values(server.headers || {})[0] || ''}
                                                                onChange={(e) => {
                                                                    const key = Object.keys(server.headers || {})[0] || 'Authorization';
                                                                    updateMCPServerHeader(index, key, e.target.value);
                                                                }}
                                                                placeholder="Bearer xxx..."
                                                                className="bg-white h-9 text-sm"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Test Connection */}
                                            <div className="flex items-center gap-3">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => testMCPConnection(index)}
                                                    disabled={mcpTestResults[index]?.loading || !server.url}
                                                    className="gap-1 text-xs"
                                                >
                                                    {mcpTestResults[index]?.loading ? (
                                                        <Loader2 className="h-3 w-3 animate-spin" />
                                                    ) : (
                                                        <RefreshCw className="h-3 w-3" />
                                                    )}
                                                    Test Connection
                                                </Button>
                                                {mcpTestResults[index]?.success && (
                                                    <span className="flex items-center gap-1 text-xs text-green-600">
                                                        <CheckCircle2 className="h-3 w-3" />
                                                        {mcpTestResults[index].tools?.length} tool(s) available
                                                    </span>
                                                )}
                                                {mcpTestResults[index]?.success === false && (
                                                    <span className="flex items-center gap-1 text-xs text-red-500">
                                                        <AlertCircle className="h-3 w-3" />
                                                        {mcpTestResults[index].error || 'Connection failed'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Business Profile */}
                <Card className="overflow-hidden border-slate-200">
                    <CardHeader className="bg-slate-50/50 border-b">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white rounded-lg border shadow-sm">
                                <Building2 className="h-5 w-5 text-emerald-600" />
                            </div>
                            <div>
                                <CardTitle>Business Profile</CardTitle>
                                <CardDescription>Tell the AI about your business so it can generate more relevant content ideas.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="companyName">Company Name</Label>
                                <Input
                                    id="companyName"
                                    name="companyName"
                                    value={formData.companyName}
                                    onChange={handleChange}
                                    placeholder="Acme Corp"
                                    className="bg-slate-50/30"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="industry">Industry</Label>
                                <Input
                                    id="industry"
                                    name="industry"
                                    value={formData.industry}
                                    onChange={handleChange}
                                    placeholder="e.g., SaaS, Fintech, Healthcare"
                                    className="bg-slate-50/30"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="companyDescription">What do you do?</Label>
                            <textarea
                                id="companyDescription"
                                value={formData.companyDescription}
                                onChange={(e) => setFormData({ ...formData, companyDescription: e.target.value })}
                                className="flex min-h-[100px] w-full rounded-xl border border-input bg-slate-50/30 px-4 py-3 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400"
                                placeholder="Briefly describe what your business does and your unique value proposition..."
                            />
                            <p className="text-xs text-muted-foreground">
                                This helps the AI understand your domain and generate ideas aligned with your business goals.
                            </p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="expertiseAreas">Expertise Areas</Label>
                                <Input
                                    id="expertiseAreas"
                                    name="expertiseAreas"
                                    value={formData.expertiseAreas}
                                    onChange={handleChange}
                                    placeholder="Cloud Architecture, DevOps, Security..."
                                    className="bg-slate-50/30"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Comma-separated list of your areas of expertise.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="contentPillars">Content Pillars</Label>
                                <Input
                                    id="contentPillars"
                                    name="contentPillars"
                                    value={formData.contentPillars}
                                    onChange={handleChange}
                                    placeholder="Thought Leadership, Tutorials, Industry News..."
                                    className="bg-slate-50/30"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Comma-separated themes that guide your content strategy.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Content Strategy */}
                <Card className="overflow-hidden border-slate-200">
                    <CardHeader className="bg-slate-50/50 border-b">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white rounded-lg border shadow-sm">
                                <Sparkles className="h-5 w-5 text-fuchsia-600" />
                            </div>
                            <div>
                                <CardTitle>Content Strategy & Voice</CardTitle>
                                <CardDescription>Define how the AI writes for you and how much previous context it should remember.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-8">
                        {/* History */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <History className="h-4 w-4 text-slate-400" />
                                    <Label className="text-sm font-semibold">Context Awareness</Label>
                                </div>
                                <div className="space-y-3">
                                    <Input
                                        type="number"
                                        min="0"
                                        max="15"
                                        value={formData.maxHistoryItems}
                                        onChange={(e) => setFormData({ ...formData, maxHistoryItems: parseInt(e.target.value) || 0 })}
                                        className="w-24 bg-slate-50/30"
                                    />
                                    <p className="text-xs text-muted-foreground leading-relaxed">
                                        Max historical snapshots to store per idea. 0 disables context; higher values (up to 15) increase variety but use more tokens.
                                    </p>
                                </div>
                            </div>

                            {/* Audience */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <Target className="h-4 w-4 text-slate-400" />
                                    <Label className="text-sm font-semibold">Audience Segments</Label>
                                </div>
                                <textarea
                                    value={formData.targetAudiences}
                                    onChange={(e) => setFormData({ ...formData, targetAudiences: e.target.value })}
                                    className="flex min-h-[80px] w-full rounded-xl border border-input bg-slate-50/30 px-3 py-2 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400"
                                    placeholder="CTOs, Startup Founders, Product Mangers..."
                                />
                                <p className="text-xs text-muted-foreground">
                                    Comma-separated list of your ideal readers.
                                </p>
                            </div>
                        </div>

                        <div className="h-px bg-slate-100" />

                        {/* Tone */}
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <Label className="text-sm font-semibold">Global Brand Voice</Label>
                                <textarea
                                    value={formData.globalTone}
                                    onChange={(e) => setFormData({ ...formData, globalTone: e.target.value })}
                                    className="flex min-h-[120px] w-full rounded-xl border border-input bg-slate-50/30 px-4 py-3 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400"
                                    placeholder="Describe your tone: authoritative, witty, data-driven, etc."
                                />
                                <p className="text-xs text-muted-foreground">
                                    The default style used whenever you generate a post.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-sm font-semibold">AI Assistant Persona & Objective</Label>
                                <textarea
                                    name="aiPersona"
                                    value={formData.aiPersona}
                                    onChange={(e) => setFormData({ ...formData, aiPersona: e.target.value })}
                                    className="flex min-h-[120px] w-full rounded-xl border border-input bg-slate-50/30 px-4 py-3 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400"
                                    placeholder="Describe who the AI should act as (e.g. 'You are an expert LinkedIn strategist specializing in Fintech...')"
                                />
                                <p className="text-xs text-muted-foreground">
                                    This defines the AI's background and expertise during post generation.
                                </p>
                            </div>

                            {authors.length > 0 && (
                                <div className="space-y-4">
                                    <Label className="text-sm font-semibold">Account Specific Personalities</Label>
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        {authors.filter(a => a.urn).map((author) => (
                                            <div key={author.urn} className="p-4 border rounded-xl bg-slate-50/50 space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="h-6 w-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500 uppercase">
                                                        {author.name.charAt(0)}
                                                    </div>
                                                    <span className="text-sm font-medium">{author.name}</span>
                                                </div>
                                                <textarea
                                                    value={formData.accountTones[author.urn] || ""}
                                                    onChange={(e) => {
                                                        const newTones = { ...formData.accountTones, [author.urn]: e.target.value };
                                                        setFormData({ ...formData, accountTones: newTones });
                                                    }}
                                                    className="flex min-h-[80px] w-full rounded-lg border border-input bg-white px-3 py-2 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-400"
                                                    placeholder="Custom tone for this specifically..."
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Automation & Webhooks */}
                <Card className="overflow-hidden border-slate-200">
                    <CardHeader className="bg-slate-50/50 border-b">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-white rounded-lg border shadow-sm">
                                <Zap className="h-5 w-5 text-amber-500" />
                            </div>
                            <div>
                                <CardTitle>Automation Webhooks</CardTitle>
                                <CardDescription>Streamline content creation by sending ideas directly from n8n, Zapier, or custom scripts.</CardDescription>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-8">
                        {/* Credentials */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Workspace ID (X-Tenant-ID)</Label>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 p-2 bg-white border rounded text-xs font-mono">{isMounted ? localStorage.getItem('tenantId') : ''}</code>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => {
                                        navigator.clipboard.writeText(localStorage.getItem('tenantId') || '');
                                        toast.success("Copied Workspace ID");
                                    }}><Copy className="h-3 w-3" /></Button>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Webhook Secret (X-Webhook-Secret)</Label>
                                <div className="flex items-center gap-2">
                                    <code className="flex-1 p-2 bg-white border rounded text-xs font-mono">{formData.webhookSecret || '••••••••••••••••'}</code>
                                    <Button type="button" variant="ghost" size="sm" onClick={() => {
                                        navigator.clipboard.writeText(formData.webhookSecret || '');
                                        toast.success("Copied Webhook Secret");
                                    }}><Copy className="h-3 w-3" /></Button>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {/* Save Idea */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold flex items-center gap-2">
                                    <RefreshCw className="h-4 w-4 text-slate-400" />
                                    Idea Ingestion
                                </h4>
                                <div className="p-4 bg-slate-900 rounded-xl space-y-4">
                                    <div className="flex items-center justify-between">
                                        <code className="text-amber-400 text-xs font-mono">
                                            POST /api/webhooks/idea
                                        </code>
                                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-400 uppercase font-bold">Headers Required</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2 text-[10px] font-mono text-slate-400">
                                        <div>X-Tenant-ID: {isMounted ? localStorage.getItem('tenantId') : ''}</div>
                                        <div>X-Webhook-Secret: {formData.webhookSecret || 'YOUR_SECRET'}</div>
                                    </div>
                                    <pre className="text-white text-[11px] font-mono leading-relaxed opacity-90">
                                        {`{
  "title": "Scaling Node.js apps",
  "summary": "Context about memory limits...",
  "tags": ["cloud", "devops"]
}`}
                                    </pre>
                                </div>
                                <p className="text-xs text-muted-foreground italic">
                                    Automatically creates a persistent idea on your board.
                                </p>
                            </div>

                            {/* Direct Schedule */}
                            <div className="space-y-3">
                                <h4 className="text-sm font-semibold flex items-center gap-2">
                                    <RefreshCw className="h-4 w-4 text-slate-400" />
                                    Instant Scheduler
                                </h4>
                                <div className="p-4 bg-slate-900 rounded-xl space-y-4">
                                    <div className="flex items-center justify-between">
                                        <code className="text-indigo-400 text-xs font-mono">
                                            POST /api/webhooks/schedule
                                        </code>
                                        <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-400 uppercase font-bold">API Context</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2 text-[10px] font-mono text-slate-400">
                                        <div>X-Tenant-ID: {isMounted ? localStorage.getItem('tenantId') : ''}</div>
                                        <div>X-Webhook-Secret: {formData.webhookSecret || 'YOUR_SECRET'}</div>
                                    </div>
                                    <pre className="text-white text-[11px] font-mono leading-relaxed opacity-90">
                                        {`{
  "content": "Fully written post logic...",
  "scheduledTime": "ISO-TIMESTAMP",
  "platforms": ["LINKEDIN"]
}`}
                                    </pre>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Sticky Save Bar */}
                <div className="sticky bottom-6 flex justify-end">
                    <Button
                        type="submit"
                        disabled={loading}
                        className="shadow-xl px-12 h-12 rounded-full font-bold bg-indigo-600 hover:bg-indigo-700 transition-all hover:scale-105"
                    >
                        {loading ? "Saving Changes..." : "Save All Settings"}
                    </Button>
                </div>
            </form>
        </div >
    );
}
