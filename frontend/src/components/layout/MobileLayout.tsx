'use client';

import React from 'react';
import Header from './Header';
import Navbar from './Navbar';

export default function MobileLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="bg-gray-100 min-h-screen py-5 flex justify-center items-center">
            <div className="bg-[#f0ece4] w-[360px] rounded-[40px] border-8 border-gainz-dark overflow-hidden h-[740px] flex flex-col relative shadow-2xl">
                <Header />
                
                <div className="flex-1 overflow-y-auto no-scrollbar">
                    {children}
                </div>

                <Navbar />
            </div>
        </div>
    );
}