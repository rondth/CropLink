'use client';
import React, { useState, useEffect } from 'react';
import { REVENUE_DATA, SELLER_DASHBOARD_DATA } from '@/data/dashboardData';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

{/* monthly revenue breakdown */}
function RevenueDetails({ onBack }: { onBack: () => void }) {
    let cumulativePercentage = 0;

    const gradientStops = REVENUE_DATA.map(item => {
        const start = cumulativePercentage;
        cumulativePercentage += item.percentage;
        const end = cumulativePercentage;
        return `${item.color} ${start}% ${end}%`;
    }).join(', ');

    const conicGradientStyle = {
        backgroundImage: `conic-gradient(${gradientStops})`,
    };

    return (
        <div className="p-4 pb-8 flex flex-col gap-4">
            <div className="px-1">
                <button onClick={onBack} className="text-CropLink-primary font-bold text-sm flex items-center gap-1 active:scale-95 transition-transform">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                    Dashboard
                </button>
            </div>
            <h2 className="text-xl font-black text-gray-800 px-1 mt-2">Revenue Breakdown</h2>
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col items-center gap-6">
                {/* pie chart */}
                <div className="relative w-40 h-40">
                     <div className="w-40 h-40 rounded-full" style={conicGradientStyle}></div>
                     <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-white rounded-full flex flex-col items-center justify-center shadow-inner">
                        <span className="text-xs text-gray-500">Total</span>
                        <span className="text-lg font-black text-gray-800">${SELLER_DASHBOARD_DATA.quickStats.monthlyRevenue.amount.toFixed(0)}</span>
                     </div>
                </div>
                {/* desc */}
                <div className="w-full flex flex-col gap-3 text-xs self-start">
                    {REVENUE_DATA.map(item => (
                        <div key={item.name} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                                <span className="font-medium text-gray-600">{item.name}</span>
                            </div>
                            <span className="text-gray-800">${item.price.toFixed(0)} <strong>({item.percentage}%)</strong></span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

{/* all listings */}
function AllListings({ myListings, onBack, getCurrencySymbol, onEdit, onRemove }: { myListings: any[], onBack: () => void, getCurrencySymbol: (currency?: string) => string, onEdit: (id: number) => void, onRemove: (id: number, name: string) => void }) {
    return (
        <div className="p-4 pb-8 flex flex-col gap-4">
            <div className="px-1">
                <button onClick={onBack} className="text-CropLink-primary font-bold text-sm flex items-center gap-1 active:scale-95 transition-transform">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                    Dashboard
                </button>
            </div>
            <h2 className="text-xl font-black text-gray-800 px-1 mt-2">All Active Listings</h2>
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col gap-3">
                {myListings.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-4">No active listings yet.</p>
                ) : (
                    myListings.map((listing, index) => (
                        <div key={listing.id} className={`flex items-center gap-3 ${index < myListings.length - 1 ? 'border-b border-gray-50 pb-3' : ''}`}>
                            <div className="flex-1">
                                <h4 className="text-xs font-bold text-gray-800">{listing.crop_name}</h4>
                                <p className="text-[10px] text-gray-400 mt-0.5">{`${listing.quantity} ${listing.unit_of_measurement} available`}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-black text-CropLink-primary">{getCurrencySymbol(listing.currency)} {Intl.NumberFormat('en-US').format(parseFloat(listing.price))} <span className="text-[9px] text-gray-400 font-medium">/{listing.unit_of_measurement}</span></p>
                            </div>
                            <div className="flex items-center gap-3 pl-2 border-l border-gray-100">
                                <button onClick={() => onEdit(listing.id)} className="text-xs text-blue-600 hover:underline font-medium">
                                    Edit
                                </button>
                                <button onClick={() => onRemove(listing.id, listing.crop_name)} className="text-xs text-red-600 hover:underline font-medium">
                                    Delete
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

{/* main dashboard */}
export default function Dashboard() {
    const router = useRouter();
    const [showRevenueDetails, setShowRevenueDetails] = useState(false);
    const [showAllListings, setShowAllListings] = useState(false);
    const [myListings, setMyListings] = useState<any[]>([]);

    useEffect(() => {
        const fetchMyListings = async () => {
            try {
                const response = await api.get('/listings/me');
                setMyListings(response.data);
            } catch (err) {
                console.error("Failed to load my listings", err);
            }
        };
        fetchMyListings();
    }, []);

    const handleEdit = (listingId: number) => {
        router.push(`/seller/edit/${listingId}`);
    };

    const handleRemove = async (listingId: number, listingName: string) => {
        if (window.confirm(`Are you sure you want to delete "${listingName}"? This action cannot be undone.`)) {
            try {
                await api.delete(`/listings/${listingId}/`);
                setMyListings(prevListings => prevListings.filter(l => l.id !== listingId));
                alert('Listing deleted successfully.');
            } catch (error) {
                console.error('Failed to delete listing:', error);
                alert('Could not delete the listing. Please try again.');
            }
        }
    };

    const getCurrencySymbol = (currency?: string) => {
        switch (currency?.toUpperCase()) {
            case 'EUR': return '€';
            case 'IDR': return 'Rp ';
            case 'BAHT':
            case 'THB': return '฿';
            case 'SGD': return 'S$';
            case 'USD':
            default: return '$';
        }
    };

    if (showRevenueDetails) {
        return <RevenueDetails onBack={() => setShowRevenueDetails(false)} />;
    }

    if (showAllListings) {
        return <AllListings myListings={myListings} onBack={() => setShowAllListings(false)} getCurrencySymbol={getCurrencySymbol} onEdit={handleEdit} onRemove={handleRemove} />;
    }

    return (
        <div className="p-4 pb-8 flex flex-col gap-4">
            <div className="px-1">
                <h2 className="text-xl font-black text-gray-800">Hello, {SELLER_DASHBOARD_DATA.sellerName}!</h2>
                <p className="text-xs text-gray-500 mt-0.5">Here's what's happening with your crops.</p>
            </div>

            {/* stats */}
            <div className="grid grid-cols-2 gap-3">
                {/* button to pie chart */}
                <button onClick={() => setShowRevenueDetails(true)} className="bg-CropLink-primary rounded-2xl p-4 text-white shadow-sm flex flex-col justify-between text-left active:scale-[0.98] transition-transform">
                    <p className="text-[10px] font-semibold opacity-80 mb-1">Monthly Revenue</p>
                    <h3 className="text-xl font-black mb-2">${SELLER_DASHBOARD_DATA.quickStats.monthlyRevenue.amount.toFixed(2)}</h3>
                    <span className="text-[9px] font-bold bg-white/20 inline-flex items-center px-1.5 py-1 rounded-md self-start">
                        {SELLER_DASHBOARD_DATA.quickStats.monthlyRevenue.change} vs last month
                    </span>
                </button>
                
                {/* active order */}
                <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex flex-col justify-between">
                    <p className="text-[10px] font-semibold text-gray-500 mb-1">Active Orders</p>
                    <h3 className="text-xl font-black text-gray-800 mb-2">{SELLER_DASHBOARD_DATA.quickStats.activeOrders.count}</h3>
                    <span className="text-[9px] font-bold bg-orange-100 text-orange-700 inline-flex items-center px-1.5 py-1 rounded-md self-start">
                        {SELLER_DASHBOARD_DATA.quickStats.activeOrders.pending} pending delivery
                    </span>
                </div>
            </div>

            {/* inventory */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <h3 className="text-sm font-bold text-gray-800 mb-4"> Inventory Breakdown </h3>
                
                <div className="flex flex-col gap-3.5">
                    {SELLER_DASHBOARD_DATA.inventoryBreakdown.map(item => (
                        <div key={item.name}>
                            <div className="flex justify-between text-xs mb-1.5">
                                <span className="font-bold text-gray-700">{item.name}</span>
                                <span className="text-gray-500 font-medium">{item.percentage}%</span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${item.percentage}%`, backgroundColor: item.color }}></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* active listings */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-sm font-bold text-gray-800">Your Listings</h3>
                    <button onClick={() => setShowAllListings(true)} className="text-[10px] text-CropLink-primary font-bold cursor-pointer hover:underline">
                        View All
                    </button>
                </div>

                <div className="flex flex-col gap-3">
                    {myListings.length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-4">No active listings yet.</p>
                    ) : (
                        myListings.slice(0, 3).map((listing, index, arr) => (
                            <div key={listing.id} className={`flex items-center gap-3 ${index < arr.length - 1 ? 'border-b border-gray-50 pb-3' : ''}`}>
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#2d5a27' }}></div>

                                <div className="flex-1">
                                    <h4 className="text-xs font-bold text-gray-800">{listing.crop_name}</h4>
                                    <p className="text-[10px] text-gray-400 mt-0.5">{`${Intl.NumberFormat('en-US').format(listing.quantity)} ${listing.unit_of_measurement} available`}</p>
                                </div>
                                <div className="text-right">
                                        <p className="text-xs font-black text-CropLink-primary">{getCurrencySymbol(listing.currency)} {Intl.NumberFormat('en-US').format(parseFloat(listing.price))} <span className="text-[9px] text-gray-400 font-medium">/{listing.unit_of_measurement}</span></p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
