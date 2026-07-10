import { describe, it, expect } from 'vitest';
import { mergeMessages, ThreadMessage } from '../lib/mergeMessages';

function msg(overrides: Partial<ThreadMessage>): ThreadMessage {
    return {
        id: 'id-1',
        conversation_id: 'convo-1',
        sender_id: 'user-1',
        content: 'hi',
        created_at: '2026-07-10T00:00:00.000Z',
        read_at: null,
        client_msg_id: null,
        status: 'sent',
        ...overrides,
    };
}

describe('mergeMessages', () => {
    it('returns an empty array for empty inputs', () => {
        expect(mergeMessages([], [])).toEqual([]);
    });

    it('returns existing messages unchanged when incoming is empty', () => {
        const existing = [msg({ id: 'a', created_at: '2026-07-10T00:00:00.000Z' })];
        expect(mergeMessages(existing, [])).toEqual(existing);
    });

    it('sorts out-of-order arrivals into chronological order', () => {
        const later = msg({ id: 'b', created_at: '2026-07-10T00:02:00.000Z' });
        const earlier = msg({ id: 'a', created_at: '2026-07-10T00:01:00.000Z' });

        const result = mergeMessages([], [later, earlier]);

        expect(result.map((m) => m.id)).toEqual(['a', 'b']);
    });

    it('de-duplicates a server message delivered twice (e.g. realtime + poll)', () => {
        const first = msg({ id: 'a', created_at: '2026-07-10T00:00:00.000Z' });
        const duplicate = msg({ id: 'a', created_at: '2026-07-10T00:00:00.000Z' });

        const result = mergeMessages([first], [duplicate]);

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('a');
    });

    it('de-duplicates when the same message appears twice within one incoming batch', () => {
        const a = msg({ id: 'a', created_at: '2026-07-10T00:00:00.000Z' });
        const result = mergeMessages([], [a, { ...a }]);

        expect(result).toHaveLength(1);
    });

    it('reconciles an optimistic placeholder with the server-confirmed row via client_msg_id', () => {
        const optimistic = msg({
            id: 'temp-abc',
            client_msg_id: 'abc',
            status: 'sending',
            created_at: '2026-07-10T00:00:00.000Z',
        });
        const confirmed = msg({
            id: 'server-1',
            client_msg_id: 'abc',
            status: 'sent',
            created_at: '2026-07-10T00:00:00.050Z',
        });

        const result = mergeMessages([optimistic], [confirmed]);

        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('server-1');
        expect(result[0].status).toBe('sent');
    });

    it('keeps a failed placeholder when no matching server message has arrived', () => {
        const failed = msg({ id: 'temp-x', client_msg_id: 'x', status: 'failed' });

        const result = mergeMessages([failed], []);

        expect(result).toHaveLength(1);
        expect(result[0].status).toBe('failed');
    });

    it('does not let a stale sending duplicate override an already-sent message', () => {
        const sent = msg({ id: 'temp-x', client_msg_id: 'x', status: 'sent' });
        const staleSending = msg({ id: 'temp-x', client_msg_id: 'x', status: 'sending' });

        const result = mergeMessages([sent], [staleSending]);

        expect(result).toHaveLength(1);
        expect(result[0].status).toBe('sent');
    });

    it('keys legacy rows without a client_msg_id by server id', () => {
        const a = msg({ id: 'a', client_msg_id: null });
        const b = msg({ id: 'b', client_msg_id: undefined, created_at: '2026-07-10T00:01:00.000Z' });

        const result = mergeMessages([a], [b]);

        expect(result.map((m) => m.id)).toEqual(['a', 'b']);
    });
});
