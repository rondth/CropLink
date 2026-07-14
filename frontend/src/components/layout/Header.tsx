'use client';
import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { useMessageNotifications } from '@/lib/useMessageNotifications';
import { useUnreadMessageCount } from '@/lib/UnreadMessageCountContext';

export default function Header() {
    const router = useRouter();
    const { user } = useAuth();
    const { notifications, removeConversation } = useMessageNotifications(user?.user_id ?? null);
    const { unreadCount } = useUnreadMessageCount();
    const [isBellOpen, setIsBellOpen] = useState(false);

    const openConversation = (conversationId: string) => {
        removeConversation(conversationId);
        setIsBellOpen(false);
        router.push(`/messages/${conversationId}`);
    };

return (
    <div className="bg-CropLink-primary px-4 pb-1 shrink-0 select-none pt-[calc(0.75rem+env(safe-area-inset-top))]">

        <div className="flex items-center gap-2 mb-2.5 py-1.5 ">
            <div className="text-white text-lg font-black tracking-tighter flex items-center gap-0.5">
                <Image src="/logo.png" alt="CropLink Logo" width={24} height={24} className="w-6 h-6 object-contain" />
                <div className="relative">
                    <p>CropLink</p>
                </div>
            </div>

            <div className="flex-1" />

            <div className="flex gap-1">
                <div className="relative">
                    <button
                        onClick={() => setIsBellOpen((prev) => !prev)}
                        className="bg-white/15 border-none rounded-lg w-8 h-8 flex items-center justify-center relative text-white"
                    >
                        <Image src="/bell.png" alt="Bell Icon" width={18} height={18} />
                        {unreadCount > 0 && (
                            <div className="absolute -top-0.5 -right-0.5 bg-CropLink-accentRed text-white rounded-full w-3.5 h-3.5 text-[9px] font-extrabold flex items-center justify-center">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </div>
                        )}
                    </button>

                    {isBellOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsBellOpen(false)} />
                            <div className="absolute right-0 top-10 z-50 w-72 max-h-96 overflow-y-auto bg-white rounded-xl shadow-2xl border border-gray-100 text-left select-text">
                                {notifications.length === 0 ? (
                                    <p className="px-4 py-6 text-sm text-gray-400 text-center">No new messages.</p>
                                ) : (
                                    <div className="flex flex-col divide-y divide-gray-100">
                                        {notifications.map((n) => (
                                            <button
                                                key={n.conversation_id}
                                                onClick={() => openConversation(n.conversation_id)}
                                                className="flex items-center gap-3 px-4 py-3 text-left active:bg-gray-50 transition-colors"
                                            >
                                                <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-100 shrink-0">
                                                    <img
                                                        src={n.other_participant?.profile_picture_url || '/profile.png'}
                                                        alt={n.other_participant?.name || 'User'}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-bold text-gray-900 truncate">
                                                        {n.other_participant?.name || 'Unknown user'}
                                                    </p>
                                                    <p className="text-xs text-gray-500 truncate">{n.preview}</p>
                                                </div>
                                                <span className="shrink-0 bg-CropLink-primary text-white text-[10px] font-black rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center">
                                                    {n.unread_count > 9 ? '9+' : n.unread_count}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                <Link href="/orders" key="orders" className="bg-white/15 border-none rounded-lg w-8 h-8 flex items-center justify-center relative text-white">
                    <Image src="/shopping-cart.png" alt="Cart Icon" width={18} height={18} />
                </Link>
            </div>
        </div>

    </div>
);
}