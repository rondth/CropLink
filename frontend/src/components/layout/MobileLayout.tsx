'use client';
import React from 'react';
import Header from './Header';
import Navbar from './Navbar';

export default function MobileLayout({ 
    children, 
    showChrome = true 
}: { 
    children: React.ReactNode;
    showChrome?: boolean;
}) {
    return (
        <div className="bg-gray-100 min-h-screen flex justify-center items-center sm:py-5">
            <div className="bg-[#faf8f5] flex flex-col relative overflow-hidden w-full h-screen
                            sm:w-[360px] sm:h-[740px] sm:rounded-[40px] sm:border-8 sm:border-CropLink-dark sm:shadow-2xl">
                {showChrome && <Header />}
                    <div className="flex-1 overflow-y-auto no-scrollbar">
                        {children}
                    </div>
                {showChrome && <Navbar />}
            </div>
        </div>
    );
}