'use client';
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useRole } from '@/components/layout/RoleContext';


export default function CropsListing() {
    const router = useRouter();
    const { role } = useRole();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (role === 'buyer') {
            router.push('/');
        }
    }, [role, router]);

    if (role === 'buyer') {
        return null; 
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        const formData = new FormData(e.currentTarget);
        
        // construct payload from input data
        const payload = {
            crop_name: formData.get('crop_name'),
            price: parseFloat(formData.get('price') as string),
            currency: formData.get('currency'),
            quantity: parseFloat(formData.get('quantity') as string),
            unit_of_measurement: formData.get('unit'),
            min_order_quantity: parseFloat(formData.get('min_order_quantity') as string),
            status: 'active',
            harvested_at: new Date(formData.get('harvested_at') as string).toISOString(),
            location: formData.get('location'),
            description: formData.get('desc'),
            photo_url: null
        };

        try {
            await api.post('/listings/', payload); //post to backend
            router.push('/');
        } catch (err: any) {
            console.error("Failed to create listing:", err);
            setError(err.response?.data?.detail || "Failed to publish listing. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };
    return (
        
        <div className="p-4 pb-8">
            <h1 className="text-2xl font-black text-gray-800 mb-4 px-2">List Your Crop</h1>
            
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-4">
            {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm font-bold rounded-xl px-4">
                    {error}
                </div>
            )}
                {/* crop_name */}
                <div>
                    <label htmlFor="crop_name" className="block text-xs font-bold text-gray-700 mb-1.5">Crop Name *</label>
                    <input required type="text" id="crop_name" name="crop_name" className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl focus:ring-CropLink-primary focus:border-CropLink-primary block p-2.5 outline-none transition-colors" placeholder="e.g., Organic Carrots" />
                </div>

                <div className="flex gap-3">
                    {/* price */}
                    <div className="flex-1">
                        <label htmlFor="price" className="block text-xs font-bold text-gray-700 mb-1.5">Price *</label>
                        <input required type="number" id="price" name="price" min="0" step="0.01" className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl focus:ring-CropLink-primary focus:border-CropLink-primary block p-2.5 outline-none transition-colors" placeholder="0.00" />
                    </div>
                    {/* currency */}
                    <div className="w-[100px]">
                        <label htmlFor="currency" className="block text-xs font-bold text-gray-700 mb-1.5">Currency *</label>
                        <select id="currency" name="currency" className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl focus:ring-CropLink-primary focus:border-CropLink-primary block p-2.5 outline-none transition-colors appearance-none">
                            <option value="THB">BAHT</option>
                            <option value="EUR">EUR</option>
                            <option value="IDR">IDR</option>
                            <option value="SGD">SGD</option>
                            <option value="USD">USD</option>
                            
                        </select>
                    </div>
                </div>

                <div className="flex gap-3">
                    {/* quantity */}
                    <div className="flex-1">
                        <label htmlFor="quantity" className="block text-xs font-bold text-gray-700 mb-1.5">Quantity *</label>
                        <input required type="number" id="quantity" name="quantity" min="0" className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl focus:ring-CropLink-primary focus:border-CropLink-primary block p-2.5 outline-none transition-colors" placeholder="Available qty" />
                    </div>
                    {/* unit_of_measurement */}
                    <div className="w-[100px]">
                        <label htmlFor="unit" className="block text-xs font-bold text-gray-700 mb-1.5">Unit *</label>
                        <select id="unit" name="unit" className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl focus:ring-CropLink-primary focus:border-CropLink-primary block p-2.5 outline-none transition-colors appearance-none">
                            <option value="kg">kg</option>
                            <option value="lbs">lbs</option>
                            <option value="pcs">pcs</option>
                            <option value="tons">tons</option>
                        </select>
                    </div>
                </div>
                
                <div>
                    {/* min_order_quantity */}
                    <label htmlFor="min_order_quantity" className="block text-xs font-bold text-gray-700 mb-1.5">Min. Order Qty *</label>
                    <input required type="number" id="min_order_quantity" name="min_order_quantity" min="1" className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl focus:ring-CropLink-primary focus:border-CropLink-primary block p-2.5 outline-none transition-colors" placeholder="e.g., 5" />
                </div>

                <div>
                    {/* harvested_date */}
                    <label htmlFor="harvested_at" className="block text-xs font-bold text-gray-700 mb-1.5">Harvested date *</label>
                    <input required type="date" id="harvested_at" name="harvested_at" className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl focus:ring-CropLink-primary focus:border-CropLink-primary block p-2.5 outline-none transition-colors" />
                </div>

                <div>
                    {/* location */}
                    <label htmlFor="location" className="block text-xs font-bold text-gray-700 mb-1.5">Location *</label>
                    <input required type="text" id="location" name="location" className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl focus:ring-CropLink-primary focus:border-CropLink-primary block p-2.5 outline-none transition-colors" placeholder="e.g., Cebu City, Philippines" />
                </div>

                <div>
                    {/* description */}
                    <label htmlFor="desc" className="block text-xs font-bold text-gray-700 mb-1.5">Description</label>
                    <textarea id="desc" name="desc" rows={3} className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl focus:ring-Croplink-primary focus:border-Croplink-primary block p-2.5 outline-none transition-colors resize-none" placeholder="Describe your crop's quality, variety, etc."></textarea>
                </div>

                <div>
                    {/* photo */}
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Crops Photo</label>
                    <div className="flex justify-center px-6 py-6 border-2 border-gray-200 border-dashed rounded-xl bg-gray-50">
                        <div className="text-center">
                        <Image src="/file.png" alt="File Image" className="mx-auto text-center justify-center" width={50} height={50} />
                            <div className="flex text-sm text-gray-600 justify-center mt-2">
                                <label htmlFor="photo" className="relative cursor-pointer bg-white rounded-md font-bold text-CropLink-primary hover:text-CropLink-dark transition-colors">
                                    <span>Upload a file</span>
                                    <input id="photo" name="photo" type="file" accept="image/*" className="sr-only" />
                                </label>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-1">PNG, JPG up to 5MB</p>
                        </div>
                    </div>
                </div>

                {/* submit Button */}
                <div className="pt-2 mt-2 border-t border-gray-100">
                    <button type="submit" disabled={isLoading} className="w-full bg-CropLink-primary text-white font-black text-sm py-3.5 px-4 rounded-xl hover:bg-CropLink-dark active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100">
                        {isLoading ? 'Publishing...' : 'Publish Listing'}
                    </button>
                </div>
            </form>
        </div>
    );}
