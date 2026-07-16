import { supabase } from './supabase';

export interface IncomingMessageRow {
    conversation_id: string;
    sender_id: string;
    content: string;
    created_at: string;
}

export type InboxConnectionStatus = 'connecting' | 'connected' | 'disconnected';

type Listener = (message: IncomingMessageRow) => void;
type StatusListener = (status: InboxConnectionStatus) => void;

interface InboxSubscription {
    channel: ReturnType<typeof supabase.channel>;
    listeners: Set<Listener>;
    statusListeners: Set<StatusListener>;
    status: InboxConnectionStatus;
}

const subscriptions = new Map<string, InboxSubscription>();

function mapStatus(status: string): InboxConnectionStatus {
    if (status === 'SUBSCRIBED') return 'connected';
    if (status === 'TIMED_OUT' || status === 'CLOSED' || status === 'CHANNEL_ERROR') return 'disconnected';
    return 'connecting';
}

function getOrCreateSubscription(userId: string): InboxSubscription {
    const existing = subscriptions.get(userId);
    if (existing) return existing;

    const listeners = new Set<Listener>();
    const statusListeners = new Set<StatusListener>();
    const entry: InboxSubscription = {
        channel: null as unknown as ReturnType<typeof supabase.channel>,
        listeners,
        statusListeners,
        status: 'connecting',
    };
    entry.channel = supabase
        .channel(`inbox:${userId}`)
        .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages' },
            (payload) => {
                const message = payload.new as IncomingMessageRow;
                listeners.forEach((l) => l(message));
            }
        )
        .subscribe((status) => {
            entry.status = mapStatus(status);
            statusListeners.forEach((l) => l(entry.status));
        });

    subscriptions.set(userId, entry);
    return entry;
}

function releaseIfIdle(userId: string, sub: InboxSubscription) {
    if (sub.listeners.size === 0 && sub.statusListeners.size === 0) {
        supabase.removeChannel(sub.channel);
        subscriptions.delete(userId);
    }
}

// Shared per-user channel: every caller for the same userId reuses this one
// subscription instead of opening a new Realtime channel per component.
export function subscribeToInbox(userId: string, listener: Listener): () => void {
    const sub = getOrCreateSubscription(userId);
    sub.listeners.add(listener);
    return () => {
        sub.listeners.delete(listener);
        releaseIfIdle(userId, sub);
    };
}

// Reports connection transitions on that same shared channel, so callers can
// resync (e.g. refetch a count) on reconnect without polling.
export function subscribeToInboxStatus(userId: string, listener: StatusListener): () => void {
    const sub = getOrCreateSubscription(userId);
    sub.statusListeners.add(listener);
    listener(sub.status);
    return () => {
        sub.statusListeners.delete(listener);
        releaseIfIdle(userId, sub);
    };
}
