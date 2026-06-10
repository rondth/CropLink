'use client';
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';

export default function ProductDetails({ product, onBack, onSellerClick }: { product: any, onBack: () => void, onSellerClick?: () => void }) {
    const router = useRouter();
    const { isAuthenticated } = useAuth();
    const [marketPrice, setMarketPrice] = useState<any>(null);
    const [sellerProfile, setSellerProfile] = useState<any>(null);

    useEffect(() => {
        const fetchMarketData = async () => {
            try {
                const response = await api.get(`/listings/prices/${product.produce_id}?currency=${product.currency}`);
                setMarketPrice(response.data);
            } catch (err) {
                console.error("Market data fetch failed:", err);
            }
        };
        if (product.id) fetchMarketData();
    }, [product.id, product.currency]);

    useEffect(() => {
        const id = requestAnimationFrame(() => {
            const scroller = document.getElementById('main-scroller');
            if (scroller) scroller.scrollTop = 0;
        });
        return () => cancelAnimationFrame(id);
    }, []);

    useEffect(() => {
        if (product.seller_id) {
            api.get(`/auth/profile/${product.seller_id}`)
                .then(res => setSellerProfile(res.data))
                .catch(() => {});
        }
    }, [product.seller_id]);

    const title = product.crop_name || product.name || 'Unknown Crop';
    const unit = product.unit_of_measurement || product.unit || 'unit';
    const minOrder = product.min_order_quantity || 1;
    const maxQty = product.quantity ?? 0;
    
    const [quantity, setQuantity] = useState(minOrder);
    const [isOrdering, setIsOrdering] = useState(false);

    const handleDecrease = () => setQuantity((q: number) => Math.max(minOrder, q - 1));
    const handleIncrease = () => setQuantity((q: number) => Math.min(maxQty, q + 1));

    const handleOrder = async () => {
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }
        
        setIsOrdering(true);
        try {
            const payload = {
                listing_id: product.id,
                quantity: quantity,
            };
            await api.post('/transactions/', payload);
            router.push('/orders');
        } catch (error) {
            console.error("Failed to create transaction:", error);
            alert("Failed to place order. Please try again.");
        } finally {
            setIsOrdering(false);
        }
    };

    const harvestedDate = product.harvested_at 
        ? new Date(product.harvested_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
        : 'N/A';

    return (
        <div className="flex flex-col min-h-full bg-gray-50 relative pb-4">
            <div className="relative w-full h-64 bg-[#f7f5f0] shrink-0">
                {product.photo_url ? (
                    <Image src={product.photo_url} alt={title} fill className="object-contain" />
                ) : (
                    <Image src="/crop.svg" alt={title} fill className="object-contain" />
                )}
                <button onClick={onBack} className="absolute top-4 left-4 w-8 h-8 bg-black/40 text-white rounded-full flex items-center justify-center backdrop-blur-md z-10 active:scale-95 transition-transform">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                </button>
            </div>

            {/* product details */}
            <div className="bg-white p-5 mb-2 shadow-sm rounded-b-3xl z-10 relative">
                <div className="text-3xl font-black text-CropLink-primary mb-1">
                    {product.currency} {product.price ? Intl.NumberFormat('en-US').format(product.price) : '0.'} <span className="text-sm text-gray-500 font-medium">/ {unit}</span>
                </div>
                <h1 className="text-xl font-bold text-gray-800 leading-tight mb-3">{title}</h1>
                
                <div className="flex items-center gap-2 text-xs text-gray-500 font-bold bg-gray-50 p-2.5 rounded-xl">
                    <span className="flex items-center gap-1"><span className="text-base">📍</span> {product.location || 'Unknown location'}</span>
                    <span className="mx-1 text-gray-300">•</span>
                    <span className="text-CropLink-dark">{product.quantity} {unit} avail.</span>
                </div>
            </div>

            {/* market price analysis */}
            {marketPrice && (
                <div className="bg-white p-5 mb-2 shadow-sm rounded-3xl mx-0">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-black text-gray-800">Market Price Analysis</h3>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${product.price <= marketPrice.avg_price ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                            {product.price <= marketPrice.avg_price ? 'Great Value' : 'Premium Price'}
                        </span>
                    </div>
                    
                    <div className="relative pt-6 pb-2 px-1">
                        <div className="h-2 w-full bg-gray-100 rounded-full relative">
                            {/* range highlight (Min to Max span) */}
                            <div className="absolute h-full bg-CropLink-primary/10 rounded-full w-full"></div>
                            
                            {/* Average Marker */}
                            {(() => {
                                const range = marketPrice.max_price - marketPrice.min_price;
                                const pos = range > 0 ? ((marketPrice.avg_price - marketPrice.min_price) / range) * 100 : 50;
                                const clampedPos = Math.max(0, Math.min(100, pos));
                                return (
                                    <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-5 bg-gray-300 z-10" style={{ left: `${clampedPos}%` }}>
                                        <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] font-bold text-gray-400 uppercase tracking-tighter">Avg</span>
                                    </div>
                                );
                            })()}

                            {/* Current Price Marker */}
                            {(() => {
                                const range = marketPrice.max_price - marketPrice.min_price;
                                const pos = range > 0 ? ((product.price - marketPrice.min_price) / range) * 100 : 50;
                                const clampedPos = Math.max(0, Math.min(100, pos));
                                return (
                                    <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20 transition-all duration-500" style={{ left: `${clampedPos}%` }}>
                                        <div className="w-4 h-4 bg-CropLink-primary border-2 border-white rounded-full shadow-md"></div>
                                        <span className="text-[10px] font-black text-CropLink-primary mt-1 whitespace-nowrap">You</span>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Labels */}
                        <div className="flex justify-between mt-6">
                            <div className="flex flex-col"><span className="text-[8px] font-bold text-gray-400 uppercase">Min</span><span className="text-xs font-black text-gray-700">{product.currency} {marketPrice.min_price}</span></div>
                            <div className="flex flex-col text-right"><span className="text-[8px] font-bold text-gray-400 uppercase">Max</span><span className="text-xs font-black text-gray-700">{product.currency} {marketPrice.max_price}</span></div>
                        </div>
                    </div>
                </div>
            )}

            {/* product description */}
            <div className="bg-white p-5 mb-2 shadow-sm rounded-3xl flex-1 flex flex-col">
                <h3 className="text-sm font-black text-gray-800 mb-2">Description</h3>
                <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap mb-4">
                    {product.description || 'No description provided for this crop listing.'}
                </p>
                
                <div className="mt-auto pt-4 border-t border-gray-100 flex flex-col gap-3 text-xs text-gray-500">
                    <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl">
                        <span className="font-semibold text-gray-600">Harvested Date</span>
                        <span className="font-black text-gray-800">{harvestedDate}</span>
                    </div>
                    <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl">
                        <span className="font-semibold text-gray-600">Minimum Order</span>
                        <span className="font-black text-CropLink-accentRed">{minOrder} {unit}</span>
                    </div>
                </div>
            </div>

            {/* seller profile*/}
            <div className="bg-white p-5 mb-2 shadow-sm rounded-3xl">
                <h3 className="text-sm font-black text-gray-800 mb-3">Seller</h3>
                {sellerProfile ? (
                    <button
                        onClick={() => {
                            if (onSellerClick) {
                                onSellerClick();
                            } else {
                                sessionStorage.setItem('pendingProduct', JSON.stringify(product));
                                router.push(`/seller/${product.seller_id}`);
                            }
                        }}
                        className="w-full flex items-center gap-3 p-3 bg-gray-50 rounded-2xl active:scale-[0.98] transition-all"
                    >
                        <div className="shrink-0">
                            {sellerProfile.profile_picture_url ? (
                                <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow">
                                    <Image src={sellerProfile.profile_picture_url} alt={sellerProfile.name} fill className="object-cover" />
                                </div>
                            ) : (
                                <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-white shadow">
                                    <Image src="/profile.png" alt="Default Profile" fill className="object-cover" />
                                </div>
                            )}
                        </div>
                        <div className="flex-1 text-left">
                            <p className="text-sm font-black text-gray-800">{sellerProfile.name}</p>
                            <p className="text-[11px] text-gray-500 mt-0.5">
                                <span className="text-amber-500 font-bold">★ 5.0</span>
                                <span className="text-gray-300 mx-1">•</span>
                                <span className="font-medium">0 reviews</span>
                            </p>
                        </div>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 shrink-0"><path d="m9 18 6-6-6-6"/></svg>
                    </button>
                ) : (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-2xl animate-pulse">
                        <div className="w-12 h-12 rounded-full bg-gray-200 shrink-0" />
                        <div className="flex-1 flex flex-col gap-2">
                            <div className="h-3 bg-gray-200 rounded w-1/2" />
                            <div className="h-2.5 bg-gray-200 rounded w-1/3" />
                        </div>
                    </div>
                )}
            </div>
            {/* action bar */}
            <div className="sticky bottom-4 mt-2 mx-4 bg-white border border-gray-100 rounded-2xl p-3 flex items-center justify-between shadow-[0_8px_30px_rgb(0,0,0,0.08)] z-20">
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-1 border border-gray-100">
                    <button onClick={handleDecrease} disabled={quantity <= minOrder} className="w-9 h-9 flex items-center justify-center bg-white rounded-lg shadow-sm text-gray-800 font-bold disabled:opacity-40 active:scale-95 transition-all">-</button>
                    <input 
                        type="number" 
                        value={quantity} 
                        onChange={(e) => setQuantity(Number(e.target.value))} 
                        className="w-12 bg-transparent text-center text-sm font-bold text-gray-800 outline-none" 
                    />
                    {/* <span className="text-sm font-black w-6 text-center text-gray-800">{quantity}</span> */}
                    <button onClick={handleIncrease} disabled={quantity >= maxQty} className="w-9 h-9 flex items-center justify-center bg-white rounded-lg shadow-sm text-gray-800 font-bold disabled:opacity-40 active:scale-95 transition-all">+</button>
                </div>
                <button 
                    onClick={handleOrder} 
                    disabled={isOrdering || quantity < minOrder || quantity > maxQty || maxQty === 0} 
                    className="bg-CropLink-primary text-white font-black text-sm py-3 px-6 rounded-xl shadow-md shadow-CropLink-primary/30 active:scale-95 transition-all flex-1 ml-4 text-center disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                >
                    {isOrdering ? 'Placing Order...' : 'Order Now'}
                </button>
            </div>
        </div>
    );
}
