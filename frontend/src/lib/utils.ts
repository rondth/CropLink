import { getPriceDisplayParts, PriceDisplayListing } from './priceDisplay';

export const PLATFORM_FEE_RATE = 0.02;

export function getCurrencySymbol(currency?: string): string {
    switch (currency?.toUpperCase()) {
        case 'EUR': return '€';
        case 'IDR': return 'Rp ';
        case 'BAHT':
        case 'THB': return '฿';
        case 'SGD': return 'S$';
        case 'MMK': return 'K';
        case 'LAK': return '₭';
        case 'PHP': return '₱';
        case 'USD':
        default: return '$';
    }
}

export function calcSubtotal(t: { quantity?: string; listing?: { price?: string } | null }): number {
    return parseFloat(t.quantity ?? '0') * parseFloat(t.listing?.price ?? '0');
}

export function filterProducts(
    products: ({ category: string; crop_name: string } & PriceDisplayListing)[],
    selectedCategory: string,
    searchFilter: string,
    priceRange?: { min?: number; max?: number; preferredCurrency?: string | null }
) {
    return products.filter(p => {
        const categoryMatch = selectedCategory === 'All' || p.category === selectedCategory;
        const searchMatch = !searchFilter || p.crop_name.toLowerCase().includes(searchFilter.toLowerCase());

        let priceMatch = true;
        if (priceRange && (priceRange.min !== undefined || priceRange.max !== undefined)) {
            // Filter on the same amount/currency the card actually displays
            // (converted to the viewer's preferred currency when applicable),
            // not the listing's raw native-currency price.
            const displayedAmount = getPriceDisplayParts(p, priceRange.preferredCurrency)?.primary.amount ?? 0;
            priceMatch =
                (priceRange.min === undefined || displayedAmount >= priceRange.min) &&
                (priceRange.max === undefined || displayedAmount <= priceRange.max);
        }

        return categoryMatch && searchMatch && priceMatch;
    });
}

export function timeAgo(dateString: string): string {
    const then = new Date(dateString).getTime();
    const diffSeconds = Math.max(0, Math.floor((Date.now() - then) / 1000));

    if (diffSeconds < 60) return 'now';
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d`;
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 5) return `${diffWeeks}w`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `${diffMonths}mo`;
    return `${Math.floor(diffDays / 365)}y`;
}

export const MESSAGE_PREVIEW_LENGTH = 80;

export function truncatePreview(content: string, maxLength: number = MESSAGE_PREVIEW_LENGTH): string {
    return content.slice(0, maxLength);
}

export function isSameCalendarDay(a: string, b: string): boolean {
    const da = new Date(a);
    const db = new Date(b);
    return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
}

export function formatDayDivider(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diffDays = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function formatAmount(n: number): { display: string; suffix: string } {
    if (Math.abs(n) >= 1e9) return { display: (n / 1e9).toFixed(1).replace(/\.0$/, ''), suffix: 'B' };
    if (Math.abs(n) >= 1e6) return { display: (n / 1e6).toFixed(1).replace(/\.0$/, ''), suffix: 'M' };
    if (Math.abs(n) >= 1e3) return { display: (n / 1e3).toFixed(1).replace(/\.0$/, ''), suffix: 'K' };
    return { display: Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n), suffix: '' };
}
