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
        <div className="bg-gray-100 sm:min-h-screen sm:py-5 sm:flex sm:justify-center sm:items-center">
            <div className="bg-[#faf8f5] flex flex-col relative overflow-hidden w-full h-[100dvh]
                            sm:w-[360px] sm:h-[740px] sm:rounded-[40px] sm:border-8 sm:border-CropLink-dark sm:shadow-2xl">
                {showChrome && <Header />}
                    <div id="main-scroller" className="flex-1 overflow-y-auto no-scrollbar overscroll-none">
                        {children}
                    </div>
                {showChrome && <Navbar />}
            </div>
        </div>
    );
}