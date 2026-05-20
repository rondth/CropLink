'use client';
import React from 'react';
import { useRole } from '@/components/layout/RoleContext';

export default function RoleToggle() {
    const { role, setRole } = useRole();

    return (
        <div className="fixed top-4 left-4 z-50 bg-gray-200 rounded-lg p-1 flex gap-1 text-xs font-bold shadow-md">
            <button onClick={() => setRole('buyer')} className={`px-3 py-1 rounded-md ${role === 'buyer' ? 'bg-white shadow' : 'text-gray-500'}`}>Buyer</button>
            <button onClick={() => setRole('seller')} className={`px-3 py-1 rounded-md ${role === 'seller' ? 'bg-white shadow' : 'text-gray-500'}`}>Seller</button>
        </div>
    );
}
