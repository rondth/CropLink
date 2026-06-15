'use client';
import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

export default function ReviewPage() {
    const { id } = useParams() as { id: string };
    const router = useRouter();
    const { isAuthenticated, isLoading: authLoading } = useAuth();

    const [order, setOrder] = useState<any>(null);
    const [alreadyReviewed, setAlreadyReviewed] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [rating, setRating] = useState(0);
    const [hovered, setHovered] = useState(0);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (authLoading || !isAuthenticated) return;
        Promise.all([
            api.get(`/transactions/${id}`),
            api.get(`/reviews/transaction/${id}`).catch(() => null),
        ]).then(([txnRes, reviewRes]) => {
            setOrder(txnRes.data);
            if (reviewRes) setAlreadyReviewed(true);
        }).finally(() => setIsLoading(false));
    }, [id, isAuthenticated, authLoading]);

    const handleSubmit = async () => {
        if (rating === 0) return;
        setIsSubmitting(true);
        try {
            await api.post('/reviews/', { transaction_id: id, rating, content: comment || null });
            router.push('/orders');
        } catch (err: any) {
            alert(err?.response?.data?.detail || 'Failed to submit review.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (authLoading || isLoading) {
        return (
            <div className="flex justify-center items-center min-h-[60vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-CropLink-primary" />
            </div>
        );
    }

    if (alreadyReviewed) {
        return (
            <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] gap-3">
                <div className="text-4xl">✅</div>
                <h2 className="text-xl font-black text-gray-800">Already Reviewed</h2>
                <p className="text-sm text-gray-400 text-center">You've already submitted a review for this order.</p>
                <button onClick={() => router.push('/orders')} className="text-CropLink-primary font-bold text-sm mt-2">← Back to Orders</button>
            </div>
        );
    }

    if (!order || order.status !== 'completed') {
        return (
            <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] gap-3">
                <h2 className="text-xl font-black text-gray-800">Not available</h2>
                <p className="text-sm text-gray-400">Reviews are only for completed orders.</p>
                <button onClick={() => router.push('/orders')} className="text-CropLink-primary font-bold text-sm mt-2">← Back to Orders</button>
            </div>
        );
    }

    const active = hovered || rating;

    return (
        <div className="p-6 max-w-lg mx-auto">
            <button
                onClick={() => router.back()}
                className="flex items-center gap-1 text-sm text-gray-500 font-medium mb-4 hover:text-gray-800 transition-colors"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Orders
            </button>

            <div className="flex justify-between items-start mb-6">
                <div>
                    <h1 className="text-xl font-black text-gray-800">Write a Review</h1>
                    <p className="text-[11px] text-gray-400 mt-0.5 font-medium">{order.listing?.crop_name}</p>
                </div>
            </div>

            {/* Star rating */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-3">
                <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-3">Your Rating</p>
                <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map(star => (
                        <button
                            key={star}
                            onClick={() => setRating(star)}
                            onMouseEnter={() => setHovered(star)}
                            onMouseLeave={() => setHovered(0)}
                            className="text-2xl leading-none transition-transform active:scale-90"
                        >
                            <span className={active >= star ? 'text-amber-400' : 'text-gray-200'}>★</span>
                        </button>
                    ))}
                    {rating > 0 && (
                        <span className="text-xs font-bold text-gray-400 ml-1">{LABELS[rating]}</span>
                    )}
                </div>
            </div>

            {/* Comment */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-4">
                <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-2">
                    Comment <span className="normal-case font-medium text-gray-300">(optional)</span>
                </p>
                <textarea
                    value={comment}
                    onChange={e => setComment(e.target.value)}
                    placeholder="Share your experience with this seller..."
                    maxLength={500}
                    rows={4}
                    className="w-full text-sm text-gray-700 placeholder-gray-300 resize-none outline-none"
                />
                <p className="text-[10px] text-gray-300 text-right mt-1">{comment.length}/500</p>
            </div>

            <button
                onClick={handleSubmit}
                disabled={rating === 0 || isSubmitting}
                className="w-full bg-CropLink-primary text-white font-bold py-3 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
            >
                {isSubmitting ? 'Submitting...' : 'Submit Review'}
            </button>
        </div>
    );
}
