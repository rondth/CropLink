'use client';
import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { useRole } from '@/components/layout/RoleContext';
import { useRouter } from 'next/navigation';

const STATUS_STYLES: Record<string, string> = {
    completed: 'bg-green-50 text-green-600',
    pending: 'bg-orange-50 text-orange-500',
    cancelled: 'bg-red-50 text-red-500',
};

const PLATFORM_FEE_RATE = 0.02 // 2%

const FILTERS = ['all', 'pending', 'completed', 'cancelled'] as const;
type Filter = typeof FILTERS[number];

export default function OrdersPage() {
    const { isAuthenticated, isLoading: authLoading, user } = useAuth();
    const { role } = useRole();
    const router = useRouter();
    const [orders, setOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filter, setFilter] = useState<Filter>('all');
    const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());
    const [counterpartyProfiles, setCounterpartyProfiles] = useState<Record<string, { name?: string; profile_picture_url?: string }>>({});

    const userId = user?.user_id;

    useEffect(() => {
        if (!authLoading && !isAuthenticated) return;
        const fetchData = async () => {
            try {
                const ordersRes = await api.get('/transactions', { params: { role } });
                setOrders(ordersRes.data.transactions ?? []);
                api.get('/reviews/mine')
                    .then(r => setReviewedIds(new Set(r.data)))
                    .catch(() => {});
            } catch (error) {
                console.error("Failed to fetch orders:", error);
                setOrders([]);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [isAuthenticated, authLoading]);

    useEffect(() => {
        if (!orders.length || !userId) return;
        const ids = Array.from(new Set(
            orders.map(o => (o.buyer_id === userId ? o.seller_id : o.buyer_id))
        )).filter(id => id && !counterpartyProfiles[id]);
        if (!ids.length) return;

        Promise.all(ids.map(id =>
            api.get(`/auth/profile/${id}`).then(res => [id, res.data] as const).catch(() => [id, null] as const)
        )).then(results => {
            setCounterpartyProfiles(prev => {
                const next = { ...prev };
                results.forEach(([id, data]) => { if (data) next[id] = data; });
                return next;
            });
        });
    }, [orders, userId]);

    const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);

    if (authLoading) {
        return (
            <div className="flex justify-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-CropLink-primary"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="text-5xl">🔒</div>
                <h2 className="text-xl font-black text-gray-800">Sign in to view your orders</h2>
                <p className="text-sm text-gray-500 text-center">
                    Track your purchases and manage transactions in one place.
                </p>
                <button
                    onClick={() => router.push('/login')}
                    className="w-full max-w-xs bg-CropLink-primary text-white font-bold py-3 rounded-xl"
                >
                    Log In
                </button>
                <button
                    onClick={() => router.push('/signup')}
                    className="w-full max-w-xs border border-CropLink-primary text-CropLink-primary font-bold py-3 rounded-xl"
                >
                    Create Account
                </button>
            </div>
        );
    }

    return (
        <div className="p-6">
            <h1 className="text-2xl font-black text-gray-800 mb-2">Orders</h1>

            <div className="flex gap-2 overflow-x-auto pb-1 mb-4 no-scrollbar">
                {FILTERS.map(f => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={`flex-shrink-0 text-[11px] font-black px-3 py-1.5 rounded-xl capitalize transition-colors ${
                            filter === f
                                ? 'bg-CropLink-primary text-white'
                                : 'bg-gray-100 text-gray-500'
                        }`}
                    >
                        {f}
                    </button>
                ))}
            </div>

            {isLoading ? (
                <div className="flex justify-center py-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-CropLink-primary"></div>
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mt-4">
                    <p className="text-gray-500 text-sm text-center">
                        {filter === 'all' ? 'No orders yet.' : `No ${filter} orders.`}
                    </p>
                </div>
            ) : (
                <div className="flex flex-col gap-3 mt-4">
                    {filtered.map((order) => {
                        const isBuyer = order.buyer_id === userId;
                        const isSeller = order.seller_id === userId;
                        const canReview = order.status === 'completed' && isBuyer;
                        const canReviewBuyer = order.status === 'completed' && isSeller;
                        const reviewed = reviewedIds.has(order.id);
                        const counterpartyId = isBuyer ? order.seller_id : order.buyer_id;
                        const counterpartyProfile = counterpartyId ? counterpartyProfiles[counterpartyId] : null;
                        const counterpartyLabel = isBuyer ? 'Seller' : 'Buyer';

                        return (
                            <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                <button
                                    onClick={() => router.push(`/orders/${order.id}`)}
                                    className="w-full p-4 text-left active:scale-[0.98] transition-transform"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h3 className="font-bold text-gray-800 text-sm">
                                                {order.listing?.crop_name || 'Unknown Crop'}
                                            </h3>
                                            <p className="text-[10px] text-gray-400 font-medium">
                                                Order ID: #{order.id.slice(0, 8).toUpperCase()} • {new Date(order.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <span className={`text-[9px] font-black px-2 py-1 rounded-lg ${STATUS_STYLES[order.status] ?? 'bg-gray-50 text-gray-500'}`}>
                                            {order.status.toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-end border-t border-gray-50 pt-3">
                                        <div className="text-[11px] text-gray-500">
                                            Qty: <span className="font-bold text-gray-700">
                                                {order.quantity} {order.listing?.unit_of_measurement || 'unit'}
                                            </span>
                                        </div>
                                        <div className="text-sm font-black text-CropLink-primary">
                                            {order.currency || order.listing?.currency || '$'}{' '}
                                            {Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(
                                                (order.total ?? order.quantity * (order.listing?.price || 0)) * (1 + PLATFORM_FEE_RATE)
                                            )}
                                        </div>
                                    </div>
                                </button>

                                {counterpartyId && (
                                    <button
                                        onClick={() => router.push(`/user/${counterpartyId}`)}
                                        className="w-full border-t border-gray-50 px-4 py-2.5 flex items-center gap-2.5 active:bg-gray-50 transition-colors"
                                    >
                                        <div className="size-6 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
                                            {counterpartyProfile?.profile_picture_url ? (
                                                <img src={counterpartyProfile.profile_picture_url} className="w-full h-full object-cover" alt="" />
                                            ) : (
                                                <span className="text-[9px] font-black text-gray-400">
                                                    {(counterpartyProfile?.name || '?')[0]?.toUpperCase()}
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[11px] text-gray-400">{counterpartyLabel}:</span>
                                        <span className="text-[11px] font-bold text-gray-700 flex-1 text-left truncate">
                                            {counterpartyProfile?.name ?? '...'}
                                        </span>
                                        <span className="text-[10px] font-black text-CropLink-primary flex-shrink-0">View →</span>
                                    </button>
                                )}

                                {canReview && (
                                    <div className="border-t border-gray-50 px-4 py-2.5 flex items-center justify-between">
                                        {reviewed ? (
                                            <span className="text-[11px] font-black text-green-600">✓ Reviewed</span>
                                        ) : (
                                            <button
                                                onClick={() => router.push(`/orders/${order.id}/review-seller`)}
                                                className="text-[11px] font-black text-CropLink-primary active:opacity-70"
                                            >
                                                Write a Review →
                                            </button>
                                        )}
                                    </div>
                                )}

                                {canReviewBuyer && (
                                    <div className="border-t border-gray-50 px-4 py-2.5 flex items-center justify-between">
                                        {reviewed ? (
                                            <span className="text-[11px] font-black text-green-600">✓ Reviewed</span>
                                        ) : (
                                            <button
                                                onClick={() => router.push(`/orders/${order.id}/review-buyer`)}
                                                className="text-[11px] font-black text-CropLink-primary active:opacity-70"
                                            >
                                                Review Buyer →
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
