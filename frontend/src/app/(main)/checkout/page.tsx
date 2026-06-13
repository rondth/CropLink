'use client';
import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { api, createTransaction } from '@/lib/api';
import { colors } from '@/lib/theme';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

// Stripe payment form (must be inside <Elements>)

function CheckoutForm({
    product,
    quantity,
    transactionId,
}: {
    product: any;
    quantity: number;
    transactionId: string;
}) {
    const stripe = useStripe();
    const elements = useElements();
    const router = useRouter();
    const [isProcessing, setIsProcessing] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const unit = product?.unit_of_measurement || 'unit';
    const currency = product?.currency || 'SGD';
    const pricePerUnit = product?.price ?? 0;
    const subtotal = pricePerUnit * quantity;
    const platformFee = parseFloat((subtotal * 0.02).toFixed(2));
    const total = subtotal + platformFee;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!stripe || !elements) return;

        setIsProcessing(true);
        setErrorMessage('');

        const { error } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: `${window.location.origin}/checkout/success?transaction_id=${transactionId}`, // Stripe redirects here after payment
            },
        });

        if (error) {
            setErrorMessage(error.message ?? 'Payment failed. Please try again.');
            setIsProcessing(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Order summary */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <h2 className="text-sm font-black text-gray-800 mb-3">Order Summary</h2>
                <div className="flex justify-between text-xs text-gray-500 mb-2">
                    <span>{product?.crop_name}</span>
                    <span>{currency} {Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(pricePerUnit)} / {unit}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mb-2">
                    <span>Quantity</span>
                    <span className="font-bold text-gray-700">{quantity} {unit}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mb-2">
                    <span>Subtotal</span>
                    <span>{currency} {Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(subtotal)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mb-3">
                    <span>Platform fee (2%)</span>
                    <span>{currency} {Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(platformFee)}</span>
                </div>
                <div className="border-t border-gray-100 pt-3 flex justify-between">
                    <span className="text-sm font-black text-gray-800">Total</span>
                    <span className="text-sm font-black text-CropLink-primary">
                        {currency} {Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(total)}
                    </span>
                </div>
            </div>

            {/* Stripe payment element */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                <h2 className="text-sm font-black text-gray-800 mb-3">Payment Details</h2>
                <PaymentElement />
            </div>

            {errorMessage && (
                <div className="bg-red-50 border border-red-100 text-red-600 text-xs font-medium px-4 py-3 rounded-xl">
                    {errorMessage}
                </div>
            )}

            <button
                type="submit"
                disabled={!stripe || isProcessing}
                className="w-full bg-CropLink-primary text-white font-black text-sm py-4 rounded-xl shadow-md shadow-CropLink-primary/30 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
                {isProcessing ? 'Processing...' : `Pay ${currency} ${Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(total)}`}
            </button>

            <p className="text-[10px] text-gray-400 text-center">
                Secured by Stripe. Your payment info is never stored on our servers.
            </p>
        </form>
    );
}

// Page shell (handles params, fetches product + creates PaymentIntent)

function CheckoutContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const hasInitialized = useRef(false);

    const listingId = searchParams.get('listing_id');
    const quantityParam = searchParams.get('quantity');
    const quantity = quantityParam ? parseFloat(quantityParam) : 1;

    const [product, setProduct] = useState<any>(null);
    const [clientSecret, setClientSecret] = useState('');
    const [transactionId, setTransactionId] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!listingId) {
            router.replace('/');
            return;
        }
        if (hasInitialized.current) return;
        hasInitialized.current = true;

        const init = async () => {
            try {
                const [listingRes, txnRes] = await Promise.all([
                    api.get(`/listings/${listingId}`),
                    createTransaction({ listing_id: listingId, quantity }),
                ]);
                setProduct(listingRes.data);
                setClientSecret(txnRes.client_secret);
                setTransactionId(txnRes.transaction_id);
            } catch (err: any) {
                console.error('Checkout init failed:', err);
                setError('Failed to load checkout. Please go back and try again.');
            } finally {
                setIsLoading(false);
            }
        };

        init();
    }, [listingId, quantity]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-CropLink-primary" />
                <p className="text-xs text-gray-400">Setting up your order...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-6">
                <div className="text-4xl">⚠️</div>
                <p className="text-sm text-gray-600 text-center">{error}</p>
                <button
                    onClick={() => router.back()}
                    className="text-CropLink-primary font-bold text-sm"
                >
                    ← Go Back
                </button>
            </div>
        );
    }

    return (
        <div className="p-4 flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button
                    onClick={() => router.back()}
                    className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center active:scale-95 transition-transform"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m15 18-6-6 6-6" />
                    </svg>
                </button>
                <h1 className="text-lg font-black text-gray-800">Checkout</h1>
            </div>

            {clientSecret && (
                <Elements
                    stripe={stripePromise}
                    options={{
                        clientSecret,
                        appearance: {
                            theme: 'stripe',
                            variables: {
                                colorPrimary: colors.primary,
                                borderRadius: '12px',
                                fontSizeBase: '14px',
                            },
                        },
                    }}
                >
                    <CheckoutForm
                        product={product}
                        quantity={quantity}
                        transactionId={transactionId}
                    />
                </Elements>
            )}
        </div>
    );
}

export default function CheckoutPage() {
    return (
        <Suspense fallback={
            <div className="flex justify-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-CropLink-primary" />
            </div>
        }>
            <CheckoutContent />
        </Suspense>
    );
}