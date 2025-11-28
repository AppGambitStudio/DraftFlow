"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import toast, { Toaster } from "react-hot-toast";

export default function SettingsPage() {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        linkedinClientId: "",
        linkedinClientSecret: "",
        linkedinAccessToken: "",
        twitterClientId: "",
        twitterClientSecret: "",
        twitterAccessToken: "",
        twitterRefreshToken: "",
        openRouterApiKey: "",
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await api.get("/settings");
            setFormData({
                linkedinClientId: res.data.linkedinClientId || "",
                linkedinClientSecret: res.data.linkedinClientSecret || "",
                linkedinAccessToken: res.data.linkedinAccessToken || "",
                twitterClientId: res.data.twitterClientId || "",
                twitterClientSecret: res.data.twitterClientSecret || "",
                twitterAccessToken: res.data.twitterAccessToken || "",
                twitterRefreshToken: res.data.twitterRefreshToken || "",
                openRouterApiKey: res.data.openRouterApiKey || "",
            });
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

    return (
        <div className="space-y-6">
            <Toaster />
            <h2 className="text-3xl font-bold tracking-tight">Settings</h2>

            <Card>
                <CardHeader>
                    <CardTitle>LinkedIn Configuration</CardTitle>
                    <CardDescription>
                        Enter your LinkedIn App credentials and Access Token.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="linkedinClientId">Client ID</Label>
                            <Input
                                id="linkedinClientId"
                                name="linkedinClientId"
                                value={formData.linkedinClientId}
                                onChange={handleChange}
                                placeholder="Enter Client ID"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="linkedinClientSecret">Client Secret</Label>
                            <Input
                                id="linkedinClientSecret"
                                name="linkedinClientSecret"
                                type="password"
                                value={formData.linkedinClientSecret}
                                onChange={handleChange}
                                placeholder="Enter Client Secret"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="linkedinAccessToken">Access Token</Label>
                            <Input
                                id="linkedinAccessToken"
                                name="linkedinAccessToken"
                                type="password"
                                value={formData.linkedinAccessToken}
                                onChange={handleChange}
                                placeholder="Enter Access Token"
                            />
                            <p className="text-xs text-muted-foreground">
                                For this MVP, please generate a long-lived access token from the LinkedIn Developer Portal and paste it here.
                            </p>
                        </div>

                        <div className="space-y-2 pt-4 border-t border-border">
                            <h3 className="text-lg font-medium">Twitter Configuration</h3>
                            <div className="space-y-2">
                                <Label htmlFor="twitterAccessToken">Access Token</Label>
                                <Input
                                    id="twitterAccessToken"
                                    name="twitterAccessToken"
                                    type="password"
                                    value={formData.twitterAccessToken || ''}
                                    onChange={handleChange}
                                    placeholder="Enter Twitter Access Token"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="twitterRefreshToken">Refresh Token</Label>
                                <Input
                                    id="twitterRefreshToken"
                                    name="twitterRefreshToken"
                                    type="password"
                                    value={formData.twitterRefreshToken || ''}
                                    onChange={handleChange}
                                    placeholder="Enter Twitter Refresh Token"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="twitterClientId">Client ID</Label>
                                <Input
                                    id="twitterClientId"
                                    name="twitterClientId"
                                    value={formData.twitterClientId || ''}
                                    onChange={handleChange}
                                    placeholder="Enter Twitter Client ID"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="twitterClientSecret">Client Secret</Label>
                                <Input
                                    id="twitterClientSecret"
                                    name="twitterClientSecret"
                                    type="password"
                                    value={formData.twitterClientSecret || ''}
                                    onChange={handleChange}
                                    placeholder="Enter Twitter Client Secret"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                For Twitter API v2, you need OAuth 2.0 credentials.
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
                        <Button type="submit" disabled={loading}>
                            {loading ? "Saving..." : "Save Changes"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
