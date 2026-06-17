'use client';
import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { useRouter, useParams } from 'next/navigation';

interface Transaction {
    id: string;
    status: string;
    created_at: string;
    quantity: number;
    currency: string;
    listing?: {
        id: string;
        crop_name: string;
        price: number;
        unit_of_measurement: string;
        photo_url?: string;
        location: string;
        category: string;
    };
    payment?: {
        amount: number;
        status: string;
        currency: string;
        stripe_id: string;
    };
    seller?: { name: string; email: string; };
    buyer?: { name: string; email: string; };
}

const STATUS_STYLES: Record<string, string> = {
    completed: 'bg-green-50 text-green-600 border border-green-100',
    pending:   'bg-orange-50 text-orange-500 border border-orange-100',
    cancelled: 'bg-red-50 text-red-500 border border-red-100',
};

export default function OrderDetailPage() {
    const { isAuthenticated, isLoading: authLoading, user } = useAuth();
    const router = useRouter();
    const params = useParams();
    const transactionId = params?.id as string;

    const [order, setOrder] = useState<Transaction | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [updating, setUpdating] = useState(false);

    const role = (user as any)?.user_metadata?.role ?? (user as any)?.role;

    useEffect(() => {
        if (!authLoading && !isAuthenticated) return;
        if (!transactionId) return;

        const fetchOrder = async () => {
            try {
                const response = await api.get(`/transactions/${transactionId}`);
                setOrder(response.data);
            } catch (err: any) {
                setError(err?.response?.data?.detail || 'Failed to load order.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchOrder();
    }, [isAuthenticated, authLoading, transactionId]);

    const handleCancel = async () => {
        if (!order) return;
        setUpdating(true);
        try {
            await api.post(`/transactions/${order.id}/cancel`);
            setOrder(prev => prev ? { ...prev, status: 'cancelled' } : prev);
        } catch (err: any) {
            console.log(err?.response);
            alert(err?.response?.data?.detail || 'Failed to cancel order.');
        } finally {
            setUpdating(false);
        }
    };

    if (authLoading || isLoading) {
        return (
            <div className="flex justify-center items-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-CropLink-primary" />
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="text-5xl">🔒</div>
                <h2 className="text-xl font-black text-gray-800">Sign in to view this order</h2>
                <button
                    onClick={() => router.push('/login')}
                    className="w-full max-w-xs bg-CropLink-primary text-white font-bold py-3 rounded-xl"
                >
                    Log In
                </button>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="text-5xl">❌</div>
                <h2 className="text-xl font-black text-gray-800">Order not found</h2>
                <p className="text-sm text-gray-500 text-center">{error}</p>
                <button
                    onClick={() => router.push('/orders')}
                    className="text-CropLink-primary font-bold text-sm"
                >
                    ← Back to Orders
                </button>
            </div>
        );
    }

    if (!order) return null;

    const counterparty = role === 'buyer' ? order.seller : order.buyer;
    const counterpartyLabel = role === 'buyer' ? 'Farmer / Seller' : 'Distributor / Buyer';

    return (
        <div className="p-6 max-w-lg mx-auto">
            {/* Back button */}
            <button
                onClick={() => router.push('/orders')}
                className="flex items-center gap-1 text-sm text-gray-500 font-medium mb-4 hover:text-gray-800 transition-colors"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Orders
            </button>

            {/* Header */}
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="text-xl font-black text-gray-800">Order Detail</h1>
                    <p className="text-[11px] text-gray-400 mt-0.5 font-medium">
                        #{order.id.slice(0, 8).toUpperCase()}
                    </p>
                </div>
                <span className={`text-[10px] font-black px-3 py-1.5 rounded-xl ${STATUS_STYLES[order.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {order.status.toUpperCase()}
                </span>
            </div>

            {/* Crop info card */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-3">
                <div className="flex items-center gap-3">
                    {order.listing?.photo_url ? (
                        <img
                            src={order.listing.photo_url}
                            alt={order.listing.crop_name}
                            className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                        />
                    ) : (
                        <div className="w-14 h-14 rounded-xl bg-green-50 flex items-center justify-center text-2xl flex-shrink-0">
                            🌾
                        </div>
                    )}
                    <div>
                        <h2 className="font-black text-gray-800 text-base leading-tight">
                            {order.listing?.crop_name ?? 'Unknown Crop'}
                        </h2>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                            {order.listing?.category} • {order.listing?.location}
                        </p>
                    </div>
                </div>
            </div>

            {/* Transaction details */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-3">
                <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-3">
                    Transaction Details
                </p>
                <div className="flex flex-col gap-2.5">
                    <Row
                        label="Date"
                        value={new Date(order.created_at).toLocaleDateString('en-SG', {
                            day: 'numeric', month: 'long', year: 'numeric',
                        })}
                    />
                    <Row label="Transaction ID" value={`#${order.id.slice(0, 8).toUpperCase()}`} mono />
                    {order.payment?.stripe_id && (
                        <Row label="Payment Ref" value={order.payment.stripe_id} mono />
                    )}
                    <Row
                        label="Quantity"
                        value={`${order.quantity} ${order.listing?.unit_of_measurement ?? 'units'}`}
                    />
                    <Row
                        label="Price / unit"
                        value={`${order.currency} ${order.listing?.price?.toLocaleString('en-US', { minimumFractionDigits: 2 }) ?? '—'}`}
                    />

                </div>

                {/* Price breakdown */}
                <div className="mt-3 pt-3 border-t border-gray-50 flex flex-col gap-2">
                    <Row
                        label="Subtotal"
                        value={`${order.currency} ${(order.quantity * (order.listing?.price ?? 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                    />
                    <div className="flex justify-between items-center mt-1 pt-2 border-t border-gray-100">
                        <span className="text-sm font-black text-gray-800">Total</span>
                        <span className="text-sm font-black text-CropLink-primary">
                            {order.payment?.currency ?? order.currency}{' '}
                            {order.payment?.amount?.toLocaleString('en-US', { minimumFractionDigits: 2 }) ?? '—'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Counterparty info */}
            {counterparty && (
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-3">
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-3">
                        {counterpartyLabel}
                    </p>
                    <div className="flex flex-col gap-2.5">
                        <Row label="Name" value={counterparty.name} />
                        <Row label="Contact" value={counterparty.email} />
                    </div>
                </div>
            )}

            {/* Cancel order (buyer only, pending orders) */}
            {role === 'buyer' && order.status === 'pending' && (
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-3">
                    <button
                        onClick={handleCancel}
                        disabled={updating}
                        className="w-full bg-red-50 text-red-500 font-bold text-sm py-3 rounded-xl border border-red-100 disabled:opacity-50 active:scale-95 transition-transform"
                    >
                        Cancel Order
                    </button>
                </div>
            )}

            {/* Rating placeholder (Feature 4, Weeks 8-9) */}
            {order.status === 'completed' && (
                <div className="bg-gray-50 rounded-2xl p-4 border border-dashed border-gray-200 mb-3">
                    <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-1">
                        Rate this {role === 'buyer' ? 'Seller' : 'Buyer'}
                    </p>
                    <p className="text-xs text-gray-400">
                        Rating system coming soon
                    </p>
                </div>
            )}
        </div>
    );
}

// Helper component

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="flex justify-between items-start gap-4">
            <span className="text-[11px] text-gray-400 flex-shrink-0">{label}</span>
            <span className={`text-[11px] font-bold text-gray-700 text-right ${mono ? 'font-mono' : ''}`}>
                {value}
            </span>
        </div>
    );
}