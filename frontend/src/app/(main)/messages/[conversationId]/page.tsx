'use client';
import React from 'react';
import { useRouter } from 'next/navigation';

export default function ConversationThreadPage() {
    const router = useRouter();

    return (
        <div className="relative p-6">
            <button
                onClick={() => router.push('/messages')}
                className="flex items-center gap-1 text-sm text-gray-500 font-medium mb-4 hover:text-gray-800 transition-colors"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Messages
            </button>

            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3 text-center">
                <div className="text-5xl">💬</div>
                <h2 className="text-lg font-black text-gray-800">Chat coming soon</h2>
                <p className="text-sm text-gray-500 max-w-xs">
                    This conversation thread is on its way. Check back soon to send and receive messages here.
                </p>
            </div>
        </div>
    );
}
