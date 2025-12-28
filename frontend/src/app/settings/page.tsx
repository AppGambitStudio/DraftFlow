"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import toast, { Toaster } from "react-hot-toast";

import { ConfirmationDialog } from "@/components/ConfirmationDialog";

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
    });

    useEffect(() => {
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
            await api.post("/settings", formData);
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

    return (
        <div className="space-y-6">
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

            <h2 className="text-3xl font-bold tracking-tight">Settings</h2>

            <Card>
                <CardHeader>
                    <CardTitle></CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* LinkedIn Section */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-medium">LinkedIn Connection</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Authenticate with your LinkedIn account.
                                    </p>
                                </div>
                            </div>

                            {config.isLinkedinConnected ? (
                                <div className="flex items-center justify-between p-4 border rounded-lg bg-green-50/50 border-green-200">
                                    <div className="flex items-center gap-2 text-green-700">
                                        <div className="h-2 w-2 rounded-full bg-green-600" />
                                        <span className="font-medium">Connected to LinkedIn</span>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDisconnect('linkedin')}
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
                                                window.location.href = `${api.defaults.baseURL}/auth/linkedin/connect`;
                                            }}
                                        >
                                            Connect with LinkedIn
                                        </Button>
                                    ) : (
                                        <div className="p-4 border border-yellow-200 bg-yellow-50 rounded-md text-sm text-yellow-800">
                                            ⚠️ LinkedIn Client ID & Secret not configured in backend .env file.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>


                        <div className="space-y-2 pt-2">
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={handleScanLinkedin}
                                disabled={loading || !config.isLinkedinConnected}
                                className="w-full sm:w-auto"
                            >
                                Scan for Organizations
                            </Button>
                            <p className="text-xs text-muted-foreground">
                                Fetch the list of LinkedIn Pages you manage.
                            </p>
                        </div>

                        {scannedOrgs.length > 0 && (
                            <div className="mt-4 p-4 bg-muted rounded-md">
                                <h4 className="text-sm font-medium mb-2">Found {scannedOrgs.length} Organizations:</h4>
                                <ul className="text-sm space-y-1">
                                    {scannedOrgs.map((org: any) => {
                                        const id = org.urn?.split(':').pop();
                                        return (
                                            <li key={org.urn} className="text-muted-foreground">
                                                {org.name} ({id})
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>
                        )}
                        <div className="space-y-2 pt-4 border-t border-border">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-medium">Twitter Connection</h3>
                            </div>

                            <div className="pt-2">
                                {config.isTwitterConnected ? ( // Checking connection flag
                                    <div className="flex items-center justify-between p-4 border rounded-lg bg-green-50/50 border-green-200">
                                        <div className="flex items-center gap-2 text-green-700">
                                            <div className="h-2 w-2 rounded-full bg-green-600" />
                                            <span className="font-medium">Connected to Twitter</span>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleDisconnect('twitter')}
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
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
                                                    window.location.href = `${api.defaults.baseURL}/auth/twitter/connect`;
                                                }}
                                            >
                                                Connect with Twitter
                                            </Button>
                                        ) : (
                                            <div className="p-4 border border-yellow-200 bg-yellow-50 rounded-md text-sm text-yellow-800">
                                                ⚠️ Twitter Client ID & Secret not configured in backend .env file.
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <p className="text-xs text-muted-foreground pt-2">
                                For Twitter API v2, ensure you have set up OAuth 2.0 with the correct Redirect URI in the Developer Portal.
                            </p>
                        </div>

                        <div className="space-y-2 pt-4 border-t border-border">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-medium">OpenRouter Configuration</h3>
                            </div>
                            <Label htmlFor="openRouterApiKey">OpenRouter API Key</Label>
                            <Input
                                id="openRouterApiKey"
                                name="openRouterApiKey"
                                type="password"
                                value={formData.openRouterApiKey}
                                onChange={handleChange}
                                placeholder="Enter OpenRouter API Key"
                            />
                            <p className="text-xs text-muted-foreground">
                                Required for AI features (Smart Writing). Get one at <a href="https://openrouter.ai" target="_blank" rel="noreferrer" className="underline hover:text-primary">openrouter.ai</a>.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="openRouterModelId">OpenRouter Model ID</Label>
                            <Input
                                id="openRouterModelId"
                                name="openRouterModelId"
                                value={formData.openRouterModelId}
                                onChange={handleChange}
                                placeholder="anthropic/claude-sonnet-4.5"
                            />
                            <p className="text-xs text-muted-foreground">
                                Optional. Defaults to <code>anthropic/claude-sonnet-4.5</code> if left empty.
                            </p>
                        </div>

                        <div className="space-y-2 pt-4 border-t border-border">
                            <h3 className="text-lg font-medium">Webhook Integration</h3>
                            <div className="rounded-md bg-muted p-4">
                                <p className="text-sm font-medium mb-2">Save Idea Endpoint</p>
                                <code className="relative rounded bg-muted-foreground/20 px-[0.3rem] py-[0.2rem] font-mono text-sm">
                                    {typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:5002/api/webhooks/idea` : '/api/webhooks/idea'}
                                </code>
                                <p className="text-xs text-muted-foreground mt-2">
                                    Send a POST request with the following JSON body to automatically create an idea and draft post.
                                </p>
                                <pre className="mt-2 w-full rounded-md bg-slate-950 p-4 overflow-x-auto">
                                    <code className="text-white text-xs">
                                        {`{
  "title": "Idea Title",
  "summary": "Description...",
  "tags": ["tag1", "tag2"],
  "source": "n8n:source-name"
}`}
                                    </code>
                                </pre>
                            </div>

                            <div className="rounded-md bg-muted p-4 mt-4">
                                <p className="text-sm font-medium mb-2">Direct Schedule Endpoint</p>
                                <code className="relative rounded bg-muted-foreground/20 px-[0.3rem] py-[0.2rem] font-mono text-sm">
                                    {typeof window !== 'undefined' ? `${window.location.protocol}//${window.location.hostname}:5002/api/webhooks/schedule` : '/api/webhooks/schedule'}
                                </code>
                                <p className="text-xs text-muted-foreground mt-2">
                                    Send a POST request to directly schedule a post.
                                </p>
                                <pre className="mt-2 w-full rounded-md bg-slate-950 p-4 overflow-x-auto">
                                    <code className="text-white text-xs">
                                        {`{
  "content": "Post content...",
  "scheduledTime": "2025-12-25T10:00:00Z", // Optional (defaults to +24h)
  "platforms": ["LINKEDIN"], // Optional
  "authorUrn": "urn:li:person:..." // Optional
}`}
                                    </code>
                                </pre>
                            </div>
                        </div>

                        <div className="space-y-2 pt-4 border-t border-border">
                            <h3 className="text-lg font-medium">Idea History Settings</h3>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="maxHistoryItems">Previous Posts History (Max items to store/reference)</Label>
                                    <div className="flex items-center gap-4">
                                        <Input
                                            id="maxHistoryItems"
                                            name="maxHistoryItems"
                                            type="number"
                                            min="0"
                                            max="15"
                                            value={formData.maxHistoryItems}
                                            onChange={(e) => setFormData({ ...formData, maxHistoryItems: parseInt(e.target.value) || 0 })}
                                            className="w-24"
                                        />
                                        <span className="text-sm text-muted-foreground">
                                            {formData.maxHistoryItems === 0
                                                ? "History disabled. AI will not have context of previous posts."
                                                : `Storing up to ${formData.maxHistoryItems} recent post summaries per idea.`}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Value from 0 to 15. Higher values provide better variety but consume more AI tokens.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2 pt-4 border-t border-border">
                            <h3 className="text-lg font-medium">Brand Voice</h3>
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <Label htmlFor="globalTone">Global Tone (Default)</Label>
                                    <textarea
                                        id="globalTone"
                                        name="globalTone"
                                        value={formData.globalTone}
                                        onChange={(e) => setFormData({ ...formData, globalTone: e.target.value })}
                                        className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                        placeholder="e.g. Write in a professional, authoritative yet accessible tone. Use active voice and lead with data points. Avoid corporate buzzwords."
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        This will be used for all AI generations unless a specific account tone is defined below.
                                    </p>
                                </div>

                                {authors.length > 0 && (
                                    <div className="space-y-4">
                                        <Label>Account-Specific Tones</Label>
                                        <div className="grid gap-4">
                                            {authors.filter(a => a.urn).map((author) => (
                                                <div key={author.urn} className="p-4 border rounded-lg bg-muted/30">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <span className="text-sm font-semibold">{author.name}</span>
                                                        <span className="text-[10px] text-muted-foreground opacity-70">{author.urn?.split(':').pop()}</span>
                                                    </div>
                                                    <textarea
                                                        value={formData.accountTones[author.urn] || ""}
                                                        onChange={(e) => {
                                                            const newTones = { ...formData.accountTones, [author.urn]: e.target.value };
                                                            setFormData({ ...formData, accountTones: newTones });
                                                        }}
                                                        className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                        placeholder={`Specific tone instructions for ${author.name}...`}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2 pt-4 border-t border-border">
                            <h3 className="text-lg font-medium">Audience Targeting</h3>
                            <div className="space-y-2">
                                <Label htmlFor="targetAudiences">Post Audiences (Comma Separated)</Label>
                                <textarea
                                    id="targetAudiences"
                                    name="targetAudiences"
                                    value={formData.targetAudiences}
                                    onChange={(e) => setFormData({ ...formData, targetAudiences: e.target.value })}
                                    className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="e.g. CTOs, Startup Founders, Software Engineers, Marketing Managers"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Define your post audiences here. You can select one when creating a post to tailor the AI content generation.
                                </p>
                            </div>
                        </div>
                        <Button type="submit" disabled={loading}>
                            {loading ? "Saving..." : "Save Changes"}
                        </Button>
                    </form>
                </CardContent>
            </Card >
        </div >
    );
}
