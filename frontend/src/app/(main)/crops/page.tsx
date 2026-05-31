'use client';
import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useRole } from '@/components/layout/RoleContext';
import { supabase } from '@/lib/supabase';


export default function CropsListing() {
    const router = useRouter();
    const { role } = useRole();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (role === 'buyer') {
            router.push('/');
        }
    }, [role, router]);

    if (role === 'buyer') {
        return null; 
    }

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // 5MB limit check
        if (file.size > 5 * 1024 * 1024) {
            setError('Image must be under 5MB.');
            return;
        }

        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        setError('');
    }

    const uploadPhoto = async (file: File): Promise<string | null> => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('listing-images')
            .upload(fileName, file);
        
        if (uploadError) {
            console.error('Upload error:', uploadError);
            return null;
        }

        const { data } = supabase.storage
            .from('listing-images')
            .getPublicUrl(fileName);

        return data.publicUrl;
    }

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        const formData = new FormData(e.currentTarget);

        try {
            let photoUrl: string | null = null;
            if (selectedFile) {
                photoUrl = await uploadPhoto(selectedFile);
                if (!photoUrl) {
                    setError('Failed to upload photo. Please try again.');
                    setIsLoading(false);
                    return;
                }
            }
            
            const payload = {
                crop_name: formData.get('crop_name'),
                category: formData.get('category'),
                price: parseFloat(formData.get('price') as string),
                currency: formData.get('currency'),
                quantity: parseFloat(formData.get('quantity') as string),
                unit_of_measurement: formData.get('unit'),
                min_order_quantity: parseFloat(formData.get('min_order_quantity') as string),
                status: 'active',
                harvested_at: new Date(formData.get('harvested_at') as string).toISOString(),
                location: formData.get('location'),
                description: formData.get('desc'),
                photo_url: photoUrl
            };

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

                {/* category */}
                <div>
                    <label htmlFor="category" className="block text-xs font-bold text-gray-700 mb-1.5">Category *</label>
                    <select required id="category" name="category" className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl focus:ring-CropLink-primary focus:border-CropLink-primary block p-2.5 outline-none transition-colors appearance-none">
                        <option value="">Select a category</option>
                        <option value="grains">Cereals & Tubers</option>
                        <option value="fruits">Meat, Fish & Eggs</option>
                        <option value="grains">Oil & Fats</option>
                        <option value="legumes">Pulses & Nuts</option>
                        <option value="vegetables">Vegetables & Fruits</option>
                    </select>
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
                            <option value="USD">USD</option>
                            <option value="THB">BAHT</option>
                            <option value="IDR">IDR</option>
                            <option value="MMK">MMK</option>
                            <option value="LAK">LAK</option>
                            <option value="PHP">PHP</option>
                            
                            
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
                    {/* photo upload / photo take */}
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Crop Photo</label>

                    {previewUrl ? (
                        <div className="relative w-full h-40 border-2 border-gray-200 rounded-xl overflow-hidden">
                            <Image src={previewUrl} alt="Preview" fill sizes="100vw" className="object-contain rounded-lg" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3">
                            <div
                                onClick={() => cameraInputRef.current?.click()}
                                className="flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 cursor-pointer hover:border-CropLink-primary transition-colors"
                            >
                                <span className="text-3xl">📷</span>
                                <p className="text-sm font-bold text-CropLink-primary">Take Photo</p>
                                <p className="text-[10px] text-gray-400">Use camera</p>
                            </div>

                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50 cursor-pointer hover:border-CropLink-primary transition-colors"
                            >
                                <span className="text-3xl">🖼️</span>
                                <p className="text-sm font-bold text-CropLink-primary">Upload File</p>
                                <p className="text-[10px] text-gray-400">PNG, JPG up to 5MB</p>
                            </div>
                        </div>
                    )}

                    <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={handleFileChange} />
                    <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={handleFileChange} />

                    {selectedFile && (
                        <div className="flex items-center justify-between mt-2 px-1">
                            <span className="text-xs text-gray-500 truncate">{selectedFile.name}</span>
                            <button
                                type="button"
                                onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}
                                className="text-xs text-red-400 font-bold ml-2 shrink-0"
                            >
                                Remove
                            </button>
                        </div>
                    )}
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
