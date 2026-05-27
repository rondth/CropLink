'use client';
import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';

interface Listing {
    id: number;
    crop_name: string;
    price: number;
    currency: string;
    quantity: number;
    unit_of_measurement: string;
    min_order_quantity: number;
    harvested_at: string;
    location: string;
    description: string;
}

export default function EditListingPage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id;

    const [listing, setListing] = useState<Partial<Listing>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!id) return;

        const fetchListing = async () => {
            setIsLoading(true);
            try {
                const { data } = await api.get(`/listings/${id}/`);
                // need YYYY-MM-DD for the input
                data.harvested_at = new Date(data.harvested_at).toISOString().split('T')[0];
                setListing(data);
            } catch (err) {
                console.error("Failed to fetch listing:", err);
                setError("Could not find the listing you're looking for.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchListing();
    }, [id]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setListing(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsSaving(true);
        setError('');

        // construct payload, ensuring numbers are parsed correctly
        const payload = {
            ...listing,
            price: parseFloat(listing.price as any),
            quantity: parseFloat(listing.quantity as any),
            min_order_quantity: parseFloat(listing.min_order_quantity as any),
            harvested_at: new Date(listing.harvested_at as string).toISOString(),
        };

        try {
            await api.patch(`/listings/${id}/`, payload); 
            router.push('/'); 
        } catch (err: any) {
            console.error("Failed to update listing:", err);
            setError(err.response?.data?.detail || "Failed to update listing. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return <div className="p-4 text-center font-black opacity-80 text-gray-800 text-m">Loading listing details...</div>;
    }

    if (error && !listing?.id) {
        return <div className="p-4 text-center text-red-600">{error}</div>;
    }

    return (
        <div className="p-4 pb-8">
            <h1 className="text-2xl font-black text-gray-800 mb-4 px-2">Edit Your Listing</h1>
            
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-4">
                {error && (
                    <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm font-bold rounded-xl px-4">
                        {error}
                    </div>
                )}

                <div>
                    <label htmlFor="crop_name" className="block text-xs font-bold text-gray-700 mb-1.5">Crop Name</label>
                    <input type="text" id="crop_name" name="crop_name" value={listing.crop_name || ''} onChange={handleInputChange} className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl p-2.5" />
                </div>

                <div>
                    <label htmlFor="price" className="block text-xs font-bold text-gray-700 mb-1.5">Price</label>
                    <input type="number" id="price" name="price" value={listing.price || ''} onChange={handleInputChange} className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl p-2.5" />
                </div>

                <div>
                    <label htmlFor="currency" className="block text-xs font-bold text-gray-700 mb-1.5">Currency</label>
                    <input type="text" id="currency" name="currency" value={listing.currency || ''} onChange={handleInputChange} className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl p-2.5" />
                </div>

                <div>
                    <label htmlFor="quantity" className="block text-xs font-bold text-gray-700 mb-1.5">Quantity</label>
                    <input type="number" id="quantity" name="quantity" value={listing.quantity || ''} onChange={handleInputChange} className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl p-2.5" />
                </div>

                <div>
                    <label htmlFor="unit_of_measurement" className="block text-xs font-bold text-gray-700 mb-1.5">Unit of Measurement</label>
                    <input type="text" id="unit_of_measurement" name="unit_of_measurement" value={listing.unit_of_measurement || ''} onChange={handleInputChange} className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl p-2.5" />
                </div>

                <div>
                    <label htmlFor="min_order_quantity" className="block text-xs font-bold text-gray-700 mb-1.5">Min Order Quantity</label>
                    <input type="number" id="min_order_quantity" name="min_order_quantity" value={listing.min_order_quantity || ''} onChange={handleInputChange} className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl p-2.5" />
                </div>

                <div>
                    <label htmlFor="harvested_at" className="block text-xs font-bold text-gray-700 mb-1.5">Harvested At</label>
                    <input type="date" id="harvested_at" name="harvested_at" value={listing.harvested_at || ''} onChange={handleInputChange} className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl p-2.5" />
                </div>

                <div>
                    <label htmlFor="location" className="block text-xs font-bold text-gray-700 mb-1.5">Location</label>
                    <input type="text" id="location" name="location" value={listing.location || ''} onChange={handleInputChange} className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl p-2.5" />
                </div>

                <div>
                    <label htmlFor="description" className="block text-xs font-bold text-gray-700 mb-1.5">Description</label>
                    <textarea id="description" name="description" value={listing.description || ''} onChange={handleInputChange} className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl p-2.5" rows={4} />
                </div>

                <div className="pt-2 mt-2 border-t border-gray-100">
                    <button type="submit" disabled={isSaving} className="w-full bg-CropLink-primary text-white font-black text-sm py-3.5 px-4 rounded-xl hover:bg-CropLink-dark opacity-100 active:scale-[0.98] transition-all disabled:opacity-50">
                        {isSaving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </form>
        </div>
    );
}