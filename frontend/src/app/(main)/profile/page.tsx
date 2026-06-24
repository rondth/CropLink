'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop, Crop, PixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';
import { Camera, Edit2, LogOut, Check, X, User, Banknote, CheckCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import ReviewCard from '@/components/marketplace/ReviewCard';

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
    const [reviews, setReviews] = useState<any[]>([]);
    const [reviewsLoading, setReviewsLoading] = useState(true);
    const [cropModalOpen, setCropModalOpen] = useState(false);
    const [rawImageSrc, setRawImageSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState<Crop>();
    const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
    const imgRef = useRef<HTMLImageElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [bio, setBio] = useState('');

    useEffect(() => {
        if (isAuthenticated && user) {
            api.get('/auth/me').then(res => {
                setName(res.data.name || '');
                setAvatarUrl(res.data.profile_picture_url || null);
                setprefferedCurrency(res.data.preffered_currency || 'USD');
                setBio(res.data.bio || '');
                setNumListings(res.data.num_listings || 0);
                setProfileLoading(false);
            }).catch(() => {
                setName(user.name || '');
                setprefferedCurrency(user.preffered_currency || 'USD');
                setProfileLoading(false);
            });
        }
    }, [isAuthenticated, user]);

    useEffect(() => {
        if (!isAuthenticated || !user) return;
        const userId = (user as any)?.user_id || (user as any)?.id;
        if (!userId) return;

        const endpoint = user.role === 'seller'
            ? `/reviews/seller/${userId}`
            : `/reviews/buyer/${userId}`;

        api.get(endpoint)
            .then(res => setReviews(res.data))
            .catch(() => {})
            .finally(() => setReviewsLoading(false));
    }, [isAuthenticated, user]);

    const avgRating = reviews.length
        ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(2)
        : null;

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
        const reader = new FileReader();
        reader.onload = () => {
            setRawImageSrc(reader.result as string);
            setCropModalOpen(true);
        };
        reader.readAsDataURL(file);
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

    const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
        const { width, height } = e.currentTarget;
        const initialCrop = centerCrop(
            makeAspectCrop({ unit: '%', width: 80 }, 1, width, height),
            width, height
        );
        setCrop(initialCrop);
    };

    const getCroppedFile = useCallback((): Promise<File> => {
        return new Promise((resolve, reject) => {
            const image = imgRef.current;
            const canvas = canvasRef.current;
            if (!image || !canvas || !completedCrop) return reject('Missing refs');

            const scaleX = image.naturalWidth / image.width;
            const scaleY = image.naturalHeight / image.height;
            const size = 400; // output size in px
            canvas.width = size;
            canvas.height = size;

            const ctx = canvas.getContext('2d');
            if (!ctx) return reject('No canvas context');

            // white background (handles transparent PNGs)
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, size, size);

            ctx.drawImage(
                image,
                completedCrop.x * scaleX,
                completedCrop.y * scaleY,
                completedCrop.width * scaleX,
                completedCrop.height * scaleY,
                0, 0, size, size
            );

            canvas.toBlob(blob => {
                if (!blob) return reject('Canvas empty');
                resolve(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }));
            }, 'image/jpeg', 0.92);
        });
    }, [completedCrop]);

    const handleCropConfirm = async () => {
        try {
            const croppedFile = await getCroppedFile();
            setSelectedFile(croppedFile);
            setPreviewUrl(URL.createObjectURL(croppedFile));
            setCropModalOpen(false);
            setRawImageSrc(null);
        } catch (err) {
            console.error('Crop failed:', err);
        }
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

            await api.patch('/auth/me', { name, profile_picture_url: finalAvatarUrl, preffered_currency: prefferedCurrency, bio });

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
            setBio(res.data.bio || '');
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
                        <div className="size-24 rounded-full overflow-hidden ring-4 ring-CropLink-primary shadow-lg">
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
            <div className="mx-5 mt-5 bg-white rounded-2xl shadow-sm border border-gray-100 px-4 py-4 flex items-center justify-around">
                <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Listings</span>
                    <span className="text-xl font-black text-gray-800">{numListings}</span>
                </div>

                <div className="w-px h-8 bg-gray-100" />

                <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Reviews</span>
                    <span className="text-xl font-black text-gray-800">
                        {reviewsLoading ? '—' : reviews.length}
                    </span>
                </div>

                <div className="w-px h-8 bg-gray-100" />

                <div className="flex flex-col items-center gap-0.5">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Trust Score</span>
                    <span className="text-xl font-black text-amber-500">
                        {reviewsLoading ? '—' : avgRating ? `★ ${avgRating}` : '★ —'}
                    </span>
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

            {/* bio */}
            <div className="mx-5 mt-3 bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">
                    About
                </label>
                {isEditing ? (
                    <textarea
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        rows={3}
                        maxLength={300}
                        placeholder="Tell buyers a bit about yourself or your farm..."
                        className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl p-2.5 outline-none focus:border-CropLink-primary transition-colors resize-none"
                    />
                ) : (
                    <p className="text-sm text-gray-700 leading-relaxed">
                        {bio || <span className="text-gray-400 italic">No bio yet.</span>}
                    </p>
                )}
            </div>

            {/* reviews section */}
            <div className="mx-5 mt-3 bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-black text-gray-800">My Reviews</h2>
                    {avgRating && (
                        <div className="flex items-center gap-1">
                            <span className="text-amber-400 text-sm">★</span>
                            <span className="text-sm font-black text-gray-800">{avgRating}</span>
                            <span className="text-xs text-gray-400">({reviews.length})</span>
                        </div>
                    )}
                </div>

                {reviewsLoading ? (
                    <div className="flex justify-center py-6">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-CropLink-primary" />
                    </div>
                ) : reviews.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">No reviews yet.</p>
                ) : (
                    <>
                        <div className="flex flex-col gap-2">
                            {reviews.slice(0, 3).map(review => (
                                <ReviewCard
                                    key={review.id}
                                    reviewerId={review.reviewer_id}
                                    reviewerName={review.reviewer?.name || 'Anonymous'}
                                    reviewerAvatar={review.reviewer?.profile_picture_url}
                                    rating={review.rating}
                                    content={review.content}
                                    createdAt={review.created_at}
                                />
                            ))}
                        </div>

                        {reviews.length > 3 && (
                            <button
                                onClick={() => router.push('/profile/reviews')}
                                className="w-full mt-3 py-2.5 text-xs font-bold text-CropLink-primary border border-CropLink-primary/20 rounded-xl bg-CropLink-primary/5 active:scale-[0.98] transition-all"
                            >
                                View all {reviews.length} reviews
                            </button>
                        )}
                    </>
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

            {/* crop modal */}
            {cropModalOpen && rawImageSrc && (
                <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center p-4">
                    <div className="bg-white rounded-2xl overflow-hidden w-full max-w-sm">
                        <div className="p-4 border-b border-gray-100">
                            <h3 className="text-sm font-black text-gray-800 text-center">Crop your photo</h3>
                            <p className="text-xs text-gray-400 text-center mt-0.5">Drag to reposition</p>
                        </div>

                        <div className="p-4 flex items-center justify-center bg-gray-50">
                            <ReactCrop
                                crop={crop}
                                onChange={c => setCrop(c)}
                                onComplete={c => setCompletedCrop(c)}
                                aspect={1}
                                circularCrop
                            >
                                <img
                                    ref={imgRef}
                                    src={rawImageSrc}
                                    onLoad={onImageLoad}
                                    className="max-h-72 max-w-full object-contain"
                                    alt="Crop preview"
                                />
                            </ReactCrop>
                        </div>

                        {/* hidden canvas used to render the crop */}
                        <canvas ref={canvasRef} className="hidden" />

                        <div className="p-4 flex gap-3">
                            <button
                                onClick={() => { setCropModalOpen(false); setRawImageSrc(null); }}
                                className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-bold text-gray-600 active:scale-95 transition-transform"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCropConfirm}
                                className="flex-1 py-3 rounded-xl bg-CropLink-primary text-white text-sm font-bold active:scale-95 transition-transform"
                            >
                                Use Photo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}