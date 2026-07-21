import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { COUNTRIES } from '@/lib/constants/countries';

export default function CountrySelect({
    value,
    onChange,
    placeholder = 'Select country',
}: {
    value: string | null;
    onChange: (code: string) => void;
    placeholder?: string;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    const selected = useMemo(
        () => COUNTRIES.find((c) => c.code === value) ?? null,
        [value]
    );

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return COUNTRIES;
        return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q));
    }, [query]);

    useEffect(() => {
        setActiveIndex(0);
    }, [query, isOpen]);

    useEffect(() => {
        if (isOpen) searchRef.current?.focus();
    }, [isOpen]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setQuery('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
        el?.scrollIntoView({ block: 'nearest' });
    }, [activeIndex, isOpen]);

    const handleSelect = (code: string) => {
        onChange(code);
        setIsOpen(false);
        setQuery('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActiveIndex((i) => Math.max(i - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const country = filtered[activeIndex];
            if (country) handleSelect(country.code);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setIsOpen(false);
            setQuery('');
        }
    };

    return (
        <div className="relative w-full" ref={containerRef}>
            <button
                type="button"
                onClick={() => setIsOpen((o) => !o)}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-left"
            >
                <span className={selected ? 'text-gray-800 font-medium' : 'text-gray-400'}>
                    {selected ? selected.name : placeholder}
                </span>
                <ChevronDown size={16} className={`text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 z-50 mt-1 w-full rounded-xl bg-white shadow-lg border border-gray-100 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
                        <Search size={14} className="text-gray-400 flex-shrink-0" />
                        <input
                            ref={searchRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Search countries..."
                            className="w-full bg-transparent border-none outline-none text-sm text-gray-800 placeholder:text-gray-400"
                        />
                    </div>
                    <ul
                        ref={listRef}
                        role="listbox"
                        className="max-h-48 overflow-y-auto py-1"
                    >
                        {filtered.length === 0 && (
                            <li className="px-3 py-2 text-xs text-gray-400">No countries found</li>
                        )}
                        {filtered.map((c, i) => (
                            <li
                                key={c.code}
                                role="option"
                                aria-selected={c.code === value}
                                onMouseEnter={() => setActiveIndex(i)}
                                onClick={() => handleSelect(c.code)}
                                className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between ${
                                    i === activeIndex ? 'bg-CropLink-primary/10 text-CropLink-primary' : 'text-gray-700'
                                }`}
                            >
                                <span className="font-medium">{c.name}</span>
                                <span className="text-[10px] text-gray-400">{c.code}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
