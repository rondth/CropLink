'use client';
import React, { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getConversation, ConversationDetail } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { useMessages } from '@/lib/useMessages';
import { isSameCalendarDay, formatDayDivider } from '@/lib/utils';

const MAX_LENGTH = 2000;
const COUNTER_THRESHOLD = 1800;
const TEXTAREA_MAX_HEIGHT = 100; // ~4 lines

function BackArrowIcon() {
    return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
        </svg>
    );
}

function ChevronRightIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 shrink-0">
            <path d="m9 18 6-6-6-6" />
        </svg>
    );
}

function SendIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="m22 2-7 20-4-9-9-4Z" />
            <path d="M22 2 11 13" />
        </svg>
    );
}

function CheckIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M20 6 9 17l-5-5" />
        </svg>
    );
}

function CheckCheckIcon({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M18 6 7 17l-5-5" />
            <path d="m22 10-7.5 7.5L13 16" />
        </svg>
    );
}

function ThreadSkeleton() {
    return (
        <div className="flex flex-col min-h-full">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 animate-pulse">
                <div className="w-8 h-8 rounded-full bg-gray-200 shrink-0" />
                <div className="w-9 h-9 rounded-full bg-gray-200 shrink-0" />
                <div className="flex flex-col gap-2">
                    <div className="h-3 bg-gray-200 rounded w-24" />
                    <div className="h-2.5 bg-gray-200 rounded w-16" />
                </div>
            </div>
            <div className="flex-1 px-4 py-3 flex flex-col gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                        <div className="h-8 w-2/5 bg-gray-100 rounded-2xl animate-pulse" />
                    </div>
                ))}
            </div>
        </div>
    );
}

