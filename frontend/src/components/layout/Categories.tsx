'use client';
import React from 'react';
import Image from 'next/image';
import { CATEGORIES } from '@/data/marketplaceData';
import SearchBar from '@/components/ui/SearchBar';

export default function Category({ selectedCategory, onSelectCategory }: { selectedCategory: string; onSelectCategory: (id: string) => void }) {
    return (
    <div className="bg-CropLink-primary px-3 pt-1 pb-3.5 shrink-0 select-none">
        {/* search bar */}
        <SearchBar />
        
        <div className="mt-3 overflow-x-auto no-scrollbar">
            <div className="flex gap-2 px-0.5">
            {CATEGORIES.map((cat) => (
                <div key={cat.id} onClick={() => onSelectCategory(cat.id)} className="flex flex-col items-center gap-1 cursor-pointer shrink-0">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg transition-colors ${selectedCategory === cat.id ? 'bg-white/40' : 'bg-white/20'}`}>
                    <Image src={cat.icon} alt={cat.label} width={24} height={24} />
                </div>
                <span className="text-[9px] font-bold text-white/85 whitespace-nowrap">{cat.label}</span>
                </div>
            ))}
            </div>
        </div>
    </div>
);}
