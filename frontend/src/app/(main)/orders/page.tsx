'use client';
import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';

export default function OrdersPage() {
    const { isAuthenticated, isLoading: authLoading } = useAuth();
    const router = useRouter();
    const [orders, setOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) return;
        const fetchOrders = async () => {
            try {
                const response = await api.get('/transactions');
                setOrders(response.data.transactions ?? []);
            } catch (error) {
                console.error("Failed to fetch orders:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchOrders();
    }, [isAuthenticated, authLoading]);

    if (authLoading) {
        return (
            <div className="flex justify-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-Croplink-primary"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="text-5xl">🔒</div>
                <h2 className="text-xl font-black text-gray-800">Sign in to view your orders</h2>
                <p className="text-sm text-gray-500 text-center">
                    Track your purchases and manage transactions in one place.
                </p>
                <button
                    onClick={() => router.push('/login')}
                    className="w-full max-w-xs bg-CropLink-primary text-white font-bold py-3 rounded-xl"
                >
                    Log In
                </button>
                <button
                    onClick={() => router.push('/signup')}
                    className="w-full max-w-xs border border-CropLink-primary text-CropLink-primary font-bold py-3 rounded-xl"
                >
                    Create Account
                </button>
            </div>
        );
    }

    return (
        <div className="p-6">
            <h1 className="text-2xl font-black text-gray-800 mb-2">Orders</h1>
            {isLoading ? (
                <div className="flex justify-center py-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-CropLink-primary"></div>
                </div>
            ) : orders.length === 0 ? (
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mt-4">
                    <p className="text-gray-500 text-sm text-center">No recent orders.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-3 mt-4">
                    {orders.map((order) => (
                        <div key={order.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="font-bold text-gray-800 text-sm">{order.listing?.crop_name || 'Unknown Crop'}</h3>
                                    <p className="text-[10px] text-gray-400 font-medium">
                                        Order ID: #{order.id.slice(0, 8)} • {new Date(order.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                                <span className={`text-[9px] font-black px-2 py-1 rounded-lg ${
                                    order.status === 'completed' ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-orange-600'
                                }`}>
                                    {order.status.toUpperCase()}
                                </span>
                            </div>
                            <div className="flex justify-between items-end border-t border-gray-50 pt-3">
                                <div className="text-[11px] text-gray-500">
                                    Qty: <span className="font-bold text-gray-700">{order.quantity} {order.listing?.unit_of_measurement || 'unit'}</span>
                                </div>
                                <div className="text-sm font-black text-CropLink-primary">
                                    {order.listing?.currency || '$'} {Intl.NumberFormat('en-US').format(order.quantity * (order.listing?.price || 0))}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
