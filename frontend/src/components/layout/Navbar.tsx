'use client';
import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { useRole } from '@/components/layout/RoleContext';

export default function Navbar() {
const { role } = useRole();
const pathname = usePathname();

const tabsBuyer = [
    { id: 'home', label: 'Home', iconName: 'home', href: '/' },
    { id: 'orders', label: 'Orders', iconName: 'orders', href: '/orders' },
    { id: 'messages', label: 'Messages', iconName: 'messages', href: '/messages' },
    { id: 'profile', label: 'Profile', iconName: 'profile', href: '/profile' }
];

const tabsSeller = [
    { id: 'home', label: 'Home', iconName: 'home', href: '/' },
    { id: 'crops', label: 'Crops', iconName: 'crops', href: '/crops' },
    { id: 'prices', label: 'Prices', iconName: 'price', href: '/prices' },
    { id: 'orders', label: 'Orders', iconName: 'orders', href: '/orders' },
    { id: 'messages', label: 'Messages', iconName: 'messages', href: '/messages' },
    { id: 'profile', label: 'Profile', iconName: 'profile', href: '/profile' }
];

const tabs = role === 'seller' ? tabsSeller : tabsBuyer;

return (
    <nav className="flex bg-white border-t border-gray-200 shrink-0 select-none pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
    {tabs.map(tab => {
        const isActive = pathname === tab.href;
        return (
        <Link href={tab.href} key={tab.id} className={`flex-1 flex flex-col items-center gap-0.5 py-2 pb-2.5 cursor-pointer ${isActive ? 'text-[#2d5a27]' : 'text-gray-400'}`}>

            <span className="text-xl">
                {tab.iconName === 'messages' ? (
                    <MessageCircle className="w-6 h-6" strokeWidth={isActive ? 2.5 : 2} />
                ) : (
                    <Image src={`/${tab.iconName}${isActive ? '-alt' : ''}.png`} alt={tab.label} width={24} height={24} />
                )}
            </span>
            <span className="text-[10px] font-bold">{tab.label}</span>
        
        </Link>
    )})}
    </nav>
);
}