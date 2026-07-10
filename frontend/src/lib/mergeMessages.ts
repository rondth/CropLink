import { Message } from './api';

export interface ThreadMessage extends Message {
    status: 'sent' | 'sending' | 'failed';
}

const keyFor = (m: ThreadMessage): string => (m.client_msg_id ? `cid:${m.client_msg_id}` : `id:${m.id}`);

const rank = (status: ThreadMessage['status']): number => (status === 'sent' ? 1 : 0);

export function mergeMessages(existing: ThreadMessage[], incoming: ThreadMessage[]): ThreadMessage[] {
    const byKey = new Map<string, ThreadMessage>();

    for (const m of existing) {
        byKey.set(keyFor(m), m);
    }
    for (const m of incoming) {
        const key = keyFor(m);
        const prior = byKey.get(key);
        if (!prior || rank(m.status) >= rank(prior.status)) {
            byKey.set(key, m);
        }
    }

    return Array.from(byKey.values()).sort((a, b) => {
        const byTime = a.created_at.localeCompare(b.created_at);
        return byTime !== 0 ? byTime : a.id.localeCompare(b.id);
    });
}
