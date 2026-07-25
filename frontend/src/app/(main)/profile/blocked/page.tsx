'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@/lib/api';
import { User as UserIcon } from 'lucide-react';

interface BlockedUser {
    user_id: string;
    name: string | null;
    role: string | null;
    profile_picture_url: string | null;
    blocked_at: string | null;
}

export default function BlockedUsers() {
    const router = useRouter();
    const { isAuthenticated } = useAuth();
    const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [unblockTarget, setUnblockTarget] = useState<BlockedUser | null>(null);
    const [unblockLoading, setUnblockLoading] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    useEffect(() => {
        if (!isAuthenticated) return;
        api.get('/users/me/blocked')
            .then(res => setBlockedUsers(res.data))
            .catch(() => {})
            .finally(() => setIsLoading(false));
    }, [isAuthenticated]);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 3000);
        return () => clearTimeout(t);
    }, [toast]);

    const confirmUnblock = async () => {
        if (!unblockTarget) return;
        setUnblockLoading(true);
        try {
            await api.post(`/users/${unblockTarget.user_id}/unblock`);
            setBlockedUsers(prev => prev.filter(u => u.user_id !== unblockTarget.user_id));
            setToast({ type: 'success', message: `You've unblocked ${unblockTarget.name || 'this user'}.` });
        } catch (err: any) {
            setToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to unblock user.' });
        } finally {
            setUnblockLoading(false);
            setUnblockTarget(null);
        }
    };

    return (
        <div className="min-h-screen bg-[#faf8f5] pb-20 relative">
            {/* header */}
            <div className="bg-white px-4 py-4 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-10">
                <button
                    onClick={() => router.back()}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 active:scale-95 transition-transform"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                <div>
                    <h1 className="text-base font-black text-gray-800">Blocked Users</h1>
                    {!isLoading && (
                        <p className="text-xs text-gray-400">
                            {blockedUsers.length} user{blockedUsers.length !== 1 ? 's' : ''} blocked
                        </p>
                    )}
                </div>
            </div>

            {/* content */}
            <div className="p-4 flex flex-col gap-2">
                {isLoading ? (
                    <div className="flex justify-center py-16">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-CropLink-primary" />
                    </div>
                ) : blockedUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-2">
                        <p className="text-sm font-bold text-gray-400">You haven't blocked anyone.</p>
                    </div>
                ) : (
                    blockedUsers.map(blockedUser => (
                        <div
                            key={blockedUser.user_id}
                            className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3 flex items-center gap-3"
                        >
                            <div className="size-10 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
                                {blockedUser.profile_picture_url ? (
                                    <img src={blockedUser.profile_picture_url} className="w-full h-full object-cover" alt="" />
                                ) : (
                                    <UserIcon className="w-5 h-5 text-gray-300" />
                                )}
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-800 truncate">{blockedUser.name || 'Unknown user'}</p>
                                {blockedUser.role && (
                                    <span className="inline-flex mt-0.5 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide rounded-full bg-green-50 text-green-700">
                                        {blockedUser.role}
                                    </span>
                                )}
                            </div>

                            <button
                                onClick={() => setUnblockTarget(blockedUser)}
                                className="flex-shrink-0 px-3 py-1.5 rounded-full border border-gray-200 text-xs font-bold text-gray-600 active:scale-95 transition-transform"
                            >
                                Unblock
                            </button>
                        </div>
                    ))
                )}
            </div>

            {/* unblock confirmation */}
            {unblockTarget && (
                <div
                    className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
                    onClick={() => !unblockLoading && setUnblockTarget(null)}
                >
                    <div className="bg-white rounded-2xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-sm font-black text-gray-800 mb-1.5">
                            Unblock {unblockTarget.name || 'this user'}?
                        </h3>
                        <p className="text-xs text-gray-500 leading-relaxed mb-5">
                            They'll be able to see your listings and contact you again.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setUnblockTarget(null)}
                                disabled={unblockLoading}
                                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 active:scale-95 transition-transform disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmUnblock}
                                disabled={unblockLoading}
                                className="flex-1 py-3 rounded-xl bg-CropLink-primary text-white text-sm font-bold active:scale-95 transition-transform disabled:opacity-50"
                            >
                                {unblockLoading ? 'Unblocking...' : 'Unblock'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* toast */}
            {toast && (
                <div className="fixed inset-x-0 bottom-24 z-[60] flex justify-center px-4 pointer-events-none">
                    <div className={`pointer-events-auto px-4 py-3 rounded-xl shadow-lg text-xs font-bold text-white text-center max-w-xs ${toast.type === 'success' ? 'bg-CropLink-primary' : 'bg-CropLink-accentRed'}`}>
                        {toast.message}
                    </div>
                </div>
            )}
        </div>
    );
}
