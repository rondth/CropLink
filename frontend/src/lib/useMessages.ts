'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getMessages, markConversationRead, sendMessage as sendMessageApi, Message } from './api';
import { supabase } from './supabase';

export interface ThreadMessage extends Message {
    status: 'sent' | 'sending' | 'failed';
    clientId?: string;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

const POLL_INTERVAL_MS = 5000;
const PAGE_SIZE = 50;
// How close an optimistic message's client-side timestamp must be to an
// incoming server message (same sender + content) to be treated as the same
// message rather than a coincidental duplicate.
const RECONCILE_WINDOW_MS = 10000;
// How long the Realtime channel may stay non-'connected' before we fall
// back to polling as a safety net.
const DISCONNECT_GRACE_MS = 10000;
// Debounce window for mark-as-read calls so a burst of incoming messages
// collapses into a single PATCH /conversations/{id}/read request.
const READ_DEBOUNCE_MS = 800;

const toAscending = (rows: Message[]): ThreadMessage[] =>
    [...rows].reverse().map((m) => ({ ...m, status: 'sent' as const }));

export function useMessages(conversationId: string | null, currentUserId: string | null) {
    const [messages, setMessages] = useState<ThreadMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingOlder, setIsLoadingOlder] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [forbidden, setForbidden] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
    const [pollingActive, setPollingActive] = useState(false);

    const messagesRef = useRef<ThreadMessage[]>([]);
    messagesRef.current = messages;
    const isLoadingOlderRef = useRef(false);
    const hasMoreRef = useRef(true);
    const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const markReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const loadInitial = useCallback(() => {
        if (!conversationId) return;
        setIsLoading(true);
        getMessages(conversationId, { limit: PAGE_SIZE })
            .then((rows) => {
                setMessages(toAscending(rows));
                setHasMore(rows.length === PAGE_SIZE);
                hasMoreRef.current = rows.length === PAGE_SIZE;
                setNotFound(false);
                setForbidden(false);
            })
            .catch((err) => {
                if (err?.response?.status === 404) setNotFound(true);
                else if (err?.response?.status === 403) setForbidden(true);
            })
            .finally(() => setIsLoading(false));
    }, [conversationId]);

    useEffect(() => {
        loadInitial();
    }, [loadInitial]);

    // Debounces PATCH /conversations/{id}/read so a burst of incoming
    // messages collapses into one request. Skipped entirely while the tab
    // is hidden -- we only mark messages read while the user can see them.
    const scheduleMarkRead = useCallback(() => {
        if (!conversationId) return;
        if (document.visibilityState !== 'visible') return;
        if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
        markReadTimerRef.current = setTimeout(() => {
            markReadTimerRef.current = null;
            markConversationRead(conversationId).catch(() => {});
        }, READ_DEBOUNCE_MS);
    }, [conversationId]);

    // Mark read once when the thread mounts (or the conversation changes).
    useEffect(() => {
        if (!conversationId || notFound || forbidden) return;
        markConversationRead(conversationId).catch(() => {});
    }, [conversationId, notFound, forbidden]);

    useEffect(() => {
        return () => {
            if (markReadTimerRef.current) {
                clearTimeout(markReadTimerRef.current);
                markReadTimerRef.current = null;
            }
        };
    }, [conversationId]);

    // Applies a single message delivered over the Realtime channel: skips it
    // if we already have that server id (e.g. our own send() already
    // resolved it), replaces a matching optimistic placeholder in place if
    // one is pending, otherwise appends it.
    const applyIncomingMessage = useCallback((incoming: Message) => {
        setMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev;

            const incomingTime = new Date(incoming.created_at).getTime();
            const optimisticIdx = prev.findIndex(
                (m) =>
                    m.status !== 'sent' &&
                    m.sender_id === incoming.sender_id &&
                    m.content === incoming.content &&
                    Math.abs(new Date(m.created_at).getTime() - incomingTime) < RECONCILE_WINDOW_MS
            );

            if (optimisticIdx !== -1) {
                const next = [...prev];
                next[optimisticIdx] = { ...incoming, status: 'sent', clientId: prev[optimisticIdx].clientId };
                return next;
            }

            return [...prev, { ...incoming, status: 'sent' as const }].sort((a, b) =>
                a.created_at.localeCompare(b.created_at)
            );
        });

