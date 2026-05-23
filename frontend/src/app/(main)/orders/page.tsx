'use client';
import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function OrdersPage() {
    const [orders, setOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const response = await api.get('/transactions/');
                setOrders(response.data);
            } catch (error) {
                console.error("Failed to fetch orders:", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchOrders();
    }, []);

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
