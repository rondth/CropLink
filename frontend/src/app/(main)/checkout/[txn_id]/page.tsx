'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

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
    };
}

function CheckoutForm({
    transaction,
    clientSecret,
    onSuccess,
}: {
    transaction: Transaction;
    clientSecret: string;
    onSuccess: () => void;
}) {
    const stripe = useStripe();
    const elements = useElements();
    const [isPaying, setIsPaying] = useState(false);
    const [isReady, setIsReady] = useState(false);
    const [cardError, setCardError] = useState<string | null>(null);
    const subtotal = transaction.quantity * (transaction.listing?.price ?? 0);
    const platformFee = Math.round(subtotal * 0.02 * 100) / 100;
    const total = subtotal + platformFee;
    const currency = transaction.payment?.currency ?? transaction.currency ?? 'USD';

    const fmt = (n: number) =>
        n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    const handlePay = async () => {
        if (!stripe || !elements) return;
        setCardError(null);
        setIsPaying(true);

        const { error } = await stripe.confirmPayment({
            elements,
            redirect: 'if_required',
        });

        if (error) {
            setCardError(error.message ?? 'Payment failed.');
            setIsPaying(false);
        } else {
            const { paymentIntent } = await stripe.retrievePaymentIntent(clientSecret);
            if (paymentIntent?.status === 'succeeded') {
                onSuccess();
            } else {
                setCardError('Payment status unclear. Check your orders for updates.');
                setIsPaying(false);
            }
        }
    };

    return (
        <div className="flex flex-col gap-3">
            {/* Order summary */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-3">
                    Order Summary
                </p>
                <div className="flex items-center gap-3 mb-3">
                    {transaction.listing?.photo_url ? (
                        <img
                            src={transaction.listing.photo_url}
                            alt={transaction.listing.crop_name}
                            className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
                        />
                    ) : (
                        <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center text-xl flex-shrink-0">
                            🌾
                        </div>
                    )}
                    <div>
                        <p className="font-black text-gray-800 text-sm leading-tight">
                            {transaction.listing?.crop_name ?? 'Unknown Crop'}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                            {transaction.listing?.category} · {transaction.listing?.location}
                        </p>
                    </div>
                </div>

                {/* Price rows */}
                <div className="flex flex-col gap-2 pt-3 border-t border-gray-50">
                    <SummaryRow
                        label={`${fmt(transaction.quantity)} ${transaction.listing?.unit_of_measurement ?? 'units'} × ${currency} ${fmt(transaction.listing?.price ?? 0)}`}
                        value={`${currency} ${fmt(subtotal)}`}
                    />
                    <SummaryRow label="Platform fee (2%)" value={`${currency} ${fmt(platformFee)}`} muted />
                    <div className="flex justify-between items-center pt-2 mt-1 border-t border-gray-100">
                        <span className="text-sm font-black text-gray-800">Total</span>
                        <span className="text-sm font-black text-CropLink-primary">{currency} {fmt(total)}</span>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-3">
                    Payment Details
                </p>
                <PaymentElement onReady={() => setIsReady(true)} />
            </div>

            {cardError && (
                <p className="text-red-500 text-xs text-center">{cardError}</p>
            )}

            {/* Pay button */}
            <button
                onClick={handlePay}
                disabled={isPaying || !stripe || !isReady}
                className="w-full bg-CropLink-primary text-white font-black text-sm py-4 rounded-2xl shadow-md shadow-CropLink-primary/25 disabled:opacity-50 active:scale-95 transition-all"
            >
                {isPaying ? (
                <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Processing…
                </span>
                ) : (
                `Pay ${currency} ${fmt(total)}`
                )}
            </button>

            <p className="text-center text-[10px] text-gray-400 font-medium">
                Secured by Stripe.<br />Your card details are never stored.
            </p>
        </div>
    );
}

function SuccessScreen({ transactionId, onViewOrder }: { transactionId: string; onViewOrder: () => void }) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-6">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center text-3xl">
                ✅
            </div>
            <div>
                <h2 className="text-xl font-black text-gray-800">Payment successful</h2>
                <p className="text-sm text-gray-400 mt-1">Your order is confirmed.</p>
            </div>
            <button
                onClick={onViewOrder}
                className="w-full max-w-xs bg-CropLink-primary text-white font-black text-sm py-3.5 rounded-2xl shadow-md shadow-CropLink-primary/25 active:scale-95 transition-transform"
            >
                View Order
            </button>
        </div>
    );
}

