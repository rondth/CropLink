'use client';
    import React, { useState } from 'react';
    import Image from 'next/image';
    import { Product } from '@/data/marketplaceData';
    
    export default function ProductCard({ product }: { product: Product }) {

    return (
        <div className="bg-white rounded-xl overflow-hidden border border-gray-100 cursor-pointer transition-transform duration-120 active:scale-[0.97]">
        <div className="h-[130px] flex items-center justify-center text-5xl bg-[#f7f5f0] relative select-none">
            {product.emoji.endsWith('.png') ? (
                <Image src={product.emoji} alt={product.name} fill className="object-cover" />
            ) : (
                product.emoji
            )}
        </div>

        <div className="p-2">
            <h4 className="text-[11px] font-bold text-CropLink-dark line-clamp-2 leading-tight mb-1">
                {product.name}
            </h4>

            <div className="text-[9px] text-gray-400 font-semibold mb-1">
                📍 {product.location}
            </div>

            <div className="text-sm font-black text-CropLink-primary">
                ${product.price.toFixed(2)} 
                <span className="text-[11px] text-gray-600 font-medium">
                    / kg
                </span>
            </div>

            <button className="w-full bg-CropLink-primary text-white rounded-lg py-1.5 text-[10px] font-bold mt-1.5">
                Contact Farmer
            </button>
       
        </div>
        </div>
    );
    }