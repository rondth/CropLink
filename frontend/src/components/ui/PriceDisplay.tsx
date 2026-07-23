import React from 'react';
import { getPriceDisplayParts, PriceDisplayListing } from '@/lib/priceDisplay';

export default function PriceDisplay({
    listing,
    preferredCurrency,
    unit,
    primaryClassName = 'text-sm font-black text-CropLink-primary',
    unitClassName = 'text-[11px] text-gray-600 font-medium',
    secondaryClassName = 'text-[10px] text-gray-400 font-semibold mt-0.5',
}: {
    listing: PriceDisplayListing;
    preferredCurrency?: string | null;
    unit?: string;
    primaryClassName?: string;
    unitClassName?: string;
    secondaryClassName?: string;
}) {
    const parts = getPriceDisplayParts(listing, preferredCurrency);
    if (!parts) return null;

    return (
        <div>
            <div className={primaryClassName}>
                {parts.primary.currency} {Intl.NumberFormat('en-US').format(parts.primary.amount)}
                {unit && <span className={unitClassName}> / {unit}</span>}
            </div>
            {parts.secondary && (
                <div className={secondaryClassName}>
                    {parts.secondary.currency} {Intl.NumberFormat('en-US').format(parts.secondary.amount)} original
                </div>
            )}
        </div>
    );
}