export default function CheckoutPage() {
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const params = useParams();
    const transactionId = params?.txn_id as string;

    const [transaction, setTransaction] = useState<Transaction | null>(null);
    const [clientSecret, setClientSecret] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [paid, setPaid] = useState(false);

    const load = useCallback(async () => {
        if (!transactionId) return;
        try {
            const txnRes = await api.get(`/transactions/${transactionId}`);
            const txn: Transaction = txnRes.data;
            setTransaction(txn);

            if (txn.status === 'completed') {
                setPaid(true);
                setIsLoading(false);
                return;
            }

            const payRes = await api.get(`/transactions/${transactionId}/client-secret`);
            setClientSecret(payRes.data.client_secret);
        } catch (err: any) {
            setError(err?.response?.data?.detail || 'Could not load checkout. Please go back and try again.');
        } finally {
            setIsLoading(false);
        }
    }, [transactionId]);

    useEffect(() => {
        if (!authLoading && isAuthenticated) load();
    }, [authLoading, isAuthenticated, load]);

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
                <h2 className="text-xl font-black text-gray-800">Sign in to continue</h2>
                <button
                    onClick={() => router.push('/login')}
                    className="w-full max-w-xs bg-CropLink-primary text-white font-bold py-3 rounded-xl"
                >
                    Log In
                </button>
            </div>
        );
    }

    if (paid) {
        return (
            <div className="max-w-lg mx-auto p-6">
                <SuccessScreen
                    transactionId={transactionId}
                    onViewOrder={() => router.push(`/orders/${transactionId}`)}
                />
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="text-5xl">❌</div>
                <h2 className="text-xl font-black text-gray-800">Something went wrong</h2>
                <p className="text-sm text-gray-500 text-center">{error}</p>
                <button
                    onClick={() => router.push(`/orders/${transactionId}`)}
                    className="text-CropLink-primary font-bold text-sm"
                >
                    ← Back to Order
                </button>
            </div>
        );
    }

    if (!transaction || !clientSecret) return null;

    return (
        <div className="max-w-lg mx-auto p-6">
            {/* Back */}
            <button
                onClick={() => router.push(`/orders/${transactionId}`)}
                className="flex items-center gap-1 text-sm text-gray-500 font-medium mb-4 hover:text-gray-800 transition-colors"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back to Order
            </button>

            <div className="mb-6">
                <h1 className="text-xl font-black text-gray-800">Checkout</h1>
                <p className="text-[11px] text-gray-400 mt-0.5 font-medium">
                    #{transactionId.slice(0, 8).toUpperCase()}
                </p>
            </div>

            <Elements stripe={stripePromise} options={{ clientSecret }}>
                <CheckoutForm
                    transaction={transaction}
                    clientSecret={clientSecret}
                    onSuccess={() => setPaid(true)}
                />
            </Elements>
        </div>
    );
}

function SummaryRow({label, value, muted = false}: {
    label: string;
    value: string;
    muted?: boolean;
}) {
    return (
        <div className="flex justify-between items-start gap-4">
            <span className={`text-[11px] flex-shrink-0 ${muted ? 'text-gray-400' : 'text-gray-500'}`}>
                {label}
            </span>
            <span className={`text-[11px] font-bold text-right ${muted ? 'text-gray-400' : 'text-gray-700'}`}>
                {value}
            </span>
        </div>
    );
}