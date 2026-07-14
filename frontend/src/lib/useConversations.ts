'use client';
import { useCallback, useEffect, useState } from 'react';
import { getConversations, Conversation } from './api';
import { subscribeToInbox } from './inboxRealtime';
import { truncatePreview } from './utils';

export function useConversations(currentUserId: string | null) {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchConversations = useCallback(() => {
        setIsLoading(true);
        setError(null);
        return getConversations()
            .then(setConversations)
            .catch((err) => {
                setError(err?.response?.data?.detail || 'Failed to load your conversations. Please try again.');
            })
            .finally(() => setIsLoading(false));
    }, []);

    useEffect(() => {
        if (!currentUserId) return;

        return subscribeToInbox(currentUserId, (message) => {
            setConversations((prev) => {
                const idx = prev.findIndex((c) => c.id === message.conversation_id);
                if (idx === -1) return prev;

                const target = prev[idx];
                const next = [...prev];
                next[idx] = {
                    ...target,
                    last_message: { content: truncatePreview(message.content), created_at: message.created_at },
                    unread_count: message.sender_id === currentUserId ? target.unread_count : target.unread_count + 1,
                };
                return next;
            });
        });
    }, [currentUserId]);

    const markReadLocally = useCallback((conversationId: string) => {
        setConversations((prev) => {
            const idx = prev.findIndex((c) => c.id === conversationId);
            if (idx === -1 || prev[idx].unread_count === 0) return prev;
            const next = [...prev];
            next[idx] = { ...next[idx], unread_count: 0 };
            return next;
        });
    }, []);

    return { conversations, isLoading, error, fetchConversations, markReadLocally };
}
