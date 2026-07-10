'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { getUnreadMessageCount } from './api';
import { subscribeToInbox, subscribeToInboxStatus, InboxConnectionStatus } from './inboxRealtime';

interface UnreadMessageCountContextType {
    unreadCount: number;
    refetchUnreadCount: () => void;
    markConversationMessagesRead: (markedCount: number) => void;
}

const UnreadMessageCountContext = createContext<UnreadMessageCountContextType | undefined>(undefined);

export function UnreadMessageCountProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const currentUserId = user?.user_id ?? null;
    const [unreadCount, setUnreadCount] = useState(0);
    const prevStatusRef = useRef<InboxConnectionStatus>('connecting');

    const fetchUnreadCount = useCallback(() => {
        if (!currentUserId) return;
        getUnreadMessageCount()
            .then(setUnreadCount)
            .catch(() => {});
    }, [currentUserId]);

    useEffect(() => {
        if (!currentUserId) {
            setUnreadCount(0);
            return;
        }
        fetchUnreadCount();
    }, [currentUserId, fetchUnreadCount]);

    useEffect(() => {
        if (!currentUserId) return;
        return subscribeToInbox(currentUserId, (message) => {
            if (message.sender_id === currentUserId) return;
            setUnreadCount((prev) => prev + 1);
        });
    }, [currentUserId]);

    useEffect(() => {
        if (!currentUserId) return;
        prevStatusRef.current = 'connecting';
        return subscribeToInboxStatus(currentUserId, (status) => {
            if (prevStatusRef.current === 'disconnected' && status === 'connected') {
                fetchUnreadCount();
            }
            prevStatusRef.current = status;
        });
    }, [currentUserId, fetchUnreadCount]);

    const markConversationMessagesRead = useCallback((markedCount: number) => {
        if (markedCount <= 0) return;
        setUnreadCount((prev) => Math.max(0, prev - markedCount));
    }, []);

    return (
        <UnreadMessageCountContext.Provider value={{ unreadCount, refetchUnreadCount: fetchUnreadCount, markConversationMessagesRead }}>
            {children}
        </UnreadMessageCountContext.Provider>
    );
}

export function useUnreadMessageCount() {
    const context = useContext(UnreadMessageCountContext);
    if (context === undefined) {
        throw new Error('useUnreadMessageCount must be used within an UnreadMessageCountProvider');
    }
    return context;
}
