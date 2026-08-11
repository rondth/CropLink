'use client';
import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { SlidersHorizontal } from 'lucide-react';
import SearchBar from '@/components/ui/SearchBar';
import {api} from '@/lib/api';
import { getCurrencySymbol } from '@/lib/utils';

const categoryIconMap: Record<string, string> = {
    all: '/all.png',
    cerealstubers: '/cerealstubers.png',
    meatfisheggs: '/meatfisheggs.png',
    oilfats: '/oilfats.png',
    pulsesnuts: '/pulsesnuts.png',
    vegetablesfruits: '/vegetablesfruits.png',
    others: '/others.png',
};

const normalizeCategoryKey = (categoryName: string) =>
    categoryName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

const getCategoryIcon = (categoryName: string) => {
    const key = normalizeCategoryKey(categoryName);
    return categoryIconMap[key] || '/file.png';
};

export default function Categories({
    selectedCategory,
    onSelectCategory,
    listings,
    onSearch,
    priceCurrency,
    minPriceInput,
    maxPriceInput,
    onMinPriceChange,
    onMaxPriceChange,
    onApplyPrice,
    onClearPrice,
    isPriceRangeApplied,
}: {
    selectedCategory: string;
    onSelectCategory: (id: string) => void;
    listings: any[];
    onSearch: (term: string) => void;
    priceCurrency?: string;
    minPriceInput: string;
    maxPriceInput: string;
    onMinPriceChange: (value: string) => void;
    onMaxPriceChange: (value: string) => void;
    onApplyPrice: () => void;
    onClearPrice: () => void;
    isPriceRangeApplied: boolean;
}) {
    const [categories, setCategories] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filterOpen, setFilterOpen] = useState(false);
    const filterRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
                setFilterOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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
        {/* search bar + price filter */}
        <div className="flex items-center gap-2">
            <div className="flex-1 min-w-0">
                <SearchBar listings={listings} onSearch={onSearch} key={selectedCategory} />
            </div>

            <div className="relative shrink-0" ref={filterRef}>
                <button
                    type="button"
                    onClick={() => setFilterOpen((open) => !open)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${isPriceRangeApplied ? 'bg-white text-CropLink-primary' : 'bg-white/20 text-white'}`}
                    aria-label="Filter by price"
                >
                    <SlidersHorizontal size={14} />
                </button>

                {filterOpen && (
                    <div className="absolute top-full right-0 mt-2 w-56 rounded-xl bg-white shadow-lg p-3 z-50 text-black">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-2">
                            Price Range {priceCurrency ? `(${priceCurrency.toUpperCase()})` : ''}
                        </p>
                        <div className="flex items-center gap-2">
                            <div className="relative w-full">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">
                                    {getCurrencySymbol(priceCurrency)}
                                </span>
                                <input
                                    type="number"
                                    min="0"
                                    value={minPriceInput}
                                    onChange={(e) => onMinPriceChange(e.target.value)}
                                    placeholder="Min"
                                    className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-xs rounded-lg focus:ring-CropLink-primary focus:border-CropLink-primary p-2 pl-6 outline-none transition-colors"
                                />
                            </div>
                            <span className="text-gray-400 text-xs">-</span>
                            <div className="relative w-full">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">
                                    {getCurrencySymbol(priceCurrency)}
                                </span>
                                <input
                                    type="number"
                                    min="0"
                                    value={maxPriceInput}
                                    onChange={(e) => onMaxPriceChange(e.target.value)}
                                    placeholder="Max"
                                    className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-xs rounded-lg focus:ring-CropLink-primary focus:border-CropLink-primary p-2 pl-6 outline-none transition-colors"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-2 mt-3">
                            <button
                                onClick={() => { onApplyPrice(); setFilterOpen(false); }}
                                className="flex-1 py-2 rounded-lg bg-CropLink-primary text-white text-xs font-bold active:scale-95 transition-transform"
                            >
                                Apply
                            </button>
                            {isPriceRangeApplied && (
                                <button
                                    onClick={() => { onClearPrice(); setFilterOpen(false); }}
                                    className="px-3 py-2 rounded-lg border border-gray-200 text-xs font-bold text-gray-500 active:scale-95 transition-transform"
                                >
                                    Clear
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>

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
                    <Image src={getCategoryIcon(categoryName)} alt={categoryName} width={24} height={24} />
                </div>
                <span className="text-[9px] font-bold text-white/85 text-center break-words leading-tight">{categoryName}</span>
                </div>
            ))}
            </div>
        </div>
    </div>
    );
}
