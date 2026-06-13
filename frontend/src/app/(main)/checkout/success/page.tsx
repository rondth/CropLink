'use client';
import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getTransaction, Transaction } from '@/lib/api';

function SuccessContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const transactionId = searchParams.get('transaction_id');

    const [transaction, setTransaction] = useState<Transaction | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!transactionId) {
            router.replace('/orders');
            return;
        }
        const fetchTxn = async () => {
            try {
                const txn = await getTransaction(transactionId);
                setTransaction(txn);
            } catch (err) {
                console.error('Failed to fetch transaction:', err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchTxn();
    }, [transactionId]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-CropLink-primary" />
            </div>
        );
    }

    return (
        <div className="p-5 flex flex-col items-center justify-center gap-4">
            {/* Success icon */}
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mt-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 6 9 17l-5-5" />
                </svg>
            </div>

            <div className="text-center">
                <h1 className="text-2xl font-black text-gray-800 mb-1">Payment Successful!</h1>
                <p className="text-sm text-gray-500">Your order has been placed and confirmed.</p>
            </div>

            {/* Transaction details */}
            {transaction && (
                <div className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                    <h2 className="text-sm font-black text-gray-800 mb-3">Order Details</h2>
                    <div className="flex flex-col gap-2 text-xs text-gray-500">
                        <div className="flex justify-between">
                            <span>Transaction ID</span>
                            <span className="font-bold text-gray-700 font-mono">#{transaction.id.slice(0, 8).toUpperCase()}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>Date</span>
                            <span className="font-bold text-gray-700">
                                {new Date(transaction.created_at).toLocaleDateString('en-SG', {
                                    day: '2-digit', month: 'short', year: 'numeric',
                                })}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span>Quantity</span>
                            <span className="font-bold text-gray-700">{transaction.quantity}</span>
                        </div>
                        {transaction.payment && (() => {
                            const total = transaction.payment.amount;
                            const subtotal = Math.round((total / 1.02) * 100) / 100;
                            const platformFee = Math.round((total - subtotal) * 100) / 100;
                            return (
                                <>
                                    <div className="flex justify-between">
                                        <span>Subtotal</span>
                                        <span className="font-bold text-gray-700">
                                            {transaction.currency} {Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(subtotal)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Platform fee (2%)</span>
                                        <span className="font-bold text-gray-700">
                                            {transaction.currency} {Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(platformFee)}
                                        </span>
                                    </div>
                                    <div className="flex justify-between border-t border-gray-100 pt-2 mt-1">
                                        <span className="font-black text-gray-800">Total Paid</span>
                                        <span className="font-black text-CropLink-primary">
                                            {transaction.currency} {Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(total)}
                                        </span>
                                    </div>
                                </>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="w-full flex flex-col gap-2">
                <button
                    onClick={() => router.push('/orders')}
                    className="w-full bg-CropLink-primary text-white font-black text-sm py-4 rounded-xl shadow-md shadow-CropLink-primary/30 active:scale-95 transition-all"
                >
                    View My Orders
                </button>
                <button
                    onClick={() => router.push('/')}
                    className="w-full border border-gray-200 text-gray-700 font-bold text-sm py-4 rounded-xl active:scale-95 transition-all"
                >
                    Back to Marketplace
                </button>
            </div>
        </div>
    );
}

export default function SuccessPage() {
    return (
        <Suspense fallback={
            <div className="flex justify-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-CropLink-primary" />
            </div>
        }>
            <SuccessContent />
        </Suspense>
    );
}