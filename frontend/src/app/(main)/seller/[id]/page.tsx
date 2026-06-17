'use client';
import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CheckCircle, User } from 'lucide-react';
import { api } from '@/lib/api';
import ProductGrid from '@/components/marketplace/ProductGrid';
import ProductDetails from '@/components/marketplace/ProductDetails';

export default function SellerProfile() {
    const params = useParams();
    const router = useRouter();
    const sellerId = params.id as string;

    const [profile, setProfile] = useState<any>(null);
    const [listings, setListings] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedProduct, setSelectedProduct] = useState<any>(null);

    useEffect(() => {
        if (!sellerId) return;
        Promise.all([
            api.get(`/auth/profile/${sellerId}`),
            api.get('/listings/'),
        ]).then(([profileRes, listingsRes]) => {
            setProfile(profileRes.data);
            setListings(listingsRes.data.filter((l: any) => l.seller_id === sellerId && l.status === 'active'));
        }).catch(err => {
            console.error("Failed to load seller profile:", err);
        }).finally(() => {
            setIsLoading(false);
        });
    }, [sellerId]);

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

                {/* avatar */}
                <div className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2 z-10">
                    <div className="size-24 rounded-full overflow-hidden border-4 border-white ring-4 ring-CropLink-primary shadow-lg">
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
            <div className="mx-5 mt-5 bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-4 flex items-center justify-around">
                <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Listings</span>
                    <span className="text-xl font-black text-gray-800">{profile.num_listings ?? 0}</span>
                </div>
                <div className="w-px h-8 bg-gray-100" />
                <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Reviews</span>
                    <span className="text-xl font-black text-gray-800">0</span>
                </div>
                <div className="w-px h-8 bg-gray-100" />
                <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Trust Score</span>
                    <span className="text-xl font-black text-amber-500">★ 5.0</span>
                </div>
            </div>

            {/* bio */}
            {profile.bio && (
                <div className="mx-5 mt-3 bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">About</label>
                    <p className="text-sm text-gray-700 leading-relaxed">{profile.bio}</p>
                </div>
            )}

            {/* listings */}
            <div className="mt-5">
                <h2 className="text-sm font-black text-gray-800 px-5 mb-3">Active Listings</h2>
                {listings.length === 0 ? (
                    <p className="text-xs text-center text-gray-400 py-8">No active listings.</p>
                ) : (
                    <ProductGrid products={listings} onProductClick={setSelectedProduct} />
                )}
            </div>
        </div>
    );
}
