import React from 'react';
import ProductCard from '../ui/ProductCard';

export default function ProductGrid({ products, onProductClick, limit }: { products: any[], onProductClick?: (p: any) => void, limit?: number }) {
    const displayProducts = limit ? products.slice(0, limit) : products;

    return <div className="grid grid-cols-2 gap-2 px-3 pb-3.5">
            {displayProducts.map((p) => <ProductCard key={p.id} product={p} onClick={() => onProductClick?.(p)} />)}
        </div>;
}