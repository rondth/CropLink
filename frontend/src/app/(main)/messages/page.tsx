'use client';
import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { useConversations } from '@/lib/useConversations';
import { timeAgo } from '@/lib/utils';

function ConversationSkeletonRow() {
    return (
        <div className="flex items-center gap-3 px-4 py-3 animate-pulse">
            <div className="w-12 h-12 rounded-full bg-gray-200 shrink-0" />
            <div className="flex-1 flex flex-col gap-2">
                <div className="h-3 bg-gray-200 rounded w-1/3" />
                <div className="h-2.5 bg-gray-200 rounded w-1/4" />
                <div className="h-2.5 bg-gray-200 rounded w-2/3" />
            </div>
        </div>
    );
}

function MessagesContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, isAuthenticated, isLoading: authLoading } = useAuth();
    const { conversations, isLoading, error, fetchConversations, markReadLocally } = useConversations(user?.user_id ?? null);
    const [toast, setToast] = useState<string | null>(null);

    useEffect(() => {
        const toastMessage = searchParams.get('error');
        if (!toastMessage) return;
        setToast(toastMessage);
        router.replace('/messages');
    }, [searchParams, router]);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 4000);
        return () => clearTimeout(t);
    }, [toast]);

    useEffect(() => {
        if (authLoading) return;
        if (!isAuthenticated) return;
        fetchConversations();
    }, [authLoading, isAuthenticated, fetchConversations]);

    if (!authLoading && !isAuthenticated) {
        return (
            <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="text-5xl">🔒</div>
                <h2 className="text-xl font-black text-gray-800">Sign in to view your messages</h2>
                <p className="text-sm text-gray-500 text-center">
                    Chat with buyers and sellers about listings you care about.
                </p>
                <button
                    onClick={() => router.push('/login')}
                    className="w-full max-w-xs bg-CropLink-primary text-white font-bold py-3 rounded-xl"
                >
                    Log In
                </button>
                <button
                    onClick={() => router.push('/signup')}
                    className="w-full max-w-xs border border-CropLink-primary text-CropLink-primary font-bold py-3 rounded-xl"
                >
                    Create Account
                </button>
            </div>
        );
    }

    return (
        <div className="pb-4">
            <div className="p-6 pb-2">
                <h1 className="text-2xl font-black text-gray-800">Messages</h1>
            </div>

            {authLoading || isLoading ? (
                <div className="flex flex-col">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <ConversationSkeletonRow key={i} />
                    ))}
                </div>
            ) : error ? (
                <div className="mx-6 mt-4 bg-red-50 border border-red-100 rounded-xl p-4 flex flex-col items-center gap-3">
                    <p className="text-xs font-bold text-red-500 text-center">{error}</p>
                    <button
                        onClick={fetchConversations}
                        className="text-xs font-black text-white bg-CropLink-accentRed px-4 py-2 rounded-lg active:scale-95 transition-transform"
                    >
                        Retry
                    </button>
                </div>
            ) : conversations.length === 0 ? (
                <div className="mx-6 mt-6 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center gap-3 text-center">
                    {/* <div className="text-4xl"> Logo Placeholder </div> */} 
                    <p className="text-sm text-gray-500">
                        No conversations yet.
                        <br />
                        Message a seller from any listing to get started.
                    </p>
                </div>
            ) : (
                <div className="flex flex-col divide-y divide-gray-100">
                    {conversations.map((c) => {
                        const hasUnread = c.unread_count > 0;
                        return (
                            <button
                                key={c.id}
                                onClick={() => {
                                    markReadLocally(c.id);
                                    router.push(`/messages/${c.id}`);
                                }}
                                className="flex items-center gap-3 px-4 py-3 text-left active:bg-gray-50 transition-colors"
                            >
                                <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 shrink-0">
                                    <img
                                        src={c.other_participant?.profile_picture_url || '/profile.png'}
                                        alt={c.other_participant?.name || 'User'}
                                        className="w-full h-full object-cover"
                                    />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className={`text-sm truncate ${hasUnread ? 'font-black text-gray-900' : 'font-bold text-gray-800'}`}>
                                            {c.other_participant?.name || 'Unknown user'}
                                        </p>
                                        {c.last_message?.created_at && (
                                            <span className={`text-[10px] shrink-0 ${hasUnread ? 'font-bold text-CropLink-primary' : 'text-gray-400'}`}>
                                                {timeAgo(c.last_message.created_at)}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-gray-400 truncate">{c.listing?.crop_name}</p>
                                    <div className="flex items-center justify-between gap-2 mt-0.5">
                                        <p className={`text-xs truncate flex-1 ${hasUnread ? 'font-semibold text-gray-700' : 'text-gray-500'}`}>
                                            {c.last_message?.content || 'No messages yet'}
                                        </p>
                                        {hasUnread && (
                                            <span className="shrink-0 bg-CropLink-primary text-white text-[10px] font-black rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                                                {c.unread_count > 9 ? '9+' : c.unread_count}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {toast && (
                <div className="fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 pointer-events-none">
                    <div className="pointer-events-auto px-4 py-3 rounded-xl shadow-lg text-xs font-bold text-white text-center max-w-xs bg-CropLink-accentRed">
                        {toast}
                    </div>
                </div>
            )}
        </div>
    );
}

export default function MessagesPage() {
    return (
        <Suspense fallback={null}>
            <MessagesContent />
        </Suspense>
    );
}
