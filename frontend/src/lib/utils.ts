export const PLATFORM_FEE_RATE = 0.02;

export function getCurrencySymbol(currency?: string): string {
    switch (currency?.toUpperCase()) {
        case 'EUR': return '€';
        case 'IDR': return 'Rp ';
        case 'BAHT':
        case 'THB': return '฿';
        case 'SGD': return 'S$';
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
