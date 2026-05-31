'use client';
import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';

interface Listing {
    id: string;
    crop_name: string;
    category: string;
    price: number;
    currency: string;
    quantity: number;
    unit_of_measurement: string;
    min_order_quantity: number;
    harvested_at: string;
    location: string;
    description: string;
    status: 'active' | 'sold' | 'inactive';
    photo_url: string | null;
}

export default function EditListingPage() {
    const router = useRouter();
    const params = useParams();
    const id = params.id;

    const [listing, setListing] = useState<Partial<Listing>>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [removeCurrentPhoto, setRemoveCurrentPhoto] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cameraInputRef = useRef<HTMLInputElement>(null);  

    useEffect(() => {
        if (!id) return;

        const fetchListing = async () => {
            setIsLoading(true);
            try {
                const { data } = await api.get(`/listings/${id}`);
                data.harvested_at = new Date(data.harvested_at).toISOString().split('T')[0];
                setListing(data);
                if (data.photo_url) setPreviewUrl(data.photo_url);
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

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // 5MB limit check
        if (file.size > 5 * 1024 * 1024) {
            setError('Image must be under 5MB.');
            return;
        }

        setSelectedFile(file);
        setRemoveCurrentPhoto(false);
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
        setIsSaving(true);
        setError('');

        try {
            let photoUrl = listing.photo_url ?? null;
            if (selectedFile) {
                photoUrl = await uploadPhoto(selectedFile);
                if (!photoUrl) {
                    setError('Failed to upload photo. Please try again.');
                    setIsSaving(false);
                    return;
                }
            } else if (removeCurrentPhoto) {
                photoUrl = null;
            }

            const payload = {
                crop_name: listing.crop_name,
                category: listing.category,
                price: listing.price ? parseFloat(listing.price as any) : undefined,
                currency: listing.currency,
                quantity: listing.quantity ? parseFloat(listing.quantity as any) : undefined,
                unit_of_measurement: listing.unit_of_measurement,
                min_order_quantity: listing.min_order_quantity ? parseFloat(listing.min_order_quantity as any) : undefined,
                harvested_at: listing.harvested_at ? new Date(listing.harvested_at as string).toISOString() : undefined,
                location: listing.location,
                description: listing.description,
                status: listing.status,
                photo_url: photoUrl
            };

            await api.patch(`/listings/${id}`, payload); 
            router.push('/'); 
        } catch (err: any) {
            console.error("Failed to update listing:", err);
            const errorDetail = err.response?.data?.detail;
            if (Array.isArray(errorDetail)) {
                setError(errorDetail.map(d => `${d.loc[1]}: ${d.msg}`).join('; '));
            } else {
                setError(errorDetail || "Failed to update listing. Please try again.");
            }
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
            <button
                type="button"
                onClick={() => router.back()}
                className="flex items-center gap-1 text-sm font-bold text-gray-500 mb-3 px-2 hover:text-gray-800 transition-colors"
            >
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12.5 15L7.5 10L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Back
            </button>
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
                    <label htmlFor="category" className="block text-xs font-bold text-gray-700 mb-1.5">Category</label>
                    <div className="relative">
                        <select
                            id="category"
                            name="category"
                            value={listing.category || ''}
                            onChange={handleInputChange}
                            className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl p-2.5 pr-10 outline-none focus:border-CropLink-primary"
                        >
                            <option value="">Select a category</option>
                                <option value="Cereals & Tubers">Cereals & Tubers</option>
                                <option value="Meat, Fish & Eggs">Meat, Fish & Eggs</option>
                                <option value="Oil & Fats">Oil & Fats</option>
                                <option value="Pulses & Nuts">Pulses & Nuts</option>
                                <option value="Vegetables & Fruits">Vegetables & Fruits</option>
                            </select>
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-500">
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </span>
                    </div>
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

                <div>
                    <label htmlFor="status" className="block text-xs font-bold text-gray-700 mb-1.5">Status</label>
                    <div className="relative">
                        <select
                            id="status"
                            name="status"
                            value={listing.status || 'active'}
                            onChange={handleInputChange}
                            className="w-full appearance-none bg-white border-2 border-gray-200 text-gray-800 text-sm font-sans font-normal rounded-xl px-3 py-2.5 pr-10 focus:outline-none focus:border-CropLink-primary"
                        >
                            <option value="active">Active</option>
                            <option value="sold">Sold</option>
                            <option value="inactive">Inactive</option>
                        </select>

                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-500" aria-hidden="true">
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </span>
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">Crop Photo</label>

                    {previewUrl ? (
                        <div
                            className="relative w-full h-40 border-2 border-gray-200 rounded-xl overflow-hidden cursor-pointer"
                            onClick={() => fileInputRef.current?.click()}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    fileInputRef.current?.click();
                                }
                            }}
                            aria-label="Replace crop photo"
                        >
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

                    <div className="grid grid-cols-2 gap-2 mt-3 w-full">
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="w-full inline-flex items-center justify-center rounded-lg border-2 border-gray-200 bg-white px-3 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 active:scale-[0.98] transition-all"
                        >
                            Replace Photo
                        </button>

                        {(previewUrl || listing.photo_url) && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedFile(null);
                                    setPreviewUrl(null);
                                    setRemoveCurrentPhoto(true);
                                }}
                                className="w-full inline-flex items-center justify-center rounded-lg border-2 border-red-300 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-100 active:scale-[0.98] transition-all"
                            >
                                Delete Photo
                            </button>
                        )}
                    </div>

                    {selectedFile && (
                        <div className="flex items-center justify-between mt-2 px-1">
                            <span className="text-xs text-gray-500 truncate">{selectedFile.name}</span>
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedFile(null);
                                    setPreviewUrl(listing.photo_url ?? null);
                                    setRemoveCurrentPhoto(false);
                                }}
                                className="text-xs text-red-400 font-bold ml-2 shrink-0"
                            >
                                Remove
                            </button>
                        </div>
                    )}
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
