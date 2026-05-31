'use client';
import Link from 'next/link';
import Image from 'next/image';

export default function Header() {

return (
    <div className="bg-CropLink-primary px-4 pb-1 shrink-0 select-none pt-[calc(0.75rem+env(safe-area-inset-top))]">

        <div className="flex items-center gap-2 mb-2.5 py-1.5 ">
            <div className="text-white text-lg font-black tracking-tighter flex items-center gap-0.5">
                <Image src="/logo.png" alt="CropLink Logo" width={24} height={24} className="w-6 h-6 object-contain" />
                <div className="relative">
                    <p>CropLink</p>
                    <div className="absolute bottom-[7px] -right-2.5 w-1.5 h-1.5 bg-CropLink-primaryLight rounded-full" />
                </div>
            </div>

            <div className="flex-1" />
            
            <div className="flex gap-1">
                <button className="bg-white/15 border-none rounded-lg w-8 h-8 flex items-center justify-center relative text-white">
                    <Image src="/bell.png" alt="Bell Icon" width={18} height={18} />
                    <div className="absolute -top-0.5 -right-0.5 bg-CropLink-accentRed text-white rounded-full w-3.5 h-3.5 text-[9px] font-extrabold flex items-center justify-center">
                        3
                    </div>
                </button>
                
                <Link href="/orders" key="orders" className="bg-white/15 border-none rounded-lg w-8 h-8 flex items-center justify-center relative text-white">
                    <Image src="/shopping-cart.png" alt="Cart Icon" width={18} height={18} />
                    <div className="absolute -top-0.5 -right-0.5 bg-CropLink-accentRed text-white rounded-full w-3.5 h-3.5 text-[9px] font-extrabold flex items-center justify-center">
                        2
                    </div>
                </Link>
            </div>
        </div>

    </div>
);
}