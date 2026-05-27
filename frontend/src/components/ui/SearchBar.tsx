import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Search } from 'lucide-react';

interface Listing {
    id: string;
    crop_name: string;
    location: string;
    [key: string]: any;
}

const debounce = <T extends (...args: any[]) => void>(func: T, delay: number) => {
    let timeoutId: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
}

const SearchBar = ({ listings, onSearch }: { listings: Listing[], onSearch: (term: string) => void }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<string[]>([]);
    const [isFocused, setIsFocused] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    const uniqueCropNames = useMemo(() => {
        if (!listings) return [];
        const names = new Set(listings.map(l => l.crop_name));
        return Array.from(names);
    }, [listings]);

    const handleSearch = useCallback(debounce((term: string) => {
        if (term.trim() === '' || !listings) {
            setSearchResults([]);
        } else {
            const results = uniqueCropNames.filter((name) => name.toLowerCase().includes(term.toLowerCase()));
            setSearchResults(results);
        }
    }, 300), [listings, uniqueCropNames]);

    useEffect(() => {
        if (isFocused) {
            handleSearch(searchTerm);
        }
    }, [searchTerm, handleSearch, isFocused]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsFocused(false);
                setSearchResults([]);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    }

    const handleSelect = (cropName: string) => {
        setSearchTerm(cropName);
        onSearch(cropName);
        setSearchResults([]);
        setIsFocused(false);
    }

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        onSearch(searchTerm);
        setSearchResults([]);
    };

return (
    <div className="relative w-full" ref={searchRef}>
      <form
        onSubmit={handleSubmit}
        className="w-full"
      >
        <div className="bg-white/20 rounded-lg flex items-center gap-2 p-2 cursor-text w-full">
          <button type="submit" className="text-[#b4c3b2] hover:text-gray-300">
              <Search size={13} />{' '}
            </button>
          <input
            type="text"
            value={searchTerm}
            onChange={handleChange}
            className="bg-transparent border-none outline-none text-white text-xs font-medium w-full placeholder:text-white/55"
            placeholder="Search crops, farmers, farms..."
            onFocus={() => setIsFocused(true)}
          />
        </div>
      </form>
      {isFocused && searchResults.length > 0 && (
        <div className="absolute top-full left-0 z-50 mt-1 w-full rounded-lg bg-white p-2 shadow-lg text-black max-h-60 overflow-y-auto">
          <ul className="flex flex-col gap-1">
            {searchResults.map((result) => (
              <li key={result}
                  onClick={() => handleSelect(result)}
                  className="p-2 hover:bg-gray-100 rounded-md cursor-pointer"
              >
                <p className="text-sm font-semibold text-gray-800">{result}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export default SearchBar;