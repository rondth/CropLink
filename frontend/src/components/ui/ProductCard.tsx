'use client';
    import React, { useState } from 'react';
    import Image from 'next/image';
    
    export default function ProductCard({ product, onClick }: { product: any, onClick?: () => void }) {

    return (
        <div onClick={onClick} className="bg-white rounded-xl overflow-hidden border border-gray-100 cursor-pointer transition-transform duration-120 active:scale-[0.97]">
        <div className="h-[130px] flex items-center justify-center text-5xl bg-[#f7f5f0] relative select-none">
            {product.photo_url ? (
                <Image src={product.photo_url === 'NULL' ? '/crop.svg' : product.photo_url} alt={product.crop_name} fill className="object-cover" />
            ) : (
                <Image src="/crop.svg" alt={product.crop_name} fill className="object-cover" /> 
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

            <button className="w-full bg-CropLink-primary text-white rounded-lg py-1.5 text-[10px] font-bold mt-1.5">
                Order Now
            </button>
       
        </div>
        </div>
    );
    }