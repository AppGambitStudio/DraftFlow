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
    const [config, setConfig] = useState({
        isLinkedinConfigured: false,
        isTwitterConfigured: false
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
        linkedinAccessToken: "",
        twitterAccessToken: "",
        twitterRefreshToken: "",
        openRouterApiKey: "",
        openRouterModelId: "",
        targetAudiences: "",
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await api.get("/settings");
            setFormData({
                linkedinAccessToken: res.data.linkedinAccessToken || "",
                twitterAccessToken: res.data.twitterAccessToken || "",
                twitterRefreshToken: res.data.twitterRefreshToken || "",
                openRouterApiKey: res.data.openRouterApiKey || "",
                openRouterModelId: res.data.openRouterModelId || "",
                targetAudiences: res.data.targetAudiences || "",
            });
            setConfig({
                isLinkedinConfigured: res.data.isLinkedinConfigured || false,
                isTwitterConfigured: res.data.isTwitterConfigured || false
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

    const confirmDisconnect = () => {
        if (disconnectDialog.platform === 'linkedin') {
            setFormData(prev => ({ ...prev, linkedinAccessToken: '' }));
            toast.success("Disconnected from LinkedIn");
        } else if (disconnectDialog.platform === 'twitter') {
            setFormData(prev => ({
                ...prev,
                twitterAccessToken: '',
                twitterRefreshToken: ''
            }));
            toast.success("Disconnected from Twitter");
        }
        setDisconnectDialog({ isOpen: false, platform: null });
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
                    <CardTitle>LinkedIn Configuration</CardTitle>
                    <CardDescription>
                        Connect your LinkedIn account to enable posting.
                    </CardDescription>
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

                            {formData.linkedinAccessToken ? (
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
                                disabled={loading || !formData.linkedinAccessToken}
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
                                        const id = org.urn.split(':').pop();
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
                                <h3 className="text-lg font-medium">Twitter Configuration</h3>
                            </div>

                            <div className="pt-2">
                                {formData.twitterAccessToken ? ( // Checking access token presence to determine connection status
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
                            <h3 className="text-lg font-medium">Audience Targeting</h3>
                            <div className="space-y-2">
                                <Label htmlFor="targetAudiences">Target Audiences (Comma Separated)</Label>
                                <textarea
                                    id="targetAudiences"
                                    name="targetAudiences"
                                    value={formData.targetAudiences}
                                    onChange={(e) => setFormData({ ...formData, targetAudiences: e.target.value })}
                                    className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="e.g. CTOs, Startup Founders, Software Engineers, Marketing Managers"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Define your target audiences here. You can select one when creating a post to tailor the AI content generation.
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
