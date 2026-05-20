import React, { useState, useCallback, useEffect} from 'react';
import {Search, Mic} from 'lucide-react';

const sampleData = [
    {
        id: 1,
        title: 'Apple',
        url: 'https://example.com/apple'
    }
]

const debounce = <T extends (...args: any[]) => void>(func: T, delay: number) => {
    let timeoutId: ReturnType<typeof setTimeout>;
    return (...args: Parameters<T>) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
}

const SearchBar = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<typeof sampleData>([]);

    const handleSearch = useCallback(debounce((term: string) => {
        if (term.trim() === '') {
            setSearchResults([]);
        } else {
            const results = sampleData.filter((item) => item.title.toLowerCase().includes(term.toLowerCase()));
            setSearchResults(results);
        }
    }, 300), []);

    useEffect(() => {
        handleSearch(searchTerm);
    }, [searchTerm, handleSearch]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    }

return (
    <div className="relative w-full">
      <form
        onSubmit={(e: React.FormEvent<HTMLFormElement>) => e.preventDefault()}
        className="w-full"
      >
        <div className="bg-white/20 rounded-lg flex items-center gap-2 p-2 cursor-text w-full">
          <button type="submit" className="text-[#b4c3b2] hover:text-gray-300">
              <Search size={13} />{' '}
            </button>{' '}
          <input
            type="text"
            value={searchTerm}
            onChange={handleChange}
            className="bg-transparent border-none outline-none text-white text-xs font-medium w-full placeholder:text-white/55"
            placeholder="Search crops, farmers, farms..."
          />
        </div>
      </form>
      {searchResults.length > 0 && (
        <div className="absolute top-full left-0 z-50 mt-1 w-full rounded-lg bg-white p-4 shadow-md text-black">
          <h2 className="mb-4 text-xl font-bold"> Search Results: </h2>{' '}
          <ul>
            {' '}
            {searchResults.map((result) => (
              <li key={result.id} className="mb-2">
                <a
                  href={result.url}
                  className="text-blue-600 hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {' '}
                  {result.title}{' '}
                </a>{' '}
              </li>
            ))}{' '}
          </ul>{' '}
        </div>
      )}{' '}
    </div>
  )
}

export default SearchBar;