'use client';
import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

export default function ProductDetails({ product, onBack }: { product: any, onBack: () => void }) {
    const router = useRouter();
    const { isAuthenticated } = useAuth();
    const title = product.crop_name || product.name || 'Unknown Crop';
    const unit = product.unit_of_measurement || product.unit || 'unit';
    const minOrder = product.min_order_quantity || 1;
    const maxQty = product.quantity ?? 0;
    
    const [quantity, setQuantity] = useState(minOrder);

    const handleDecrease = () => setQuantity((q: number) => Math.max(minOrder, q - 1));
    const handleIncrease = () => setQuantity((q: number) => Math.min(maxQty, q + 1));

    const handleOrder = () => {
        if (!isAuthenticated) {
            router.push('/login');
            return;
        }
        router.push(`/checkout?listing_id=${product.id}&quantity=${quantity}`);
    };

    const harvestedDate = product.harvested_at 
        ? new Date(product.harvested_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
        : 'N/A';

    return (
        <div className="flex flex-col min-h-full bg-gray-50 relative pb-4">
            <div className="relative w-full h-64 bg-[#f7f5f0] shrink-0">
                {product.photo_url ? (
                    <Image src={product.photo_url} alt={title} fill sizes="100vw" priority className="object-contain" />
                ) : (
                    <Image src="/crop.svg" alt={title} fill sizes="100vw" priority className="object-cover" />
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
                    disabled={quantity < minOrder || quantity > maxQty || maxQty === 0} 
                    className="bg-CropLink-primary text-white font-black text-sm py-3 px-6 rounded-xl shadow-md shadow-CropLink-primary/30 active:scale-95 transition-all flex-1 ml-4 text-center disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                >
                    Order Now
                </button>
            </div>
        </div>
    );
}