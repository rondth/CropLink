'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { getAdminReports, updateAdminReportStatus, AdminReport } from '@/lib/api';
import { User as UserIcon } from 'lucide-react';

const STATUS_TABS: { key: 'pending' | 'reviewed' | 'dismissed'; label: string }[] = [
    { key: 'pending', label: 'Pending' },
    { key: 'reviewed', label: 'Reviewed' },
    { key: 'dismissed', label: 'Dismissed' },
];

export default function AdminReportsPage() {
    const router = useRouter();
    const { user, isAuthenticated, isLoading: authLoading } = useAuth();
    const [statusFilter, setStatusFilter] = useState<'pending' | 'reviewed' | 'dismissed'>('pending');
    const [reports, setReports] = useState<AdminReport[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [actionTarget, setActionTarget] = useState<{ report: AdminReport; nextStatus: 'reviewed' | 'dismissed' } | null>(null);
    const [actionNote, setActionNote] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    const load = useCallback(() => {
        setIsLoading(true);
        getAdminReports(statusFilter)
            .then(setReports)
            .catch(() => setToast({ type: 'error', message: 'Failed to load reports.' }))
            .finally(() => setIsLoading(false));
    }, [statusFilter]);

    useEffect(() => {
        if (!isAuthenticated) return;
        load();
    }, [isAuthenticated, load]);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 3000);
        return () => clearTimeout(t);
    }, [toast]);

    useEffect(() => {
        if (!authLoading && (!isAuthenticated || !user?.is_admin)) {
            router.replace('/');
        }
    }, [authLoading, isAuthenticated, user, router]);

    const confirmAction = async () => {
        if (!actionTarget) return;
        setActionLoading(true);
        try {
            await updateAdminReportStatus(actionTarget.report.id, {
                status: actionTarget.nextStatus,
                action_taken: actionNote.trim() || undefined,
            });
            setReports(prev => prev.filter(r => r.id !== actionTarget.report.id));
            setToast({ type: 'success', message: `Report marked ${actionTarget.nextStatus}.` });
        } catch (err: any) {
            setToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to update report.' });
        } finally {
            setActionLoading(false);
            setActionTarget(null);
            setActionNote('');
        }
    };

    if (authLoading || !user?.is_admin) {
        return (
            <div className="min-h-screen bg-[#faf8f5] flex justify-center py-20">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-CropLink-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#faf8f5] pb-20 relative">
            <div className="bg-white px-4 py-4 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-10">
                <button
                    onClick={() => router.back()}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 active:scale-95 transition-transform"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                <div>
                    <h1 className="text-base font-black text-gray-800">Reports Queue</h1>
                    {!isLoading && (
                        <p className="text-xs text-gray-400">
                            {reports.length} {statusFilter} report{reports.length !== 1 ? 's' : ''}
                        </p>
                    )}
                </div>
            </div>

            {/* status tabs */}
            <div className="bg-white px-4 pb-3 flex gap-2 border-b border-gray-100 sticky top-[65px] z-10">
                {STATUS_TABS.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setStatusFilter(tab.key)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-transform active:scale-95 ${
                            statusFilter === tab.key
                                ? 'bg-CropLink-primary text-white'
                                : 'bg-gray-100 text-gray-500'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="p-4 flex flex-col gap-3">
                {isLoading ? (
                    <div className="flex justify-center py-16">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-CropLink-primary" />
                    </div>
                ) : reports.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-2">
                        <p className="text-sm font-bold text-gray-400">No {statusFilter} reports.</p>
                    </div>
                ) : (
                    reports.map(report => (
                        <div
                            key={report.id}
                            className="bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-3 flex flex-col gap-3"
                        >
                            <div className="flex items-center gap-3">
                                <div className="size-9 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
                                    {report.reported?.profile_picture_url ? (
                                        <img src={report.reported.profile_picture_url} className="w-full h-full object-cover" alt="" />
                                    ) : (
                                        <UserIcon className="w-4 h-4 text-gray-300" />
                                    )}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-gray-800 truncate">
                                        {report.reported?.name || 'Unknown user'}
                                    </p>
                                    <p className="text-[11px] text-gray-400 truncate">
                                        reported by {report.reporter?.name || 'Unknown'}
                                        {report.created_at ? ` · ${new Date(report.created_at).toLocaleDateString()}` : ''}
                                    </p>
                                </div>
                            </div>

                            <p className="text-xs text-gray-600 leading-relaxed">{report.reason}</p>

                            {report.action_taken && (
                                <p className="text-[11px] text-gray-400 italic">Action: {report.action_taken}</p>
                            )}

                            {statusFilter === 'pending' && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setActionTarget({ report, nextStatus: 'dismissed' })}
                                        className="flex-1 py-2 rounded-xl border border-gray-200 text-xs font-bold text-gray-600 active:scale-95 transition-transform"
                                    >
                                        Dismiss
                                    </button>
                                    <button
                                        onClick={() => setActionTarget({ report, nextStatus: 'reviewed' })}
                                        className="flex-1 py-2 rounded-xl bg-CropLink-primary text-white text-xs font-bold active:scale-95 transition-transform"
                                    >
                                        Review
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* action confirmation */}
            {actionTarget && (
                <div
                    className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
                    onClick={() => !actionLoading && setActionTarget(null)}
                >
                    <div className="bg-white rounded-2xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-sm font-black text-gray-800 mb-1.5">
                            Mark as {actionTarget.nextStatus}?
                        </h3>
                        <p className="text-xs text-gray-500 leading-relaxed mb-3">
                            {actionTarget.report.reported?.name || 'This user'} — {actionTarget.report.reason}
                        </p>
                        <textarea
                            value={actionNote}
                            onChange={(e) => setActionNote(e.target.value)}
                            placeholder="Action taken (optional)"
                            rows={3}
                            className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 mb-5 resize-none focus:outline-none focus:border-CropLink-primary"
                        />
                        <div className="flex gap-3">
                            <button
                                onClick={() => setActionTarget(null)}
                                disabled={actionLoading}
                                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 active:scale-95 transition-transform disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmAction}
                                disabled={actionLoading}
                                className="flex-1 py-3 rounded-xl bg-CropLink-primary text-white text-sm font-bold active:scale-95 transition-transform disabled:opacity-50"
                            >
                                {actionLoading ? 'Saving...' : 'Confirm'}
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
