'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getMessages, markConversationRead, sendMessage as sendMessageApi, Message } from './api';
import { mergeMessages, ThreadMessage } from './mergeMessages';
import { supabase } from './supabase';

export type { ThreadMessage };

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

const POLL_INTERVAL_MS = 5000;
const PAGE_SIZE = 50;
const DISCONNECT_GRACE_MS = 10000;
const READ_DEBOUNCE_MS = 800;
const MAX_SEND_ATTEMPTS = 5;
const BACKOFF_BASE_MS = 1000;
const BACKOFF_CAP_MS = 30000;

interface QueuedSend {
    content: string;
    attempts: number;
    inFlight: boolean;
    timer: ReturnType<typeof setTimeout> | null;
}

const toAscending = (rows: Message[]): ThreadMessage[] =>
    [...rows].reverse().map((m) => ({ ...m, status: 'sent' as const }));

const isOnline = () => typeof navigator === 'undefined' || navigator.onLine;

export function useMessages(conversationId: string | null, currentUserId: string | null) {
    const [messages, setMessages] = useState<ThreadMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingOlder, setIsLoadingOlder] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [forbidden, setForbidden] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
    const [pollingActive, setPollingActive] = useState(false);
    const [online, setOnline] = useState(isOnline);

    const messagesRef = useRef<ThreadMessage[]>([]);
    messagesRef.current = messages;
    const conversationIdRef = useRef(conversationId);
    conversationIdRef.current = conversationId;
    const currentUserIdRef = useRef(currentUserId);
    currentUserIdRef.current = currentUserId;
    const isLoadingOlderRef = useRef(false);
    const hasMoreRef = useRef(true);
    const disconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const markReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const prevConnectionStatusRef = useRef<ConnectionStatus>('connecting');

    // In-memory send queue only -- never persisted, so a refresh drops
    // unsent drafts rather than risking a stale replay across sessions.
    const queueRef = useRef<Map<string, QueuedSend>>(new Map());
    const attemptSendRef = useRef<(clientMsgId: string) => void>(() => {});

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

    // Debounces PATCH /conversations/{id}/read so a burst of incoming messages collapses into one request.
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

    // Applies a single message delivered over the Realtime channel.
    const applyIncomingMessage = useCallback((incoming: Message) => {
        setMessages((prev) => mergeMessages(prev, [{ ...incoming, status: 'sent' as const }]));

        if (incoming.sender_id !== currentUserId) {
            scheduleMarkRead();
        }
    }, [currentUserId, scheduleMarkRead]);

    // Patches read_at in place when the Realtime channel delivers an UPDATE.
    const applyMessageUpdate = useCallback((updated: Message) => {
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? { ...m, read_at: updated.read_at } : m)));
    }, []);

    // Realtime does not replay events missed while disconnected.
    const fillGap = useCallback(() => {
        const convoId = conversationIdRef.current;
        if (!convoId) return;
        const newestSent = [...messagesRef.current].reverse().find((m) => m.status === 'sent');
        getMessages(convoId, { limit: PAGE_SIZE, after: newestSent?.created_at })
            .then((rows) => {
                setMessages((prev) => mergeMessages(prev, toAscending(rows)));
            })
            .catch(() => {});
    }, []);

    // Realtime subscription, scoped to this conversation.
    useEffect(() => {
        if (!conversationId || notFound || forbidden) return;

        setConnectionStatus('connecting');
        prevConnectionStatusRef.current = 'connecting';

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

    // Fires exactly on a disconnected
    useEffect(() => {
        const prev = prevConnectionStatusRef.current;
        prevConnectionStatusRef.current = connectionStatus;

        if (prev === 'disconnected' && connectionStatus === 'connected') {
            fillGap();
            flushQueueRef.current();
        }
    }, [connectionStatus, fillGap]);

    // Safety-net polling.
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
        setMessages((prev) => mergeMessages(prev, incoming));
    }, []);

    // Polling fallback, gated behind `pollingActive` so it's dormant while the Realtime channel is healthy.
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
                setMessages((prev) => mergeMessages(older, prev));
                hasMoreRef.current = rows.length === PAGE_SIZE;
                setHasMore(rows.length === PAGE_SIZE);
            })
            .catch(() => {})
            .finally(() => {
                isLoadingOlderRef.current = false;
                setIsLoadingOlder(false);
            });
    }, [conversationId]);

    // Sends (or retries) a single queued message.
    const attemptSend = useCallback((clientMsgId: string) => {
        const convoId = conversationIdRef.current;
        const item = queueRef.current.get(clientMsgId);
        if (!item || !convoId || item.inFlight) return;
        if (!isOnline()) return;

        item.timer = null;
        item.inFlight = true;
        item.attempts += 1;
        const attemptNumber = item.attempts;

        sendMessageApi(convoId, item.content, clientMsgId)
            .then((saved) => {
                queueRef.current.delete(clientMsgId);
                setMessages((prev) => mergeMessages(prev, [{ ...saved, status: 'sent' as const }]));
            })
            .catch(() => {
                const current = queueRef.current.get(clientMsgId);
                if (!current) return;
                current.inFlight = false;
                if (attemptNumber >= MAX_SEND_ATTEMPTS) {
                    setMessages((prev) =>
                        prev.map((m) => (m.client_msg_id === clientMsgId ? { ...m, status: 'failed' as const } : m))
                    );
                    return;
                }
                const delay = Math.min(BACKOFF_BASE_MS * 2 ** (attemptNumber - 1), BACKOFF_CAP_MS);
                if (current.timer) clearTimeout(current.timer);
                current.timer = setTimeout(() => attemptSendRef.current(clientMsgId), delay);
            });
    }, []);

    useEffect(() => {
        attemptSendRef.current = attemptSend;
    }, [attemptSend]);

    // Kicks every queued message that isn't already mid-attempt or exhausted.
    const flushQueue = useCallback(() => {
        for (const [clientMsgId, item] of queueRef.current) {
            if (item.inFlight || item.attempts >= MAX_SEND_ATTEMPTS) continue;
            if (item.timer) {
                clearTimeout(item.timer);
                item.timer = null;
            }
            attemptSendRef.current(clientMsgId);
        }
    }, []);
    const flushQueueRef = useRef(flushQueue);
    flushQueueRef.current = flushQueue;

    useEffect(() => {
        const handleOnline = () => {
            setOnline(true);
            flushQueueRef.current();
        };
        const handleOffline = () => setOnline(false);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    const send = useCallback((content: string) => {
        const convoId = conversationIdRef.current;
        const senderId = currentUserIdRef.current;
        if (!convoId || !senderId) return;

        const clientMsgId = crypto.randomUUID();
        const optimistic: ThreadMessage = {
            id: `temp-${clientMsgId}`,
            client_msg_id: clientMsgId,
            conversation_id: convoId,
            sender_id: senderId,
            content,
            created_at: new Date().toISOString(),
            read_at: null,
            status: 'sending',
        };
        setMessages((prev) => mergeMessages(prev, [optimistic]));

        queueRef.current.set(clientMsgId, { content, attempts: 0, inFlight: false, timer: null });
        attemptSendRef.current(clientMsgId);
    }, []);

    const retry = useCallback((clientMsgId: string) => {
        let item = queueRef.current.get(clientMsgId);
        if (item) {
            if (item.timer) clearTimeout(item.timer);
            item.timer = null;
            item.attempts = 0;
        } else {
            const target = messagesRef.current.find((m) => m.client_msg_id === clientMsgId);
            if (!target) return;
            item = { content: target.content, attempts: 0, inFlight: false, timer: null };
            queueRef.current.set(clientMsgId, item);
        }

        setMessages((prev) => prev.map((m) => (m.client_msg_id === clientMsgId ? { ...m, status: 'sending' as const } : m)));
        attemptSendRef.current(clientMsgId);
    }, []);

    return {
        messages,
        isLoading,
        isLoadingOlder,
        hasMore,
        notFound,
        forbidden,
        connectionStatus,
        isOffline: !online,
        loadOlder,
        send,
        retry,
    };
}
