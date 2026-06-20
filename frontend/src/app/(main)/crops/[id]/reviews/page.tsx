'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Suspense } from 'react';

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];

function ReviewCard({ review }: { review: any }) {
    const router = useRouter();
    const name = review.reviewer?.name || 'Anonymous';
    const initials = name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
    const avatarUrl = review.reviewer?.profile_picture_url;

    return (
        <div
            onClick={review.reviewer_id ? () => router.push(`/user/${review.reviewer_id}`) : undefined}
            className={`bg-white rounded-2xl p-4 shadow-sm ${review.reviewer_id ? 'cursor-pointer active:scale-[0.98] transition-transform' : ''}`}
        >
            <div className="flex items-center gap-2 mb-2">
                {avatarUrl ? (
                    <img src={avatarUrl} alt={name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
                ) : (
                    <div className="w-9 h-9 rounded-full bg-CropLink-primary/10 flex items-center justify-center text-xs font-black text-CropLink-primary flex-shrink-0">
                        {initials}
                    </div>
                )}
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-gray-800 truncate">{name}</p>
                    <p className="text-xs text-gray-400">
                        {new Date(review.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </p>
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                    {[1,2,3,4,5].map(s => (
                        <span key={s} className={`text-sm ${s <= review.rating ? 'text-amber-400' : 'text-gray-200'}`}>★</span>
                    ))}
                    <span className="text-xs text-gray-400 ml-1">{LABELS[review.rating]}</span>
                </div>
            </div>
            {review.content && (
                <p className="text-sm text-gray-600 leading-relaxed">{review.content}</p>
            )}
        </div>
    );
}

function ListingReviewsPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const searchParams = useSearchParams();
    const seller_id = searchParams.get('seller_id');
    const [reviews, setReviews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get(`/reviews/listing/${id}`)
            .then(res => setReviews(res.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [id]);

    const avg = reviews.length
        ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(2)
        : null;

    return (
        <div className="flex flex-col min-h-full bg-gray-50">
            <div className="bg-CropLink-primary text-white px-5 h-30 flex flex-col justify-end pb-3">
                <button
                    onClick={() => router.push(`/?listing_id=${id}`)}
                    className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 mb-4"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m15 18-6-6 6-6"/>
                    </svg>
                </button>
                <h1 className="font-black text-2xl">Seller Reviews</h1>
                {avg ? (
                    <p className="text-white/80 text-sm mt-1 flex items-center gap-1">
                        <span className="text-amber-400">★</span> {avg} average · {reviews.length} review{reviews.length !== 1 ? 's' : ''}
                    </p>
                ) : (
                    !loading && <p className="text-white/80 text-sm mt-1">No reviews yet</p>
                )}
            </div>

            <div className="px-4 pt-4">
                <button
                    onClick={() => router.push(`/user/${seller_id}`)}
                    className="w-full flex items-center justify-between bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 active:scale-[0.98] transition-transform"
                >
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-CropLink-primary/10 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"
                                fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                className="text-CropLink-primary">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                            </svg>
                        </div>
                        <div className="text-left">
                            <p className="text-sm font-black text-gray-800">View Seller Profile</p>
                            <p className="text-xs text-gray-400">See listings, history & more</p>
                        </div>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
                        fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        className="text-gray-300">
                        <path d="m9 18 6-6-6-6"/>
                    </svg>
                </button>
            </div>

            <div className="p-4 flex flex-col gap-3">
                {loading ? (
                    <div className="flex justify-center py-10">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-CropLink-primary" />
                    </div>
                ) : reviews.length === 0 ? (
                    <div className="text-center py-12">
                        <p className="text-gray-400 text-sm font-medium">No reviews yet for this seller.</p>
                    </div>
                ) : (
                    reviews.map(review => <ReviewCard key={review.id} review={review} />)
                )}
            </div>
        </div>
    );
}

export default function Page() {
    return (
        <Suspense fallback={
            <div className="flex justify-center py-10">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-700" />
            </div>
        }>
            <ListingReviewsPage />
        </Suspense>
    );
}