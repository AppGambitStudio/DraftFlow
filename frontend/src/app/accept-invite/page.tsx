
"use client";

import React, { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import toast from 'react-hot-toast';
import { Check, ArrowRight } from 'lucide-react';

function AcceptInviteContent() {
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    const { user, refreshProfile } = useAuth();
    const router = useRouter();
    const [accepting, setAccepting] = useState(false);

    const handleAccept = async () => {
        setAccepting(true);
        try {
            const res = await api.post('/invitations/accept', { token });
            toast.success('Invitation accepted!');
            await refreshProfile(); // Refresh profile to get the new tenant in list
            // Optionally switch to new tenant immediately?
            // The backend returns { tenantId }. We could call switchTenant(res.data.tenantId).
            // But getting context switchTenant here might be circular if not careful, but useAuth handles it.
            // For now, simple redirect.
            router.push('/');
        } catch (error: any) {
            const msg = error.response?.data?.error || 'Failed to accept invitation';
            toast.error(msg);
        } finally {
            setAccepting(false);
        }
    };

    if (!token) {
        return (
            <Card className="w-full max-w-md border-red-200 bg-red-50">
                <CardContent className="pt-6 text-center text-red-600">
                    Invalid invitation link.
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full max-w-md shadow-xl">
            <CardHeader className="text-center">
                <CardTitle className="text-2xl">You've been invited!</CardTitle>
                <CardDescription>
                    Join the workspace to collaborate on posts and ideas.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {!user ? (
                    <div className="text-center space-y-4">
                        <p className="text-sm text-muted-foreground">
                            You need to be logged in to accept this invitation.
                        </p>
                        <Button
                            className="w-full"
                            onClick={() => router.push('/login')}
                        >
                            Log In or Sign Up
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                ) : (
                    <div className="text-center space-y-4">
                        <div className="flex items-center justify-center p-4 bg-green-50 rounded-full w-16 h-16 mx-auto mb-4">
                            <Check className="h-8 w-8 text-green-600" />
                        </div>
                        <p className="text-sm">
                            Logged in as <span className="font-semibold">{user.email}</span>
                        </p>
                        <Button
                            className="w-full"
                            onClick={handleAccept}
                            disabled={accepting}
                        >
                            {accepting ? 'Joining...' : 'Accept & Join Workspace'}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default function AcceptInvitePage() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <Suspense fallback={<div>Loading invitation...</div>}>
                <AcceptInviteContent />
            </Suspense>
        </div>
    );
}
