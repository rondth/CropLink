'use client';
import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';

export default function SignupPage() {
    const router = useRouter();
    const { signup } = useAuth();

    const [role, setRole] = useState<'seller' | 'buyer'>('seller');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password.length < 8) {
            setError('Password must be at least 8 characters.');
            return;
        }

        setLoading(true);

        try {
            await signup({
                email,
                password,
                name: `${firstName} ${lastName}`,
                role,
            });
            router.push('/dashboard');
        } catch (err: any) {
            setError(err?.response?.data?.detail || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-full bg-[#faf8f5] flex flex-col justify-center px-5 py-6">
            {/* Logo */}
            <div className="flex flex-col items-center gap-1.5 mb-6">
                <div className="flex items-center gap-2.5">
                    <Image src="/logo-green.png" alt="CropLink Logo" width={28} height={28} />
                    <div className="relative">
                        <span className="text-3xl font-black text-[#2d5a3d] tracking-tight">CropLink</span>
                        <span className="absolute bottom-[7px] -right-3 w-1.5 h-1.5 bg-[#7ecf94] rounded-full" />
                    </div>
                </div>
                <p className="text-xs text-gray-400 text-center">From the field, to your feed.</p>
            </div>

            {/* Role selector */}
            <div className="grid grid-cols-2 gap-3 mb-4">
                {(['seller', 'buyer'] as const).map((r) => (
                    <button
                        key={r}
                        type="button"
                        onClick={() => setRole(r)}
                        className={`rounded-2xl p-3 text-center border-2 transition-all ${
                            role === r ? 'border-[#4a7c59] bg-[#edf5ef]' : 'border-gray-200 bg-white'
                        }`}
                    >
                        <Image src={r === 'seller' ? '/seller-icon.png' : '/buyer-icon.png'} alt={r} width={32} height={32} className="mx-auto mb-1" />
                        <div className={`text-xs font-bold ${role === r ? 'text-[#2d5a3d]' : 'text-gray-800'}`}>
                            {r === 'seller' ? 'Seller' : 'Buyer'}
                        </div>
                        <div className="text-[9px] text-gray-400 mt-0.5">
                            {r === 'seller' ? 'List & sell products' : 'Browse & source goods'}
                        </div>
                    </button>
                ))}
            </div>

            {/* Form */}
            <form 
                onSubmit={handleSignup}
                className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-3"
            >
                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-xl px-3 py-2">
                        {error}
                    </div>
                )}

                <div className="flex gap-3">
                    <div className="flex-1">
                        <label htmlFor="firstName" className="block text-[9px] font-bold text-gray-500 uppercase tracking-wide mb-1">First name *</label>
                        <input 
                            type="text" 
                            id="firstName" 
                            placeholder="Shane"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            required
                            className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl block p-2.5 outline-none transition-colors" 
                        />
                    </div>
                    <div className="flex-1">
                        <label htmlFor="lastName" className="block text-[9px] font-bold text-gray-500 uppercase tracking-wide mb-1">Last name *</label>
                        <input 
                            type="text" 
                            id="lastName" 
                            placeholder="Santoso"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            required
                            className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl block p-2.5 outline-none transition-colors" 
                        />
                    </div>
                </div>

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
                    <label htmlFor="password" className="block text-[9px] font-bold text-gray-500 uppercase tracking-wide mb-1">Password *</label>
                    <input 
                        type="password" 
                        id="password" 
                        placeholder="Min. 8 characters"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="w-full bg-gray-50 border border-gray-200 text-gray-800 text-sm rounded-xl block p-2.5 outline-none transition-colors" />
                </div>

                <div className="pt-2 mt-1 border-t border-gray-100">
                    <button 
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#4a7c59] text-white font-black text-sm py-3.5 px-4 rounded-xl hover:bg-[#3a6347] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Creating account...' : 'Create account'}
                    </button>
                </div>
            </form>

            <p className="text-center text-xs text-gray-400 mt-4">
                Already have an account?{' '}
                <a href="/login" className="text-[#4a7c59] font-bold">Log in</a>
            </p>
        </div>
    );
}
