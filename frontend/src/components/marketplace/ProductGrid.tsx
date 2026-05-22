import React from 'react';
import ProductCard from '../ui/ProductCard';
import { Product } from '@/data/marketplaceData';

export default function ProductGrid({ products }: { products: Product[] }) {

    return <div className="grid grid-cols-2 gap-2 px-3 pb-3.5">
            {products.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>;
}