import { supabase } from './supabase';

export interface IncomingMessageRow {
    conversation_id: string;
    sender_id: string;
    content: string;
    created_at: string;
}

type Listener = (message: IncomingMessageRow) => void;

interface InboxSubscription {
    channel: ReturnType<typeof supabase.channel>;
    listeners: Set<Listener>;
}

const subscriptions = new Map<string, InboxSubscription>();

export function subscribeToInbox(userId: string, listener: Listener): () => void {
    let sub = subscriptions.get(userId);
    if (!sub) {
        const listeners = new Set<Listener>();
        const channel = supabase
            .channel(`inbox:${userId}`)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'messages' },
                (payload) => {
                    const message = payload.new as IncomingMessageRow;
                    listeners.forEach((l) => l(message));
                }
            )
            .subscribe();
        sub = { channel, listeners };
        subscriptions.set(userId, sub);
    }

    sub.listeners.add(listener);
    return () => {
        sub!.listeners.delete(listener);
        if (sub!.listeners.size === 0) {
            supabase.removeChannel(sub!.channel);
            subscriptions.delete(userId);
        }
    };
}
