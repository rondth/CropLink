'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { api } from '@/lib/api';
import ReviewCard from '@/components/marketplace/ReviewCard';

export default function AllReviews() {
    const router = useRouter();
    const { user, isAuthenticated } = useAuth();
    const [reviews, setReviews] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!isAuthenticated || !user) return;
        const userId = (user as any)?.user_id || (user as any)?.id;
        if (!userId) return;

        const endpoint = user.role === 'seller'
            ? `/reviews/seller/${userId}`
            : `/reviews/buyer/${userId}`;

        api.get(endpoint)
            .then(res => setReviews(res.data))
            .catch(() => {})
            .finally(() => setIsLoading(false));
    }, [isAuthenticated, user]);

    const avgRating = reviews.length
        ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(2)
        : null;

    return (
        <div className="min-h-screen bg-[#faf8f5] pb-20">
            {/* header */}
            <div className="bg-white px-4 py-4 flex items-center gap-3 border-b border-gray-100 sticky top-0 z-10">
                <button
                    onClick={() => router.back()}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 active:scale-95 transition-transform"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
                <div>
                    <h1 className="text-base font-black text-gray-800">All Reviews</h1>
                    {avgRating && (
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                            <span className="text-amber-400">★</span> {avgRating} · {reviews.length} review{reviews.length !== 1 ? 's' : ''}
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
                ) : reviews.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-2">
                        <p className="text-sm font-bold text-gray-400">No reviews yet.</p>
                    </div>
                ) : (
                    reviews.map(review => (
                        <ReviewCard
                            key={review.id}
                            reviewerName={review.reviewer?.name || 'Anonymous'}
                            reviewerAvatar={review.reviewer?.profile_picture_url}
                            rating={review.rating}
                            content={review.content}
                            createdAt={review.created_at}
                        />
                    ))
                )}
            </div>
        </div>
    );
}