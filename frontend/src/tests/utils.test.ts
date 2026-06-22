import { describe, it, expect } from 'vitest';
import { getCurrencySymbol, calcSubtotal, filterProducts, PLATFORM_FEE_RATE } from '../lib/utils';

function calculateTotal(price: number, quantity: number): number {
    const sub = price * quantity;
    const fee = Math.round(sub * PLATFORM_FEE_RATE * 100) / 100;
    return Math.round((sub + fee) * 100) / 100;
}

describe('getCurrencySymbol', () => {
    it('returns $ for USD', () => expect(getCurrencySymbol('USD')).toBe('$'));
    it('returns $ as default', () => expect(getCurrencySymbol()).toBe('$'));
    it('returns € for EUR', () => expect(getCurrencySymbol('EUR')).toBe('€'));
    it('returns Rp  for IDR', () => expect(getCurrencySymbol('IDR')).toBe('Rp '));
    it('returns ฿ for THB', () => expect(getCurrencySymbol('THB')).toBe('฿'));
    it('returns ฿ for BAHT', () => expect(getCurrencySymbol('BAHT')).toBe('฿'));
    it('returns S$ for SGD', () => expect(getCurrencySymbol('SGD')).toBe('S$'));
    it('returns K for MMK', () => expect(getCurrencySymbol('MMK')).toBe('K'));
    it('returns ₭ for LAK', () => expect(getCurrencySymbol('LAK')).toBe('₭'));
    it('returns ₱ for PHP', () => expect(getCurrencySymbol('PHP')).toBe('₱'));
    it('is case-insensitive', () => expect(getCurrencySymbol('eur')).toBe('€'));
});

describe('calcSubtotal', () => {
    it('multiplies quantity by price', () => {
        expect(calcSubtotal({ quantity: '5', listing: { price: '12.5' } })).toBe(62.5);
    });

    it('returns 0 when listing is null', () => {
        expect(calcSubtotal({ quantity: '146', listing: null })).toBe(0);
    });

    it('returns 0 when quantity is missing', () => {
        expect(calcSubtotal({ listing: { price: '10' } })).toBe(0);
    });

    it('handles float strings from Supabase', () => {
        expect(calcSubtotal({ quantity: '146.0', listing: { price: '1.5' } })).toBe(219);
    });
});

describe('calculateTotal', () => {
    it('adds 2% platform fee', () => expect(calculateTotal(100, 1)).toBe(102));
    it('rounds to 2 decimal places', () => expect(calculateTotal(12.5, 5)).toBe(63.75));
    it('zero quantity gives zero total', () => expect(calculateTotal(10, 0)).toBe(0));
});

describe('filterProducts', () => {
    const products = [
        { category: 'Vegetables', crop_name: 'Tomato' },
        { category: 'Fruits', crop_name: 'Mango' },
        { category: 'Vegetables', crop_name: 'Carrot' },
    ];

    it('returns all when category is All', () => {
        expect(filterProducts(products, 'All', '')).toHaveLength(3);
    });

    it('filters by category', () => {
        const result = filterProducts(products, 'Vegetables', '');
        expect(result).toHaveLength(2);
        expect(result.every(p => p.category === 'Vegetables')).toBe(true);
    });

    it('filters by search', () => {
        const result = filterProducts(products, 'All', 'man');
        expect(result).toHaveLength(1);
        expect(result[0].crop_name).toBe('Mango');
    });

    it('filters by category and search together', () => {
        const result = filterProducts(products, 'Vegetables', 'car');
        expect(result).toHaveLength(1);
        expect(result[0].crop_name).toBe('Carrot');
    });

    it('returns empty when nothing matches', () => {
        expect(filterProducts(products, 'Grains', '')).toHaveLength(0);
    });
});
