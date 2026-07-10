'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getMessages, sendMessage as sendMessageApi, Message } from './api';

export interface ThreadMessage extends Message {
    status: 'sent' | 'sending' | 'failed';
    clientId?: string;
}

const POLL_INTERVAL_MS = 5000;
const PAGE_SIZE = 50;

const toAscending = (rows: Message[]): ThreadMessage[] =>
    [...rows].reverse().map((m) => ({ ...m, status: 'sent' as const }));

export function useMessages(conversationId: string | null, currentUserId: string | null) {
    const [messages, setMessages] = useState<ThreadMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingOlder, setIsLoadingOlder] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [forbidden, setForbidden] = useState(false);

    const messagesRef = useRef<ThreadMessage[]>([]);
    messagesRef.current = messages;
    const isLoadingOlderRef = useRef(false);
    const hasMoreRef = useRef(true);

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

    useEffect(() => {
        if (!conversationId || notFound || forbidden) return;

        const poll = () => {
            if (document.visibilityState !== 'visible') return;
            getMessages(conversationId, { limit: PAGE_SIZE })
                .then(mergeLatest)
                .catch(() => {});
        };

        const interval = setInterval(poll, POLL_INTERVAL_MS);
        const onVisibility = () => {
            if (document.visibilityState === 'visible') poll();
        };
        document.addEventListener('visibilitychange', onVisibility);

        return () => {
            clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [conversationId, notFound, forbidden, mergeLatest]);

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

    return { messages, isLoading, isLoadingOlder, hasMore, notFound, forbidden, loadOlder, send, retry };
}
