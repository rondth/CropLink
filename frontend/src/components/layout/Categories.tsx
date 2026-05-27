'use client';
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import SearchBar from '@/components/ui/SearchBar';
import {api} from '@/lib/api';

export default function Categories({ 
    selectedCategory, 
    onSelectCategory,
    listings,
    onSearch
}: { 
    selectedCategory: string; onSelectCategory: (id: string) => void, listings: any[], onSearch: (term: string) => void 
}) {
    const [categories, setCategories] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchCategories = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await api.get('/listings/categories');
                if (response) {
                    setCategories(['All', ...response.data]);
                } 
            } catch (error: any) {
                console.error("Failed to fetch categories:", error.message);
                setError(error.message || "An error occurred");
            } finally {
                setLoading(false);
            }
        };
        
        fetchCategories();
    }, []);

    return (
    <div className="bg-CropLink-primary px-3 pt-1 pb-3.5 shrink-0 select-none">
        {/* search bar */}
        <SearchBar listings={listings} onSearch={onSearch} key={selectedCategory} />
        
        {loading && (
            <div className="mt-3 text-center text-white/70 text-sm">Loading categories...</div>
        )}

        {error && (
            <div className="mt-3 text-center text-red-300 text-sm">Error: {error}</div>
        )}

        <div className="mt-3 overflow-x-auto no-scrollbar">
            <div className="flex gap-2 px-0.5">
            {categories.map((categoryName) => (
                <div key={categoryName} onClick={() => onSelectCategory(categoryName)} className="flex flex-col items-center gap-1 cursor-pointer shrink-0 w-16">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg transition-colors ${selectedCategory === categoryName ? 'bg-white/40' : 'bg-white/20'}`}>
                    <Image src="/vegetable.png" alt={categoryName} width={24} height={24} />
                </div>
                <span className="text-[9px] font-bold text-white/85 text-center break-words leading-tight">{categoryName}</span>
                </div>
            ))}
            </div>
        </div>
    </div>
    );
}
