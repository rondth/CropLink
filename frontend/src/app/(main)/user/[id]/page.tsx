'use client';
import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle, User, MoreVertical, Ban, Flag } from 'lucide-react';
import { api, createConversation } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import ProductGrid from '@/components/marketplace/ProductGrid';
import ProductDetails from '@/components/marketplace/ProductDetails';
import ReviewCard from '@/components/marketplace/ReviewCard';

export default function PublicProfile() {
    const params = useParams();
    const router = useRouter();
    const userId = params.id as string;
    const { isAuthenticated, user } = useAuth();

    const [profile, setProfile] = useState<any>(null);
    const [listings, setListings] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    const [reviews, setReviews] = useState<any[]>([]);

    const isOwnProfile = isAuthenticated && user?.user_id === userId;

    const [menuOpen, setMenuOpen] = useState(false);
    const [isBlocked, setIsBlocked] = useState(false);
    const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
    const [blockLoading, setBlockLoading] = useState(false);
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [reportReason, setReportReason] = useState('');
    const [reportSubmitting, setReportSubmitting] = useState(false);
    const [reportError, setReportError] = useState<string | null>(null);
    const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [isMessaging, setIsMessaging] = useState(false);

    const avgRating = reviews.length
        ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(2)
        : null;

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 3000);
        return () => clearTimeout(t);
    }, [toast]);

    useEffect(() => {
        if (!isAuthenticated || !userId || isOwnProfile) return;
        api.get('/users/me/blocked')
            .then(res => setIsBlocked(res.data.some((u: any) => u.user_id === userId)))
            .catch(() => {});
    }, [isAuthenticated, userId, isOwnProfile]);

    const handleMessageSeller = async () => {
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }

        setIsMessaging(true);
        try {
            const conversation = await createConversation({ sellerId: userId });
            router.push(`/messages/${conversation.id}`);
        } catch (err: any) {
            setToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to start conversation. Please try again.' });
        } finally {
            setIsMessaging(false);
        }
    };

    const handleBlockClick = () => {
        setMenuOpen(false);
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }
        if (isBlocked) {
            unblockUser();
        } else {
            setBlockConfirmOpen(true);
        }
    };

    const confirmBlock = async () => {
        setBlockLoading(true);
        try {
            await api.post(`/users/${userId}/block`);
            setIsBlocked(true);
            setBlockConfirmOpen(false);
            setToast({ type: 'success', message: `You've blocked ${profile?.name || 'this user'}.` });
        } catch (err: any) {
            if (err?.response?.status === 409) {
                setIsBlocked(true);
                setBlockConfirmOpen(false);
            } else {
                setToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to block user.' });
            }
        } finally {
            setBlockLoading(false);
        }
    };

    const unblockUser = async () => {
        setBlockLoading(true);
        try {
            await api.post(`/users/${userId}/unblock`);
            setIsBlocked(false);
            setToast({ type: 'success', message: `You've unblocked ${profile?.name || 'this user'}.` });
        } catch (err: any) {
            setIsBlocked(false);
            setToast({ type: 'error', message: err?.response?.data?.detail || 'Failed to unblock user.' });
        } finally {
            setBlockLoading(false);
        }
    };

    const handleReportClick = () => {
        setMenuOpen(false);
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }
        setReportError(null);
        setReportReason('');
        setReportModalOpen(true);
    };

    const closeReportModal = () => {
        if (reportSubmitting) return;
        setReportModalOpen(false);
        setReportReason('');
        setReportError(null);
    };

    const submitReport = async () => {
        const reason = reportReason.trim();
        if (reason.length < 10) return;
        setReportSubmitting(true);
        setReportError(null);
        try {
            await api.post(`/users/${userId}/report`, { reason });
            setReportModalOpen(false);
            setReportReason('');
            setToast({ type: 'success', message: 'Report submitted, our team will review it.' });
        } catch (err: any) {
            setReportError(err?.response?.data?.detail || 'Failed to submit report. Please try again.');
        } finally {
            setReportSubmitting(false);
        }
    };

    useEffect(() => {
        if (!userId) return;
        api.get(`/auth/profile/${userId}`).then(profileRes => {
            const profileData = profileRes.data;
            setProfile(profileData);

            if (profileData.role !== 'seller') return;

            return Promise.all([
                api.get('/listings/', {
                    params: user?.preferred_currency ? { target_currency: user.preferred_currency } : undefined,
                }),
                api.get(`/reviews/seller/${userId}`),
            ]).then(([listingsRes, reviewsRes]) => {
                setListings(listingsRes.data.filter((l: any) => l.seller_id === userId && l.status === 'active'));
                setReviews(reviewsRes.data);
            });
        }).catch(err => {
            console.error("Failed to load profile:", err);
        }).finally(() => {
            setIsLoading(false);
        });
    }, [userId, user?.preferred_currency]);

    useEffect(() => {
        const scroller = document.querySelector('.overflow-y-auto');
        if (scroller) scroller.scrollTop = 0;
        else window.scrollTo({ top: 0, behavior: 'instant' });
    }, []);

    useEffect(() => {
        if (selectedProduct) {
            const id = requestAnimationFrame(() => {
                const scroller = document.getElementById('main-scroller');
                if (scroller) scroller.scrollTop = 0;
            });
            return () => cancelAnimationFrame(id);
        }
    }, [selectedProduct]);

    if (selectedProduct) {
        return <ProductDetails product={selectedProduct} onBack={() => setSelectedProduct(null)} onSellerClick={() => setSelectedProduct(null)} />;
    }

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#faf8f5]">
                <p className="text-sm font-bold text-gray-400">Loading seller profile...</p>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#faf8f5]">
                <p className="text-sm font-bold text-gray-400">Seller not found.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#faf8f5] pb-20">
            <div className="relative">
                <div className="h-32 bg-[#deebd8]" />

                {/* back button */}
                <button
                    onClick={() => router.back()}
                    className="absolute top-4 left-4 w-8 h-8 bg-black/30 text-white rounded-full flex items-center justify-center backdrop-blur-md z-20 active:scale-95 transition-transform"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>

                {/* kebab menu (block / report) */}
                {!isOwnProfile && (
                    <div className="absolute top-4 right-4 z-20">
                        <button
                            onClick={() => setMenuOpen(o => !o)}
                            className="w-8 h-8 bg-black/30 text-white rounded-full flex items-center justify-center backdrop-blur-md active:scale-95 transition-transform"
                        >
                            <MoreVertical className="w-4 h-4" />
                        </button>

                        {menuOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                                <div className="absolute right-0 top-10 z-20 w-44 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden py-1">
                                    <button
                                        onClick={handleBlockClick}
                                        className="w-full flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                                    >
                                        <Ban className="w-3.5 h-3.5" />
                                        {isBlocked ? 'Unblock user' : 'Block user'}
                                    </button>
                                    <div className="h-px bg-gray-100" />
                                    <button
                                        onClick={handleReportClick}
                                        className="w-full flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold text-CropLink-accentRed hover:bg-red-50 active:bg-red-100 transition-colors"
                                    >
                                        <Flag className="w-3.5 h-3.5" />
                                        Report user
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* avatar */}
                <div className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2 z-10">
                    <div className="size-24 rounded-full overflow-hidden ring-4 ring-CropLink-primary shadow-lg">
                        {profile.profile_picture_url ? (
                            <img src={profile.profile_picture_url} className="w-full h-full object-cover" alt={profile.name} />
                        ) : (
                            <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-300">
                                <User className="w-10 h-10" />
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex flex-col items-center pt-16 px-6 gap-1">
                <div className="flex items-center gap-1 text-CropLink-primary">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-black uppercase tracking-wide">
                        {profile.role || 'Seller'}
                    </span>
                </div>
                <h1 className="text-2xl font-black text-gray-800 text-center">{profile.name || 'Unknown'}</h1>
                <p className="text-xs text-gray-400 font-medium">{profile.email}</p>
            </div>

            {/* stats */}
            {profile.role === 'seller' && (
                <div className="mx-5 mt-5 bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-4 flex items-center justify-around">
                    <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Listings</span>
                        <span className="text-xl font-black text-gray-800">{profile.num_listings ?? 0}</span>
                    </div>
                    <div className="w-px h-8 bg-gray-100" />
                    <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Reviews</span>
                        <span className="text-xl font-black text-gray-800">{reviews.length}</span>
                    </div>
                    <div className="w-px h-8 bg-gray-100" />
                    <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Trust Score</span>
                        <span className="text-xl font-black text-amber-500">
                            {avgRating ? `★ ${avgRating}` : '★ -'}
                        </span>
                    </div>
                </div>
            )}

            {/* bio */}
            <div className="mx-5 mt-3 bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">About</label>
                <p className="text-sm text-gray-700 leading-relaxed">
                    {profile.bio || <span className="text-gray-400 italic">No bio yet.</span>}
                </p>
            </div>

            {/* message seller */}
            {profile.role === 'seller' && !isOwnProfile && listings.length > 0 && (
                <div className="mx-5 mt-3">
                    <button
                        onClick={handleMessageSeller}
                        disabled={isMessaging}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-CropLink-primary text-white text-sm font-black active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                        {isMessaging ? 'Starting conversation...' : 'Message Seller'}
                    </button>
                </div>
            )}

            {/* reviews */}
            {profile.role === 'seller' && (
                <div className="mt-5 mx-5">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-sm font-black text-gray-800">Reviews</h2>
                        {avgRating && (
                            <div className="flex items-center gap-1">
                                <span className="text-amber-400 text-sm">★</span>
                                <span className="text-sm font-black text-gray-800">{avgRating}</span>
                                <span className="text-xs text-gray-400">({reviews.length})</span>
                            </div>
                        )}
                    </div>

                    {reviews.length === 0 ? (
                        <p className="text-xs text-center text-gray-400 py-6">No reviews yet.</p>
                    ) : (
                        <>
                            <div className="flex flex-col gap-2">
                                {reviews.slice(0, 3).map(review => (
                                    <ReviewCard
                                        key={review.id}
                                        reviewerId={review.reviewer_id}
                                        reviewerName={review.reviewer?.name || 'Anonymous'}
                                        reviewerAvatar={review.reviewer?.profile_picture_url}
                                        rating={review.rating}
                                        content={review.content}
                                        createdAt={review.created_at}
                                    />
                                ))}
                            </div>
                            {reviews.length > 3 && (
                                <button
                                    onClick={() => router.push(`/user/${userId}/reviews`)}
                                    className="w-full mt-3 py-2.5 text-xs font-bold text-CropLink-primary border border-CropLink-primary/20 rounded-xl bg-CropLink-primary/5 active:scale-[0.98] transition-all"
                                >
                                    View all {reviews.length} reviews
                                </button>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* listings */}
            {profile.role === 'seller' && (
                <div className="mt-5">
                    <h2 className="text-sm font-black text-gray-800 px-5 mb-3">Active Listings</h2>
                    {listings.length === 0 ? (
                        <p className="text-xs text-center text-gray-400 py-8">No active listings.</p>
                    ) : (
                        <ProductGrid products={listings} onProductClick={setSelectedProduct} />
                    )}
                </div>
            )}

            {/* block confirmation */}
            {blockConfirmOpen && (
                <div
                    className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
                    onClick={() => !blockLoading && setBlockConfirmOpen(false)}
                >
                    <div className="bg-white rounded-2xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-sm font-black text-gray-800 mb-1.5">Block {profile.name || 'this user'}?</h3>
                        <p className="text-xs text-gray-500 leading-relaxed mb-5">
                            {profile.role === 'seller'
                                ? "You won't see their listings anymore."
                                : "You won't be able to transact with each other anymore."}
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setBlockConfirmOpen(false)}
                                disabled={blockLoading}
                                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 active:scale-95 transition-transform disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmBlock}
                                disabled={blockLoading}
                                className="flex-1 py-3 rounded-xl bg-CropLink-accentRed text-white text-sm font-bold active:scale-95 transition-transform disabled:opacity-50"
                            >
                                {blockLoading ? 'Blocking...' : 'Block'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* report modal */}
            {reportModalOpen && (
                <div
                    className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
                    onClick={closeReportModal}
                >
                    <div className="bg-white rounded-2xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-sm font-black text-gray-800 mb-1">Report {profile.name || 'this user'}</h3>
                        <p className="text-xs text-gray-500 mb-3">Tell us what's wrong. Our team will review it.</p>
                        <textarea
                            value={reportReason}
                            onChange={(e) => setReportReason(e.target.value)}
                            rows={4}
                            maxLength={500}
                            placeholder="Describe the issue (min. 10 characters)..."
                            className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl p-3 outline-none focus:border-CropLink-primary transition-colors resize-none"
                        />
                        <div className="flex justify-end mt-1 mb-4">
                            <span className="text-[10px] font-bold text-gray-400">
                                {reportReason.length}/500
                            </span>
                        </div>
                        {reportError && (
                            <p className="text-[11px] font-bold text-CropLink-accentRed mb-3">{reportError}</p>
                        )}
                        <div className="flex gap-3">
                            <button
                                onClick={closeReportModal}
                                disabled={reportSubmitting}
                                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 active:scale-95 transition-transform disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitReport}
                                disabled={reportSubmitting || reportReason.trim().length < 10}
                                className="flex-1 py-3 rounded-xl bg-CropLink-primary text-white text-sm font-bold active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {reportSubmitting ? 'Submitting...' : 'Submit Report'}
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
