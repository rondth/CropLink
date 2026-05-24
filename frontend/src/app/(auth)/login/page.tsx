'use client';
import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

export default function Login() {
    const router = useRouter();
    const { login } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            await login({ email, password });
            router.push('/');
        } catch (err: any) {
            setError(err?.response?.data?.detail || 'Invalid email or password.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-full bg-[#faf8f5] flex flex-col justify-center px-5 py-6">
            {/* Logo */}
            <div className="flex flex-col items-center gap-1.5 mb-8">
                <div className="flex items-center gap-2.5">
                    <Image src="/logo-green.png" alt="CropLink Logo" width={28} height={28} />
                    <div className="relative">
                        <span className="text-3xl font-black text-[#2d5a3d] tracking-tight">CropLink</span>
                        <span className="absolute bottom-[7px] -right-3 w-1.5 h-1.5 bg-[#7ecf94] rounded-full" />
                    </div>
                </div>
                <p className="text-xs text-gray-400 text-center">From the field, to your feed.</p>
            </div>

            {/* Form */}
            <form 
                onSubmit={handleLogin}
                className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-3"
            >
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl px-3 py-2">
                        {error}
                    </div>
                )}

                <div>
                    <label htmlFor="email" className="block text-[9px] font-bold text-gray-500 uppercase tracking-wide mb-1">Email *</label>
                    <input 
                        type="email" 
                        id="email" 
                        placeholder="you@example.com"
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl block p-2.5 outline-none transition-colors" 
                    />
                </div>

                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label htmlFor="password" className="text-[9px] font-bold text-gray-500 uppercase tracking-wide">Password *</label>
                        <button type="button" className="text-[10px] text-[#4a7c59] font-bold">Forgot password?</button>
                    </div>
                    <input 
                        type="password" 
                        id="password" 
                        placeholder="Your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl block p-2.5 outline-none transition-colors" 
                    />
                </div>

                <div className="pt-2 mt-1 border-t border-gray-100 flex flex-col gap-3">
                    <button 
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#4a7c59] text-white font-black text-sm py-3.5 px-4 rounded-xl hover:bg-[#3a6347] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Signing in...' : 'Sign in'}
                    </button>

                    <div className="flex items-center gap-2">
                        <div className="flex-1 h-px bg-gray-100" />
                        <span className="text-[10px] text-gray-400">or</span>
                        <div className="flex-1 h-px bg-gray-100" />
                    </div>

                    <a href="/signup">
                        <button 
                            type="button"
                            className="w-full bg-white border-2 border-[#4a7c59] text-[#4a7c59] font-black text-sm py-3.5 px-4 rounded-xl hover:bg-[#edf5ef] active:scale-[0.98] transition-all"
                        >
                            Create a free account
                        </button>
                    </a>
                </div>
            </form>
        </div>
    );
}