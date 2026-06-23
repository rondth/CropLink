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
    products: { category: string; crop_name: string }[],
    selectedCategory: string,
    searchFilter: string
) {
    return products.filter(p => {
        const categoryMatch = selectedCategory === 'All' || p.category === selectedCategory;
        const searchMatch = !searchFilter || p.crop_name.toLowerCase().includes(searchFilter.toLowerCase());
        return categoryMatch && searchMatch;
    });
}

export function formatAmount(n: number): { display: string; suffix: string } {
    if (Math.abs(n) >= 1e9) return { display: (n / 1e9).toFixed(1).replace(/\.0$/, ''), suffix: 'B' };
    if (Math.abs(n) >= 1e6) return { display: (n / 1e6).toFixed(1).replace(/\.0$/, ''), suffix: 'M' };
    if (Math.abs(n) >= 1e3) return { display: (n / 1e3).toFixed(1).replace(/\.0$/, ''), suffix: 'K' };
    return { display: Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n), suffix: '' };
}
