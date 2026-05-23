'use client';
import React, { useState, useEffect } from 'react';
import Category from '@/components/layout/Categories';
import ProductGrid from '@/components/marketplace/ProductGrid';
import Dashboard from '@/components/ui/Dashboard';
import { useRole } from '@/components/layout/RoleContext';
import { api } from '@/lib/api';
import ProductDetails from '@/components/marketplace/ProductDetails';

export default function Home() {
    const { role } = useRole();
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [products, setProducts] = useState<any[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 6;

    useEffect(() => {
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

    // TODO: add category filtering logic to backend later
    const filteredProducts = products;

    const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedProducts = filteredProducts.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    // Reset to page 1 when category changes
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedCategory]);

    return (
        <>
            {role === 'buyer' ? (
                selectedProduct ? (
                    <ProductDetails product={selectedProduct} onBack={() => setSelectedProduct(null)} />
                ) : (
                    <>
                        <Category selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} />
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