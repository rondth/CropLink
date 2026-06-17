'use client';
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { Camera, Edit2, LogOut, Check, X, User, Banknote, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export default function Profile() {
    const { isAuthenticated, isLoading, user, logout, refreshUser } = useAuth();
    const router = useRouter();

    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState('');
    const [prefferedCurrency, setprefferedCurrency] = useState('USD');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [profileLoading, setProfileLoading] = useState(true);
    const [numListings, setNumListings] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isAuthenticated && user) {
            api.get('/auth/me').then(res => {
                setName(res.data.name || '');
                setAvatarUrl(res.data.profile_picture_url || null);
                setprefferedCurrency(res.data.preffered_currency || 'USD');
                setNumListings(res.data.num_listings || 0);
                setProfileLoading(false);
            }).catch(() => {
                setName(user.name || '');
                setprefferedCurrency(user.preffered_currency || 'USD');
                setProfileLoading(false);
            });
        }
    }, [isAuthenticated, user]);

    const handleLogout = async () => {
        await logout();
        router.push('/login');
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
            alert('Image must be under 5MB.');
            return;
        }
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
    };

    const uploadAvatar = async (file: File): Promise<string | null> => {
        const userId = (user as any)?.user_id || (user as any)?.id;
        if (!userId) throw new Error("Missing User ID. Cannot verify secure folder structure.");

        const fileExt = file.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('profile_pictures')
            .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage.from('profile_pictures').getPublicUrl(fileName);
        return data.publicUrl;
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            let finalAvatarUrl = avatarUrl;
            if (selectedFile) {
                try {
                    finalAvatarUrl = await uploadAvatar(selectedFile);
                } catch (uploadErr: any) {
                    alert(`Failed to upload profile picture: ${uploadErr.message || 'Unknown error'}`);
                    setIsSaving(false);
                    return;
                }
            }

            await api.patch('/auth/me', { name, profile_picture_url: finalAvatarUrl, preffered_currency: prefferedCurrency });

            setAvatarUrl(finalAvatarUrl);
            setIsEditing(false);
            setSelectedFile(null);
            setPreviewUrl(null);
            await refreshUser();
        } catch (err) {
            console.error("Failed to update profile", err);
            alert("Could not update profile.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setIsEditing(false);
        setSelectedFile(null);
        setPreviewUrl(null);
        api.get('/auth/me').then(res => {
            setName(res.data.name || '');
            setAvatarUrl(res.data.profile_picture_url || null);
            setprefferedCurrency(res.data.preffered_currency || 'USD');
        });
    };

    if (isLoading || (isAuthenticated && profileLoading)) {
        return (
            <div className="flex justify-center py-10">
                <p className="text-sm font-bold text-gray-400">Loading profile...</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="text-5xl">🔒</div>
                <h2 className="text-xl font-black text-gray-800">Sign in to view your profile</h2>
                <p className="text-sm text-gray-500 text-center">
                    Manage your account, ratings, and transaction history.
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
        <div className="min-h-screen bg-[#faf8f5] pb-20">

            {/* cover + avatar */}
            <div className="relative">
                <div className="h-32 bg-[#deebd8]" />

                {/* edit / save / cancel — top right */}
                <div className="absolute top-4 right-4 flex gap-2 z-20">
                    {!isEditing ? (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/60 text-CropLink-primary text-xs font-bold bg-white/80 backdrop-blur-sm shadow-sm hover:bg-white transition-colors"
                        >
                            <Edit2 className="w-3.5 h-3.5" />
                            Edit
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-CropLink-primary text-white text-xs font-bold shadow-sm hover:scale-105 transition-transform disabled:opacity-50"
                            >
                                <Check className="w-3.5 h-3.5" />
                                Save
                            </button>
                            <button
                                onClick={handleCancel}
                                disabled={isSaving}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500 text-white text-xs font-bold shadow-sm hover:scale-105 transition-transform disabled:opacity-50"
                            >
                                <X className="w-3.5 h-3.5" />
                                Cancel
                            </button>
                        </>
                    )}
                </div>

                {/* avatar */}
                <div className="absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-1/2 z-10">
                    <div className="relative">
                        <div className="size-24 rounded-full overflow-hidden border-4 border-white ring-4 ring-CropLink-primary shadow-lg">
                            {previewUrl || avatarUrl ? (
                                <img src={previewUrl || avatarUrl || ''} className="w-full h-full object-cover" alt="Profile" />
                            ) : (
                                <div className="w-full h-full bg-gray-100 flex items-center justify-center text-gray-300">
                                    <User className="w-10 h-10" />
                                </div>
                            )}
                            {isEditing && (
                                <div
                                    className="absolute inset-0 rounded-full bg-black/50 backdrop-blur-[2px] flex flex-col items-center justify-center cursor-pointer hover:bg-black/60 transition-colors"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Camera className="text-white w-5 h-5 mb-0.5" />
                                    <span className="text-[9px] text-white/90 font-medium">Update</span>
                                </div>
                            )}
                        </div>

                        {isEditing && (previewUrl || avatarUrl) && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (selectedFile) {
                                        setSelectedFile(null);
                                        setPreviewUrl(null);
                                        if (fileInputRef.current) fileInputRef.current.value = '';
                                    } else {
                                        setAvatarUrl(null);
                                    }
                                }}
                                className="absolute top-0 right-0 bg-gray-800 text-white p-1 rounded-full shadow-md hover:scale-110 transition-transform z-20 border-2 border-white"
                            >
                                <X className="w-2.5 h-2.5" />
                            </button>
                        )}
                        <input ref={fileInputRef} type="file" accept="image/png, image/jpeg" className="sr-only" onChange={handleFileChange} />
                    </div>
                </div>
            </div>

            {/* details */}
            <div className="flex flex-col items-center pt-16 px-6 gap-1">
                <div className="flex items-center gap-1 text-CropLink-primary">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-black uppercase tracking-wide">
                        {user?.role || 'Unknown'}
                    </span>
                </div>

                {isEditing ? (
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="text-2xl font-black text-gray-800 text-center bg-gray-50 border border-gray-200 rounded-xl px-4 py-1.5 outline-none focus:border-CropLink-primary transition-colors w-full max-w-xs mt-1"
                        placeholder="Your name"
                    />
                ) : (
                    <h1 className="text-2xl font-black text-gray-800 text-center">{name || 'Unnamed User'}</h1>
                )}

                <p className="text-xs text-gray-400 font-medium">{user?.email || 'N/A'}</p>
            </div>

            {/* stats card */}
            {/* currently hardcoded */}
            <div className="mx-5 mt-5 bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-4 flex items-center justify-around">
                <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Listings</span>
                    <span className="text-xl font-black text-gray-800">{numListings}</span>
                </div>

                <div className="w-px h-8 bg-gray-100" />

                <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Reviews</span>
                    <span className="text-xl font-black text-gray-800">0</span>
                </div>

                <div className="w-px h-8 bg-gray-100" />

                <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Trust Score</span>
                    <span className="text-xl font-black text-amber-500">★ 5.0</span>
                </div>
            </div>

            {/* currency */}
            <div className="mx-5 mt-3 bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Preferred Currency</label>
                {isEditing ? (
                    <div className="relative">
                        <select
                            value={prefferedCurrency}
                            onChange={(e) => setprefferedCurrency(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm font-bold rounded-xl p-2.5 outline-none focus:border-CropLink-primary transition-colors appearance-none pr-10"
                        >
                            <option value="USD">USD</option>
                            <option value="EUR">EUR</option>
                            <option value="THB">BAHT (THB)</option>
                            <option value="IDR">IDR</option>
                            <option value="MMK">MMK</option>
                            <option value="LAK">LAK</option>
                            <option value="PHP">PHP</option>
                        </select>
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-500">
                            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M5 7.5L10 12.5L15 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </span>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <Banknote className="w-4 h-4 text-gray-400 shrink-0" />
                        <span className="inline-flex px-2.5 py-0.5 text-[10px] font-black rounded-full bg-green-50 text-green-700">
                            {prefferedCurrency}
                        </span>
                    </div>
                )}
            </div>

            {/* logout */}
            <button
                onClick={handleLogout}
                className="w-[calc(100%-40px)] mx-auto mt-4 flex items-center justify-center gap-2 border-2 border-red-500/20 text-red-500 hover:bg-red-50 font-bold text-sm py-3.5 px-4 rounded-xl bg-white transition-colors active:scale-[0.98]"
            >
                <LogOut className="w-4 h-4" />
                Log Out
            </button>
        </div>
    );
}