        if (incoming.sender_id !== currentUserId) {
            scheduleMarkRead();
        }
    }, [currentUserId, scheduleMarkRead]);

    // Patches read_at in place when the Realtime channel delivers an UPDATE
    // (e.g. the other participant's PATCH /read set read_at on our message).
    const applyMessageUpdate = useCallback((updated: Message) => {
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? { ...m, read_at: updated.read_at } : m)));
    }, []);

    // Realtime subscription, scoped to this conversation.
    useEffect(() => {
        if (!conversationId || notFound || forbidden) return;

        setConnectionStatus('connecting');

        const channel = supabase
            .channel(`messages:conversation:${conversationId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${conversationId}`,
                },
                (payload) => applyIncomingMessage(payload.new as Message)
            )
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'messages',
                    filter: `conversation_id=eq.${conversationId}`,
                },
                (payload) => applyMessageUpdate(payload.new as Message)
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') setConnectionStatus('connected');
                else if (status === 'TIMED_OUT' || status === 'CLOSED' || status === 'CHANNEL_ERROR') {
                    setConnectionStatus('disconnected');
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [conversationId, notFound, forbidden, applyIncomingMessage, applyMessageUpdate]);

    // Safety-net polling: only kicks in once the channel has been anything
    // other than 'connected' for DISCONNECT_GRACE_MS, and turns off again as
    // soon as it reconnects.
    useEffect(() => {
        if (connectionStatus === 'connected') {
            if (disconnectTimerRef.current) {
                clearTimeout(disconnectTimerRef.current);
                disconnectTimerRef.current = null;
            }
            setPollingActive(false);
            return;
        }

        if (disconnectTimerRef.current) return;
        disconnectTimerRef.current = setTimeout(() => {
            setPollingActive(true);
            disconnectTimerRef.current = null;
        }, DISCONNECT_GRACE_MS);

        return () => {
            if (disconnectTimerRef.current) {
                clearTimeout(disconnectTimerRef.current);
                disconnectTimerRef.current = null;
            }
        };
    }, [connectionStatus]);

    const mergeLatest = useCallback((rows: Message[]) => {
        const incoming = toAscending(rows);
        if (incoming.length === 0) return;
        const incomingIds = new Set(incoming.map((m) => m.id));
        const oldestIncomingCreatedAt = incoming[0].created_at;

        setMessages((prev) => {
            const kept = prev.filter((m) => {
                if (m.status !== 'sent') {
                    // Drop local optimistic/failed placeholders once the real message
                    // shows up from the server (race between send() and a poll tick).
                    const reconciled = incoming.some((i) => i.sender_id === m.sender_id && i.content === m.content);
                    return !reconciled;
                }
                if (incomingIds.has(m.id)) return false;
                return m.created_at < oldestIncomingCreatedAt;
            });
            return [...kept, ...incoming];
        });
    }, []);

    // Polling fallback, gated behind `pollingActive` so it's dormant while
    // the Realtime channel is healthy.
    useEffect(() => {
        if (!conversationId || notFound || forbidden || !pollingActive) return;

        const poll = () => {
            if (document.visibilityState !== 'visible') return;
            getMessages(conversationId, { limit: PAGE_SIZE })
                .then(mergeLatest)
                .catch(() => {});
        };

        poll();
        const interval = setInterval(poll, POLL_INTERVAL_MS);
        const onVisibility = () => {
            if (document.visibilityState === 'visible') poll();
        };
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [conversationId, notFound, forbidden, pollingActive, mergeLatest]);

    const loadOlder = useCallback(() => {
        if (!conversationId || isLoadingOlderRef.current || !hasMoreRef.current) return;
        const oldest = messagesRef.current.find((m) => m.status === 'sent');
        if (!oldest) return;

        isLoadingOlderRef.current = true;
        setIsLoadingOlder(true);
        getMessages(conversationId, { limit: PAGE_SIZE, before: oldest.created_at })
            .then((rows) => {
                const older = toAscending(rows);
                setMessages((prev) => {
                    const existingIds = new Set(prev.map((m) => m.id));
                    const deduped = older.filter((m) => !existingIds.has(m.id));
                    return [...deduped, ...prev];
                });
                hasMoreRef.current = rows.length === PAGE_SIZE;
                setHasMore(rows.length === PAGE_SIZE);
            })
            .catch(() => {})
            .finally(() => {
                isLoadingOlderRef.current = false;
                setIsLoadingOlder(false);
            });
    }, [conversationId]);

    const send = useCallback((content: string) => {
        if (!conversationId || !currentUserId) return Promise.resolve();
        const clientId = `c${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const optimistic: ThreadMessage = {
            id: `temp-${clientId}`,
            clientId,
            conversation_id: conversationId,
            sender_id: currentUserId,
            content,
            created_at: new Date().toISOString(),
            read_at: null,
            status: 'sending',
        };
        setMessages((prev) => [...prev, optimistic]);

        return sendMessageApi(conversationId, content)
            .then((saved) => {
                setMessages((prev) => prev.map((m) => (m.clientId === clientId ? { ...saved, status: 'sent' as const, clientId } : m)));
            })
            .catch(() => {
                setMessages((prev) => prev.map((m) => (m.clientId === clientId ? { ...m, status: 'failed' as const } : m)));
            });
    }, [conversationId, currentUserId]);

    const retry = useCallback((clientId: string) => {
        if (!conversationId) return;
        const target = messagesRef.current.find((m) => m.clientId === clientId);
        if (!target || target.status === 'sending') return;

        setMessages((prev) => prev.map((m) => (m.clientId === clientId ? { ...m, status: 'sending' as const } : m)));
        sendMessageApi(conversationId, target.content)
            .then((saved) => {
                setMessages((prev) => prev.map((m) => (m.clientId === clientId ? { ...saved, status: 'sent' as const, clientId } : m)));
            })
            .catch(() => {
                setMessages((prev) => prev.map((m) => (m.clientId === clientId ? { ...m, status: 'failed' as const } : m)));
            });
    }, [conversationId]);

    return {
        messages,
        isLoading,
        isLoadingOlder,
        hasMore,
        notFound,
        forbidden,
        connectionStatus,
        loadOlder,
        send,
        retry,
    };
}