export default function ConversationThreadPage() {
    const router = useRouter();
    const params = useParams();
    const conversationId = params.conversationId as string;
    const { user, isAuthenticated, isLoading: authLoading } = useAuth();

    const [conversation, setConversation] = useState<ConversationDetail | null>(null);
    const [convoLoading, setConvoLoading] = useState(true);
    const [convoNotFound, setConvoNotFound] = useState(false);
    const [convoForbidden, setConvoForbidden] = useState(false);

    const [draft, setDraft] = useState('');
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const prevScrollHeightRef = useRef<number | null>(null);
    const hasScrolledInitiallyRef = useRef(false);
    const prevLastIdRef = useRef<string | null>(null);

    const {
        messages,
        isLoading: messagesLoading,
        isLoadingOlder,
        hasMore,
        notFound: messagesNotFound,
        forbidden: messagesForbidden,
        connectionStatus,
        isOffline,
        loadOlder,
        send,
        retry,
    } = useMessages(conversationId, user?.user_id ?? null);

    const notFound = convoNotFound || messagesNotFound;
    const forbidden = convoForbidden || messagesForbidden;

    useEffect(() => {
        if (authLoading) return;
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }
        if (!conversationId) return;

        setConvoLoading(true);
        getConversation(conversationId)
            .then(setConversation)
            .catch((err) => {
                if (err?.response?.status === 404) setConvoNotFound(true);
                else if (err?.response?.status === 403) setConvoForbidden(true);
            })
            .finally(() => setConvoLoading(false));
    }, [conversationId, isAuthenticated, authLoading, router]);

    useEffect(() => {
        if (!forbidden) return;
        router.replace(`/messages?error=${encodeURIComponent("You don't have access to that conversation.")}`);
    }, [forbidden, router]);

    // scroll to bottom once messages first arrive
    useEffect(() => {
        if (messagesLoading || hasScrolledInitiallyRef.current || messages.length === 0) return;
        hasScrolledInitiallyRef.current = true;
        const scroller = document.getElementById('main-scroller');
        if (scroller) {
            requestAnimationFrame(() => {
                scroller.scrollTop = scroller.scrollHeight;
            });
        }
    }, [messagesLoading, messages.length]);

    // scroll to bottom whenever the user's own new message lands at the tail
    useEffect(() => {
        if (messages.length === 0) return;
        const last = messages[messages.length - 1];
        if (last.id !== prevLastIdRef.current && last.sender_id === user?.user_id) {
            const scroller = document.getElementById('main-scroller');
            if (scroller) {
                requestAnimationFrame(() => {
                    scroller.scrollTop = scroller.scrollHeight;
                });
            }
        }
        prevLastIdRef.current = last.id;
    }, [messages, user?.user_id]);

    // infinite scroll up
    useEffect(() => {
        const scroller = document.getElementById('main-scroller');
        if (!scroller) return;
        const onScroll = () => {
            if (scroller.scrollTop < 80 && hasMore && !isLoadingOlder) {
                prevScrollHeightRef.current = scroller.scrollHeight;
                loadOlder();
            }
        };
        scroller.addEventListener('scroll', onScroll);
        return () => scroller.removeEventListener('scroll', onScroll);
    }, [hasMore, isLoadingOlder, loadOlder]);

    // preserve scroll position after older messages are prepended
    useEffect(() => {
        if (prevScrollHeightRef.current == null) return;
        const scroller = document.getElementById('main-scroller');
        if (!scroller) return;
        const diff = scroller.scrollHeight - prevScrollHeightRef.current;
        scroller.scrollTop += diff;
        prevScrollHeightRef.current = null;
    }, [messages]);

    // auto-grow textarea up to ~4 lines
    useEffect(() => {
        const ta = textareaRef.current;
        if (!ta) return;
        ta.style.height = 'auto';
        ta.style.height = `${Math.min(ta.scrollHeight, TEXTAREA_MAX_HEIGHT)}px`;
    }, [draft]);

    const handleDraftChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setDraft(e.target.value.slice(0, MAX_LENGTH));
    };

    const handleSend = () => {
        const content = draft.trim();
        if (!content) return;
        setDraft('');
        send(content);
    };

    if (authLoading || convoLoading || (messagesLoading && !notFound && !forbidden)) {
        return <ThreadSkeleton />;
    }

    if (forbidden) {
        return null;
    }

    if (notFound) {
        return (
            <div className="p-6 flex flex-col items-center justify-center min-h-[70vh] gap-3 text-center">
                <h2 className="text-lg font-black text-gray-800">Conversation not found</h2>
                <p className="text-sm text-gray-500 max-w-xs">
                    This conversation may have been removed, or the link is incorrect.
                </p>
                <button
                    onClick={() => router.push('/messages')}
                    className="mt-2 bg-CropLink-primary text-white text-sm font-black py-2.5 px-5 rounded-xl active:scale-95 transition-transform"
                >
                    Back to Messages
                </button>
            </div>
        );
    }

    const other = conversation?.other_participant;
    const listing = conversation?.listing;

    return (
        <div className="flex flex-col min-h-full">
            <div className="sticky top-0 z-20 bg-[#faf8f5]">
                <div className="flex items-center gap-2 px-3 py-3 border-b border-gray-100">
                    <button
                        onClick={() => router.push('/messages')}
                        className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-gray-500 active:bg-gray-100 transition-colors"
                    >
                        <BackArrowIcon />
                    </button>
                    <button
                        onClick={() => other && router.push(`/user/${other.user_id}`)}
                        disabled={!other}
                        className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                    >
                        <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-100 shrink-0">
                            <img
                                src={other?.profile_picture_url || '/profile.png'}
                                alt={other?.name || 'User'}
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-black text-gray-800 truncate">{other?.name || 'Unknown user'}</p>
                            {listing?.crop_name && (
                                <p className="text-[11px] text-gray-400 truncate">{listing.crop_name}</p>
                            )}
                        </div>
                    </button>
                </div>

                {listing && (
                    <button
                        onClick={() => router.push(`/?listing_id=${listing.id}`)}
                        className="w-full flex items-center gap-2.5 px-4 py-2 bg-white border-b border-gray-100 active:bg-gray-50 transition-colors text-left"
                    >
                        <div className="w-8 h-8 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                            <img
                                src={listing.photo_url || '/crop.svg'}
                                alt={listing.crop_name}
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <p className="text-xs font-bold text-CropLink-primary truncate flex-1">{listing.crop_name}</p>
                        <ChevronRightIcon />
                    </button>
                )}
            </div>

            <div className="flex-1 px-4 py-3 flex flex-col gap-1">
                {isOffline ? (
                    <div className="sticky top-0 z-10 flex justify-center py-1.5 mb-1 bg-gray-100 border border-gray-200 rounded-lg">
                        <span className="text-[11px] font-bold text-gray-500">You&apos;re offline, messages will send once you&apos;re back online</span>
                    </div>
                ) : connectionStatus !== 'connected' && (
                    <div className="sticky top-0 z-10 flex justify-center py-1.5 mb-1 bg-amber-50 border border-amber-100 rounded-lg">
                        <span className="text-[11px] font-bold text-amber-600">Reconnecting…</span>
                    </div>
                )}

                {isLoadingOlder && (
                    <div className="flex justify-center py-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-CropLink-primary" />
                    </div>
                )}

                {messages.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center py-10">
                        <p className="text-xs text-gray-400 text-center">No messages yet. Say hello!</p>
                    </div>
                ) : (
                    messages.map((m, i) => {
                        const prev = messages[i - 1];
                        const next = messages[i + 1];
                        const showDivider = !prev || !isSameCalendarDay(prev.created_at, m.created_at);
                        const isOwn = m.sender_id === user?.user_id;
                        const isLastInOwnRun = isOwn && (!next || next.sender_id !== m.sender_id);

                        return (
                            <React.Fragment key={m.id}>
                                {showDivider && (
                                    <div className="flex justify-center my-2">
                                        <span className="text-[10px] font-bold text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">
                                            {formatDayDivider(m.created_at)}
                                        </span>
                                    </div>
                                )}
                                <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                    <div className="flex flex-col max-w-[75%]">
                                        <div
                                            onClick={m.status === 'failed' ? () => retry(m.client_msg_id!) : undefined}
                                            className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words transition-opacity
                                                ${isOwn
                                                    ? m.status === 'failed'
                                                        ? 'bg-red-50 border border-red-200 text-red-600 cursor-pointer'
                                                        : 'bg-CropLink-primary text-white'
                                                    : 'bg-gray-100 text-gray-800'}
                                                ${m.status === 'sending' ? 'opacity-60' : ''}
                                            `}
                                        >
                                            {m.content}
                                        </div>
                                        <div className={`flex items-center gap-1 mt-0.5 px-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                            {m.status === 'failed' ? (
                                                <span className="text-[10px] font-bold text-red-500">Failed · tap to retry</span>
                                            ) : m.status === 'sending' ? (
                                                <span className="text-[10px] text-gray-400">Sending…</span>
                                            ) : (
                                                <>
                                                    <span className="text-[10px] text-gray-400">
                                                        {new Date(m.created_at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                                                    </span>
                                                    {isLastInOwnRun && (
                                                        m.read_at ? (
                                                            <CheckCheckIcon className="text-CropLink-primary" />
                                                        ) : (
                                                            <CheckIcon className="text-gray-400" />
                                                        )
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </React.Fragment>
                        );
                    })
                )}
            </div>

            <div className="sticky bottom-0 z-20 bg-[#faf8f5] border-t border-gray-100 px-3 pt-2 pb-2.5">
                {draft.length > COUNTER_THRESHOLD && (
                    <div className="text-right mb-1">
                        <span className={`text-[10px] font-bold ${draft.length >= MAX_LENGTH ? 'text-CropLink-accentRed' : 'text-gray-400'}`}>
                            {draft.length}/{MAX_LENGTH}
                        </span>
                    </div>
                )}
                <div className="flex items-end gap-2">
                    <textarea
                        ref={textareaRef}
                        value={draft}
                        onChange={handleDraftChange}
                        rows={1}
                        placeholder="Type a message..."
                        className="flex-1 resize-none bg-white border border-gray-200 rounded-2xl px-3.5 py-2.5 text-sm text-gray-800 outline-none focus:border-CropLink-primary transition-colors overflow-y-auto leading-5"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!draft.trim()}
                        className="shrink-0 w-10 h-10 rounded-full bg-CropLink-primary text-white flex items-center justify-center disabled:opacity-40 active:scale-95 transition-all"
                    >
                        <SendIcon />
                    </button>
                </div>
            </div>
        </div>
    );
}
