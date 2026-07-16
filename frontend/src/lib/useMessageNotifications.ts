'use client';
import { useCallback, useEffect, useState } from 'react';
import { getMessageNotifications, MessageNotification } from './api';
import { subscribeToInbox } from './inboxRealtime';

export function useMessageNotifications(currentUserId: string | null) {
    const [notifications, setNotifications] = useState<MessageNotification[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchNotifications = useCallback(() => {
        setIsLoading(true);
        setError(null);
        return getMessageNotifications()
            .then(setNotifications)
            .catch((err) => {
                setError(err?.response?.data?.detail || 'Failed to load notifications.');
            })
            .finally(() => setIsLoading(false));
    }, []);

    useEffect(() => {
        if (!currentUserId) {
            setNotifications([]);
            return;
        }
        fetchNotifications();
    }, [currentUserId, fetchNotifications]);

    // Reuses issue #96's shared inbox channel. Refetches rather than patching
    // state locally, since a single INSERT can move a conversation into or
    // out of the capped top-10 unread window returned by the backend.
    useEffect(() => {
        if (!currentUserId) return;
        return subscribeToInbox(currentUserId, () => {
            fetchNotifications();
        });
    }, [currentUserId, fetchNotifications]);

    // Called when the user taps a notification, so it disappears from the
    // dropdown immediately rather than waiting on the next fetch/Realtime
    // event -- the PATCH /conversations/{id}/read call on thread mount is
    // still what actually clears the unread state server-side.
    const removeConversation = useCallback((conversationId: string) => {
        setNotifications((prev) => prev.filter((n) => n.conversation_id !== conversationId));
    }, []);

    return { notifications, isLoading, error, fetchNotifications, removeConversation };
}
