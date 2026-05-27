'use client';
import React from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useRouter } from 'next/navigation';

export default function Profile() {
    const { isAuthenticated, isLoading, user, logout } = useAuth();
    const router = useRouter();

    const handleLogout = async () => {
        router.push('/login');
        await logout();
    }

    if (isLoading) {
        return (
            <div className="flex justify-center py-10">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-CropLink-primary"></div>
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
        <div className="p-6">
            <h1 className="text-2xl font-black text-gray-800 mb-2">Profile</h1>
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mt-4">
                <p className="text-gray-500 text-sm text-left">Name: {user?.name}</p>
                <p className="text-gray-500 text-sm text-left">Email: {user?.email}</p>
                <p className="text-gray-500 text-sm text-left">Role: {user?.role}</p>
            </div>
            <button
                onClick={handleLogout}
                className="w-full max-w-xs border border-red-400 text-red-400 font-bold py-3 rounded-xl mt-4"
            >
                Log Out
            </button>
        </div>
    );
}
