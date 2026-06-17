'use client';
    import React, { useState } from 'react';
    import Image from 'next/image';
    import { useRouter } from 'next/navigation';
    import { api } from '@/lib/api';
    import { useAuth } from '@/lib/AuthContext';
    
    export default function ProductCard({ product, onClick }: { product: any, onClick?: () => void }) {
        const router = useRouter();
        const { isAuthenticated } = useAuth();
        const [isLoading, setIsLoading] = useState(false);

        const handleOrderNow = async (e: React.MouseEvent) => {
            e.stopPropagation(); // Prevent card's onClick from firing if it exists
            if (!isAuthenticated) {
                router.push('/login');
                return;
            }
    
            setIsLoading(true);
            try {
                // For simplicity, we'll use the minimum order quantity.
                // A real app might have a quantity selector.
                const payload = {
                    listing_id: product.id,
                    quantity: product.min_order_quantity,
                };
                const response = await api.post('/transactions', payload);
                const { transaction_id } = response.data;
                router.push(`/checkout/${transaction_id}`);
            } catch (error: any) {
                console.error("Failed to create transaction", error);
                alert(error.response?.data?.detail || 'Could not start transaction.');
            } finally {
                setIsLoading(false);
            }
        };

    return (
        <div onClick={onClick} className="bg-white rounded-xl overflow-hidden border border-gray-100 cursor-pointer transition-transform duration-120 active:scale-[0.97]">
        <div className="h-[130px] flex items-center justify-center text-5xl bg-[#f7f5f0] relative select-none">
            {product.photo_url ? (
                <Image src={product.photo_url === 'NULL' ? '/crop.svg' : product.photo_url} alt={product.crop_name} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover" />
            ) : (
                <Image src="/crop.svg" alt={product.crop_name} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-contain" /> 
            )}
        </div>

        <div className="p-2">
            <h4 className="text-[11px] font-bold text-CropLink-dark line-clamp-2 leading-tight mb-1">
                {product.crop_name}
            </h4>

            <div className="text-[9px] text-gray-400 font-semibold mb-1">
                📍 {product.location || 'Unknown location'}
            </div>

            <div className="text-sm font-black text-CropLink-primary">
                {product.currency} {product.price ? Intl.NumberFormat('en-US').format(product.price) : '0'}
                <span className="text-[11px] text-gray-600 font-medium">
                    / {product.unit_of_measurement || 'unit'}
                </span>
            </div>

            <button 
                onClick={handleOrderNow}
                disabled={isLoading}
                className="w-full bg-CropLink-primary text-white rounded-lg py-1.5 text-[10px] font-bold mt-1.5 disabled:opacity-50"
            >
                {isLoading ? 'Processing...' : 'Order Now'}
            </button>
       
        </div>
        </div>
    );
}