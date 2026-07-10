'use client';
import { useCallback, useEffect, useState } from 'react';
import { getConversations, Conversation } from './api';
import { supabase } from './supabase';

interface IncomingMessageRow {
    conversation_id: string;
    sender_id: string;
    content: string;
    created_at: string;
}

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

    // RLS on public.messages already scopes SELECT (and therefore what
    // Realtime broadcasts) to conversations the connected user participates
    // in, so no participant filter is applied here -- the policy is the
    // gate. We only patch the affected row's preview/unread count in place.
    useEffect(() => {
        if (!currentUserId) return;

        const channel = supabase
            .channel(`inbox:${currentUserId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages' },
                (payload) => {
                    const message = payload.new as IncomingMessageRow;
                    setConversations((prev) => {
                        const idx = prev.findIndex((c) => c.id === message.conversation_id);
                        if (idx === -1) return prev;

                        const target = prev[idx];
                        const next = [...prev];
                        next[idx] = {
                            ...target,
                            last_message: { content: message.content, created_at: message.created_at },
                            unread_count: message.sender_id === currentUserId ? target.unread_count : target.unread_count + 1,
                        };
                        return next;
                    });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [currentUserId]);

    return { conversations, isLoading, error, fetchConversations };
}
