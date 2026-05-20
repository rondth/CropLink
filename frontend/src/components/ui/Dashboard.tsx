'use client';
import React, { useState } from 'react';
import { REVENUE_DATA, SELLER_DASHBOARD_DATA } from '@/data/dashboardData';

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
                <button onClick={onBack} className="text-gainz-primary font-bold text-sm flex items-center gap-1 active:scale-95 transition-transform">
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

{/* main dashboard */}
export default function Dashboard() {
    const [showRevenueDetails, setShowRevenueDetails] = useState(false);

    if (showRevenueDetails) {
        return <RevenueDetails onBack={() => setShowRevenueDetails(false)} />;
    }

    return (
        <div className="p-4 pb-8 flex flex-col gap-4">
            <div className="px-1">
                <h2 className="text-xl font-black text-gray-800">Hello, {SELLER_DASHBOARD_DATA.sellerName}!</h2>
                <p className="text-xs text-gray-500 mt-0.5">Here's what's happening with your farm.</p>
            </div>

            {/* stats */}
            <div className="grid grid-cols-2 gap-3">
                {/* button to pie chart */}
                <button onClick={() => setShowRevenueDetails(true)} className="bg-gainz-primary rounded-2xl p-4 text-white shadow-sm flex flex-col justify-between text-left active:scale-[0.98] transition-transform">
                    <p className="text-[10px] font-semibold opacity-80 mb-1">Monthly Revenue</p>
                    <h3 className="text-xl font-black mb-2">${SELLER_DASHBOARD_DATA.quickStats.monthlyRevenue.amount.toFixed(2)}</h3>
                    <span className="text-[9px] font-bold bg-white/20 inline-flex items-center px-1.5 py-1 rounded-md self-start">
                        {SELLER_DASHBOARD_DATA.quickStats.monthlyRevenue.change} vs last month
                    </span>
                </button>
                
                {/* TODO : edit this to a button */}
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
                    <span className="text-[10px] text-gainz-primary font-bold cursor-pointer hover:underline">
                        View All
                    </span>
                </div>

                <div className="flex flex-col gap-3">
                    {SELLER_DASHBOARD_DATA.activeListings.map((listing, index) => (
                        <div key={listing.name} className={`flex items-center gap-3 ${index < SELLER_DASHBOARD_DATA.activeListings.length - 1 ? 'border-b border-gray-50 pb-3' : ''}`}>
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: listing.color }}></div>

                            <div className="flex-1">
                                <h4 className="text-xs font-bold text-gray-800">{listing.name}</h4>
                                <p className="text-[10px] text-gray-400 mt-0.5">{`${listing.left}/${listing.quantity} kg available`}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-black text-gainz-primary">${listing.price.toFixed(2)}<span className="text-[9px] text-gray-400 font-medium">/{listing.unit}</span></p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
