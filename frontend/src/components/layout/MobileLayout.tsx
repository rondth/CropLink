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
        <div className="bg-gray-100 min-h-screen flex justify-center items-center md:py-5">
            <div className="bg-[#faf8f5] flex flex-col relative overflow-hidden w-full h-[100dvh]
                            md:w-[360px] md:h-[740px] md:rounded-[40px] md:border-8 md:border-CropLink-dark md:shadow-2xl">
                {showChrome && <Header />}
                    <div className="flex-1 overflow-y-auto no-scrollbar overscroll-none">
                        {children}
                    </div>
                {showChrome && <Navbar />}
            </div>
        </div>
    );
}