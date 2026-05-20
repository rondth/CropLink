'use client';
    import React, { useState } from 'react';
    import Image from 'next/image';
    import { Product } from '@/data/marketplaceData';
    export default function ProductCard({ product }: { product: Product }) {
    const [isLiked, setIsLiked] = useState(false);
    return (
        <div className="bg-white rounded-xl overflow-hidden border border-gray-100 cursor-pointer transition-transform duration-120 active:scale-[0.97]">
        <div className="h-[130px] flex items-center justify-center text-5xl bg-[#f7f5f0] relative select-none">
            {product.emoji.endsWith('.png') ? (
                <Image src={product.emoji} alt={product.name} fill className="object-cover" />
            ) : (
                product.emoji
            )}

            {/* <button onClick={(e) => { e.stopPropagation(); setIsLiked(!isLiked); }} className="absolute top-1.5 right-1.5 bg-white/85 rounded-full w-6 h-6 flex items-center justify-center text-xs shadow-sm">
            <span className={isLiked ? 'text-gainz-accentRed' : 'text-gray-300'}>❤️</span>
            </button> */}
        </div>

        <div className="p-2">
            <h4 className="text-[11px] font-bold text-gainz-dark line-clamp-2 leading-tight mb-1">
                {product.name}
            </h4>

            <div className="text-[9px] text-gray-400 font-semibold mb-1">
                📍 {product.location}
            </div>

            <div className="text-sm font-black text-gainz-primary">
                ${product.price.toFixed(2)} 
                <span className="text-[11px] text-gray-600 font-medium">
                    / kg
                </span>
            </div>

            <button className="w-full bg-gainz-primary text-white rounded-lg py-1.5 text-[10px] font-bold mt-1.5">
                Contact Farmer
            </button>
       
        </div>
        </div>
    );
    }