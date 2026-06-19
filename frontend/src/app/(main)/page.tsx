'use client';
import React, { useState, useEffect, Suspense } from 'react';
import Categories from '@/components/layout/Categories';
import ProductGrid from '@/components/marketplace/ProductGrid';
import Dashboard from '@/components/ui/Dashboard';
import { useRole } from '@/components/layout/RoleContext';
import { api } from '@/lib/api';
import ProductDetails from '@/components/marketplace/ProductDetails';
import { useSearchParams } from 'next/navigation';

interface Product {
    id: string;
    category: string;
    [key: string]: any;
}

function HomeContent() {
    const { role } = useRole();
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [products, setProducts] = useState<Product[]>([]);
    const [searchFilter, setSearchFilter] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 6;
    const searchParams = useSearchParams();

    useEffect(() => {
        const pending = sessionStorage.getItem('pendingProduct');
        if (pending) {
            sessionStorage.removeItem('pendingProduct');
            setSelectedProduct(JSON.parse(pending));
        }
        const fetchListings = async () => {
            try {
                const response = await api.get('/listings/');
                setProducts(response.data);
            } catch (error) {
                console.error("Failed to fetch listings:", error);
            }
        };
        fetchListings();
    }, []);

    useEffect(() => {
        const listingId = searchParams.get('listing_id');
        if (!listingId) return;

        api.get(`/listings/${listingId}`)
            .then(res => setSelectedProduct(res.data))
            .catch(err => console.error('Failed to load listing from URL:', err));
    }, [searchParams]);

    const filteredProducts = products.filter(product => {
        const categoryMatch = selectedCategory === 'All' || product.category === selectedCategory;
        const searchMatch = !searchFilter || product.crop_name.toLowerCase().includes(searchFilter.toLowerCase());
        return categoryMatch && searchMatch;
    });

    const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedProducts = filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    useEffect(() => {
        if (selectedProduct) {
            const scroller = document.getElementById('main-scroller');
            if (scroller) scroller.scrollTop = 0;
        }
    }, [selectedProduct]);

    useEffect(() => {
        setCurrentPage(1);
    }, [selectedCategory, searchFilter]);

    const handleCategorySelect = (category: string) => {
        setSelectedCategory(category);
        setSearchFilter('');
    };

    useEffect(() => {
        const listing_id = searchParams.get('listing_id');
        if (listing_id && products.length > 0) {
            const product = products.find(p => p.id === listing_id);
            if (product) setSelectedProduct(product);
        }
    }, [searchParams, products]);

    return (
        <>
            {role !== 'seller' ? (
                selectedProduct ? (
                    <ProductDetails product={selectedProduct} onBack={() => setSelectedProduct(null)} />
                ) : (
                    <>
                        <Categories 
                            selectedCategory={selectedCategory} 
                            onSelectCategory={handleCategorySelect} 
                            listings={products}
                            onSearch={setSearchFilter}
                        />
                        <div className="py-2"></div>
                        <ProductGrid products={paginatedProducts} onProductClick={setSelectedProduct} />
                        
                        {/* page numbers */}
                        {totalPages > 1 && (
                            <div className="flex justify-center items-center gap-4 pb-10 mt-2">
                                <button 
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    className="px-4 py-2 text-[10px] font-bold bg-white border border-gray-100 shadow-sm rounded-xl disabled:opacity-40 text-gray-600 active:scale-95 transition-all"
                                >
                                    Previous
                                </button>

                                <span className="text-[10px] font-bold text-gray-400">Page {currentPage} of {totalPages}</span>
                                
                                <button 
                                    disabled={currentPage === totalPages}
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    className="px-4 py-2 text-[10px] font-bold bg-white border border-gray-100 shadow-sm rounded-xl disabled:opacity-40 text-gray-600 active:scale-95 transition-all"
                                >
                                    Next
                                </button>
                            </div>
                        )}
                    </>
                )
            ) : (
                <Dashboard />
            )}
        </>
    );
}

export default function Home() {
    return (
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#faf8f5]"><p className="text-sm font-bold text-gray-400">Loading...</p></div>}>
            <HomeContent />
        </Suspense>
    );
}