
"use client";

import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import toast from 'react-hot-toast';
import { Trash2, UserPlus, Mail, Clock, CheckCircle } from 'lucide-react';

interface Member {
    userId: string;
    email: string;
    role: string;
    joinedAt: string;
}

interface Invitation {
    id: string;
    email: string;
    status: string;
    token: string;
    createdAt: string;
}

export default function UsersPage() {
    const { currentTenant } = useAuth();
    const [members, setMembers] = useState<Member[]>([]);
    const [invitations, setInvitations] = useState<Invitation[]>([]);
    const [inviteEmail, setInviteEmail] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);

    const fetchData = async () => {
        try {
            const [membersRes, invitesRes] = await Promise.all([
                api.get('/users'),
                api.get('/invitations')
            ]);
            setMembers(membersRes.data);
            setInvitations(invitesRes.data);
        } catch (error) {
            console.error('Failed to fetch data', error);
            toast.error('Failed to load team data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [currentTenant]); // Refetch if tenant switches

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail) return;
        setSending(true);
        try {
            await api.post('/invitations', { email: inviteEmail });
            toast.success('Invitation sent!');
            setInviteEmail('');
            fetchData();
        } catch (error: any) {
            const msg = error.response?.data?.error || 'Failed to send invitation';
            toast.error(msg);
        } finally {
            setSending(false);
        }
    };

    const handleRevoke = async (id: string) => {
        if (!confirm('Are you sure you want to revoke this invitation?')) return;
        try {
            await api.delete(`/invitations/${id}`);
            toast.success('Invitation revoked');
            setInvitations(invitations.filter(i => i.id !== id));
        } catch (error) {
            toast.error('Failed to revoke invitation');
        }
    };

    const handleRemoveMember = async (userId: string) => {
        if (!confirm('Are you sure you want to remove this member?')) return;
        try {
            await api.delete(`/users/${userId}`);
            toast.success('Member removed');
            setMembers(members.filter(m => m.userId !== userId));
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to remove member');
        }
    };

    return (
        <div className="container mx-auto p-6 max-w-4xl space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Team Management</h1>
                <div className="text-sm text-muted-foreground">
                    Workspace: <span className="font-semibold text-foreground">{currentTenant?.name}</span>
                </div>
            </div>

            {/* Invite Section */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <UserPlus className="h-5 w-5" />
                        Invite New Member
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleInvite} className="flex gap-4">
                        <Input
                            type="email"
                            placeholder="colleague@example.com"
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            required
                            className="flex-1"
                        />
                        <Button type="submit" disabled={sending}>
                            {sending ? 'Sending...' : 'Send Invite'}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* Pending Invitations */}
            {invitations.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Mail className="h-5 w-5" />
                            Pending Invitations
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {invitations.map((invite) => (
                            <div key={invite.id} className="flex items-center justify-between p-3 border rounded-lg bg-slate-50">
                                <div className="flex flex-col">
                                    <span className="font-medium">{invite.email}</span>
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Clock className="h-3 w-3" /> Sent {new Date(invite.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                                        Pending
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => handleRevoke(invite.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Members List */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <CheckCircle className="h-5 w-5" />
                        Team Members
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {loading ? (
                        <p>Loading members...</p>
                    ) : (
                        members.map((member) => (
                            <div key={member.userId} className="flex items-center justify-between p-3 border rounded-lg">
                                <div className="flex flex-col">
                                    <span className="font-medium">{member.email}</span>
                                    <span className="text-xs text-muted-foreground">Joined {new Date(member.joinedAt).toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${member.role === 'OWNER' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>
                                        {member.role}
                                    </span>
                                    {/* Only show remove for others, and if I am owner/admin (logic handled in backend mostly, but UI hint good) */}
                                    {/* Assuming current user can remove if not self (backend checks role) */}
                                    <Button variant="ghost" size="sm" onClick={() => handleRemoveMember(member.userId)} className="text-slate-400 hover:text-red-600">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
