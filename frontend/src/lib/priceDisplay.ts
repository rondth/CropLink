export interface PriceDisplayListing {
    price?: number | string | null;
    currency?: string | null;
    converted_price?: number | string | null;
    converted_currency?: string | null;
}

export interface PriceDisplayParts {
    primary: { amount: number; currency: string };
    secondary: { amount: number; currency: string } | null;
}

/**
 * Decides what to render for a listing's price: a single price, or a primary
 * (viewer's preferred currency) + secondary (seller's original currency) pair.
 * Pure so the decision logic can be unit tested without mounting a component.
 */
export function getPriceDisplayParts(
    listing: PriceDisplayListing,
    preferredCurrency?: string | null
): PriceDisplayParts | null {
    if (listing.price === null || listing.price === undefined) return null;
    const price = typeof listing.price === 'number' ? listing.price : parseFloat(listing.price);
    if (Number.isNaN(price)) return null;

    const currency = (listing.currency || 'USD').toUpperCase();

    const convertedPrice =
        listing.converted_price === null || listing.converted_price === undefined
            ? null
            : typeof listing.converted_price === 'number'
                ? listing.converted_price
                : parseFloat(listing.converted_price);
    const convertedCurrency = listing.converted_currency ? listing.converted_currency.toUpperCase() : null;

    const hasConversion =
        !!preferredCurrency &&
        convertedPrice !== null &&
        !Number.isNaN(convertedPrice) &&
        !!convertedCurrency &&
        convertedCurrency !== currency;

    if (!hasConversion) {
        return { primary: { amount: price, currency }, secondary: null };
    }

    return {
        primary: { amount: convertedPrice as number, currency: convertedCurrency as string },
        secondary: { amount: price, currency },
    };
}
