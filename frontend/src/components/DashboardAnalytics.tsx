"use client";

import { useState, useEffect } from "react";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Legend
} from 'recharts';
import { format, subDays } from 'date-fns';
import { Button } from "./ui/button";
import { TrendingUp, MessageSquare, Share2, Eye } from "lucide-react";
import toast from "react-hot-toast";

export function DashboardAnalytics() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [dateRange, setDateRange] = useState({
        start: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd')
    });

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const res = await api.get(`/analytics?start=${dateRange.start}&end=${dateRange.end}`);
            setData(res.data);
        } catch (error) {
            console.error("Failed to fetch analytics", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAnalytics();
    }, [dateRange]);

    if (loading && !data) return <div className="h-[400px] flex items-center justify-center">Loading analytics...</div>;

    const summary = data?.summary || { totalLikes: 0, totalComments: 0, totalReposts: 0, totalImpressions: 0, totalPosts: 0 };
    const timeSeries = data?.timeSeries || [];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h3 className="text-xl font-semibold">Engagement Overview</h3>
                    <div className="flex items-center gap-2 bg-muted p-1 rounded-md text-sm">
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                            className="bg-transparent border-none focus:ring-0 px-2 py-1"
                        />
                        <span>to</span>
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                            className="bg-transparent border-none focus:ring-0 px-2 py-1"
                        />
                    </div>
                </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Avg. Engagement</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {summary.totalPosts > 0
                                ? ((summary.totalLikes + summary.totalComments + summary.totalReposts) / summary.totalPosts).toFixed(1)
                                : 0}
                        </div>
                        <p className="text-xs text-muted-foreground">Per post</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Reach</CardTitle>
                        <Eye className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summary.totalImpressions.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Impressions</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Likes</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summary.totalLikes.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Across {summary.totalPosts} posts</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Comments</CardTitle>
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{summary.totalComments.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">User interactions</p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Engagement Trends</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={timeSeries}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={(str) => format(new Date(str), 'MMM d')}
                                        stroke="#888888"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        stroke="#888888"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(value) => `${value}`}
                                    />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        labelFormatter={(label) => format(new Date(label), 'PPP')}
                                    />
                                    <Legend verticalAlign="top" height={36} />
                                    <Line type="monotone" dataKey="likes" stroke="#3b82f6" strokeWidth={3} dot={false} name="Likes" />
                                    <Line type="monotone" dataKey="comments" stroke="#10b981" strokeWidth={3} dot={false} name="Comments" />
                                    <Line type="monotone" dataKey="reposts" stroke="#8b5cf6" strokeWidth={3} dot={false} name="Shares" />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Post Volume & Reach</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={timeSeries}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={(str) => format(new Date(str), 'MMM d')}
                                        stroke="#888888"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        stroke="#888888"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                        labelFormatter={(label) => format(new Date(label), 'PPP')}
                                    />
                                    <Bar dataKey="postCount" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Posts Created" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Top Performing Content</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {(data?.topPosts || []).length === 0 ? (
                            <p className="text-sm text-slate-500">No data available yet.</p>
                        ) : (
                            data.topPosts.map((post: any) => (
                                <div key={post.id} className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                                    <div className="flex-1 min-w-0 mr-4">
                                        <p className="text-sm font-medium line-clamp-1 mb-1">{post.content}</p>
                                        <p className="text-xs text-muted-foreground">{format(new Date(post.scheduledTime), 'PPP')}</p>
                                    </div>
                                    <div className="flex items-center gap-6 text-sm">
                                        <div className="flex flex-col items-center">
                                            <span className="font-bold text-blue-600">{post.likesCount}</span>
                                            <span className="text-[10px] text-muted-foreground uppercase">Likes</span>
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <span className="font-bold text-green-600">{post.commentsCount}</span>
                                            <span className="text-[10px] text-muted-foreground uppercase">Comments</span>
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <span className="font-bold text-purple-600">{post.repostsCount}</span>
                                            <span className="text-[10px] text-muted-foreground uppercase">Shares</span>
                                        </div>
                                        <div className="flex flex-col items-center min-w-[60px]">
                                            <span className="font-bold">{post.impressionsCount.toLocaleString()}</span>
                                            <span className="text-[10px] text-muted-foreground uppercase">Reach</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
