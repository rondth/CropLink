'use client';
import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { useRole } from '@/components/layout/RoleContext';
import { useUnreadMessageCount } from '@/lib/UnreadMessageCountContext';

export default function Navbar() {
const { role } = useRole();
const pathname = usePathname();
const { unreadCount } = useUnreadMessageCount();

const tabsBuyer = [
    { id: 'home', label: 'Home', iconName: 'home', href: '/' },
    { id: 'orders', label: 'Orders', iconName: 'orders', href: '/orders' },
    { id: 'messages', label: 'Messages', iconName: 'messages', href: '/messages' },
    { id: 'profile', label: 'Profile', iconName: 'profile', href: '/profile' }
];

const tabsSeller = [
    { id: 'home', label: 'Home', iconName: 'home', href: '/' },
    { id: 'crops', label: 'List Crops', iconName: 'crops', href: '/crops' },
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

            <span className="text-xl relative inline-flex">
                {tab.iconName === 'messages' ? (
                    <>
                        <MessageCircle className={`w-6 h-6 ${isActive ? '' : 'text-black'}`} strokeWidth={isActive ? 1.5 : 1.5} />
                        {unreadCount > 0 && (
                            <span
                                role="status"
                                aria-label={`${unreadCount} unread message${unreadCount === 1 ? '' : 's'}`}
                                className="absolute -top-1 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-CropLink-primary text-white text-[9px] font-extrabold leading-none flex items-center justify-center"
                            >
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </>
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