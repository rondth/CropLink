'use client';
import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import ProductGrid from '@/components/marketplace/ProductGrid';
import ProductDetails from '@/components/marketplace/ProductDetails';
import PriceTrendChart from '@/components/ui/PriceTrendChart';

export default function PricesDashboard() {
    const { user, isLoading: authLoading } = useAuth();
    const [prices, setPrices] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [selectedMarketData, setSelectedMarketData] = useState<any | null>(null);
    const [listings, setListings] = useState<any[]>([]);
    const [isLoadingListings, setIsLoadingListings] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<any | null>(null);

    useEffect(() => {
        const pending = sessionStorage.getItem('pendingProduct');
        if (pending) {
            sessionStorage.removeItem('pendingProduct');
            setSelectedProduct(JSON.parse(pending));
        }
    }, []);

    useEffect(() => {
        const fetchPrices = async () => {
            try {
                const currency = user?.preffered_currency || 'USD';
                const response = await api.get(`/listings/prices?currency=${currency}`);
                setPrices(response.data);
            } catch (error) {
                console.error("Failed to fetch prices:", error);
            } finally {
                setIsLoading(false);
            }
        };

        if (!authLoading) {
            fetchPrices();
        }
    }, [user, authLoading]);

    // auto scroll after clicking price card
    useEffect(() => {
        const scroller = document.getElementById('main-scroller');
        if (scroller) scroller.scrollTop = 0;
    }, [selectedMarketData, selectedProduct]);

    const handlePriceCardClick = async (marketData: any) => {
        setSelectedMarketData(marketData);
        setIsLoadingListings(true);
        try {
            const response = await api.get('/listings/');
            
            const filtered = response.data.filter((l: any) => (l.produce_id === marketData.crop_id) && (l.status === 'active'));
            
            setListings(filtered);
        } catch (error) {
            console.error("Failed to fetch listings:", error);
        } finally {
            setIsLoadingListings(false);
        }
    };

    if (isLoading || authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 pb-20">
                <p className="text-sm font-bold text-gray-400">Loading market prices...</p>
            </div>
        );
    }

    if (selectedProduct) {
        return <ProductDetails product={selectedProduct} onBack={() => setSelectedProduct(null)}/>;
    }
    if (selectedMarketData) {
        return (
            <div className="min-h-full bg-[#faf8f5] flex flex-col pb-6">
                <div className="p-5 pb-4 bg-white shadow-sm mb-2 rounded-b-3xl shrink-0">
                    <button onClick={() => setSelectedMarketData(null)} className="text-[#2d5a3d] font-bold text-sm flex items-center gap-1 active:scale-95 transition-transform mb-3">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                        Back to Prices
                    </button>
                    <h1 className="text-2xl font-black text-gray-800 capitalize">{selectedMarketData.name} Listings</h1>
                    <p className="text-xs text-gray-500 mt-1 font-medium mb-3">
                        See what the market is currently offering.
                    </p>

                    {/* price stats */}
                    <div className="flex items-center justify-between mt-2 p-3 bg-[#f7f5f0] rounded-xl border border-gray-100 shadow-inner">
                        <div className="flex flex-col text-center">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Min Price</span>
                            <span className="text-sm font-black text-gray-700">{selectedMarketData.currency} {Intl.NumberFormat('en-US').format(selectedMarketData.min_price)}</span>
                        </div>

                        <div className="w-px h-6 bg-gray-200"></div>

                        <div className="flex flex-col text-center">
                            <span className="text-[10px] font-bold text-[#2d5a3d] uppercase tracking-wider mb-0.5">Avg Price</span>
                            <span className="text-sm font-black text-[#2d5a3d]">{selectedMarketData.currency} {Intl.NumberFormat('en-US').format(selectedMarketData.avg_price)}</span>
                        </div>

                        <div className="w-px h-6 bg-gray-200"></div>

                        <div className="flex flex-col text-center">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">Max Price</span>
                            <span className="text-sm font-black text-gray-700">{selectedMarketData.currency} {Intl.NumberFormat('en-US').format(selectedMarketData.max_price)}</span>
                        </div>
                    </div>
                </div>
                
                <PriceTrendChart cropId={selectedMarketData.crop_id} currency={user?.preffered_currency || 'USD'} />

                {isLoadingListings ? (
                    <div className="flex-1 flex items-center justify-center">
                        <p className="text-sm font-bold text-gray-400">Loading listings...</p>
                    </div>
                ) : listings.length === 0 ? (
                    <p className="text-xs text-center text-gray-400 py-10">No other listings available for {selectedMarketData.name}.</p>
                ) : (
                    <div className="mt-2 flex-1">
                        <ProductGrid products={listings} onProductClick={setSelectedProduct} />
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="min-h-full bg-[#faf8f5] flex flex-col pb-6 overflow-y-auto">
            <div className="px-5 py-4 pb-4 bg-white shadow-sm mb-2 rounded-b-3xl shrink-0">
                <h1 className="text-2xl font-black text-gray-800">Market Prices</h1>
                <p className="text-xs text-gray-500 mt-1 font-medium mb-2">
                    Current market averages, minimums, and maximums for crops globally.
                </p>
                
                <div className="inline-flex items-center gap-1.5 mb-1 py-1">
                    <span className="text-sm font-bold text-[#2d5a3d] uppercase tracking-wider">Currency:</span>
                    <span className="text-sm font-black text-[#1f422b]">{user?.preffered_currency || 'USD'}</span>
                </div>

                <p className="text-xs mt-2 text-gray-500 italic font-medium text-center"> * Click the price card for details. </p>
            </div>


            <div className="p-4 flex flex-col gap-3">
                {prices.length === 0 ? (
                    <p className="text-xs text-center text-gray-400 py-10">No price data available.</p>
                ) : (
                    prices.map((item, index) => {
                        const range = item.max_price - item.min_price;
                        const avgPos = range > 0 ? ((item.avg_price - item.min_price) / range) * 100 : 50;
                        const clampedAvg = Math.max(0, Math.min(100, avgPos));
                        
                        const cropName = item.name;
                        const numberOfListings = item.active_listing_count;

                        return (
                            <div key={index} 
                                 onClick={() => handlePriceCardClick(item)}
                                 className="bg-white p-5 shadow-sm rounded-3xl mx-0 cursor-pointer border border-transparent hover:border-[#2d5a3d] active:scale-[0.98] transition-all"
                            >
                                <div className="flex justify-between items-center mb-6">
                                    <div className="flex flex-col items-start gap-0.5">
                                        <h3 className="text-sm font-black text-gray-800 capitalize">{cropName}</h3>
                                        <span className="text-[10px] font-black text-left text-[#2d5a3d]">{numberOfListings} {numberOfListings === 1 ? 'listing' : 'listings'}</span>
                                    </div>
                                    
                                    <div className="flex flex-col items-end gap-0.5">
                                        <span className="text-[9px] font-bold text-gray-400"> AVG : {" "} 
                                            <span className="text-xs font-black text-[#2d5a3d]">{item.currency} {Intl.NumberFormat('en-US').format(item.avg_price)} 
                                            </span>
                                        </span>
                                        
                                        <span className="text-[10px] font-black text-right text-gray-400">{item.recorded_at}</span>
                                    </div>
                                </div>
                                
                                <div className="relative pt-6 pb-2 px-1">
                                    <div className="h-2 w-full bg-gray-100 rounded-full relative">
                                        <div className="absolute h-full bg-[#2d5a3d]/10 rounded-full w-full"></div>
                                        
                                        {/* Average Marker */}
                                        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#2d5a3d] z-10" style={{ left: `${clampedAvg}%` }}>
                                            <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] font-bold text-[#2d5a3d] uppercase tracking-tighter">Avg</span>
                                        </div>
                                    </div>

                                    {/* Labels */}
                                    <div className="flex justify-between mt-6">
                                        <div className="flex flex-col"><span className="text-[8px] font-bold text-gray-400 uppercase">Min</span><span className="text-xs font-black text-gray-700">{item.currency} {Intl.NumberFormat('en-US').format(item.min_price)}</span></div>
                                        <div className="flex flex-col text-right"><span className="text-[8px] font-bold text-gray-400 uppercase">Max</span><span className="text-xs font-black text-gray-700">{item.currency} {Intl.NumberFormat('en-US').format(item.max_price)}</span></div>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
