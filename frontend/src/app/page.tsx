'use client';
import React, { useState } from 'react';
import Category from '@/components/layout/Categories';
import ProductGrid from '@/components/marketplace/ProductGrid';
import Dashboard from '@/components/ui/Dashboard';
import { PRODUCTS } from '@/data/marketplaceData';
import { useRole } from '@/components/layout/RoleContext';

export default function Home() {
    const { role } = useRole();
    const [selectedCategory, setSelectedCategory] = useState('all');
    const filteredProducts = PRODUCTS.filter(p => selectedCategory === 'all' || p.category.includes(selectedCategory));

    return (
        <>
            {role === 'buyer' ? (
                <>
                    <Category selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} />
                    <div className="py-2"></div>
                    <ProductGrid products={filteredProducts} />
                </>
            ) : (
                <Dashboard />
            )}
        </>
    );
}