import { describe, it, expect } from 'vitest';
import { getPriceDisplayParts } from '../lib/priceDisplay';

describe('getPriceDisplayParts', () => {
    it('shows a single price when the viewer has no preferred currency (logged out)', () => {
        const parts = getPriceDisplayParts(
            { price: 50, currency: 'USD', converted_price: 200, converted_currency: 'EUR' },
            null
        );

        expect(parts).toEqual({ primary: { amount: 50, currency: 'USD' }, secondary: null });
    });

    it('shows a single price when preferred currency matches the listing currency', () => {
        const parts = getPriceDisplayParts({ price: 50, currency: 'USD' }, 'USD');

        expect(parts).toEqual({ primary: { amount: 50, currency: 'USD' }, secondary: null });
    });

    it('shows a single price when currencies match case-insensitively', () => {
        const parts = getPriceDisplayParts({ price: 50, currency: 'usd' }, 'USD');

        expect(parts?.secondary).toBeNull();
    });

    it('shows two prices when the preferred currency differs and a conversion is available', () => {
        const parts = getPriceDisplayParts(
            { price: 50, currency: 'USD', converted_price: 46, converted_currency: 'EUR' },
            'EUR'
        );

        expect(parts).toEqual({
            primary: { amount: 46, currency: 'EUR' },
            secondary: { amount: 50, currency: 'USD' },
        });
    });

    it('falls back to a single (original) price when no converted price was returned by the backend', () => {
        const parts = getPriceDisplayParts({ price: 50, currency: 'USD' }, 'EUR');

        expect(parts).toEqual({ primary: { amount: 50, currency: 'USD' }, secondary: null });
    });

    it('parses string price/converted_price values (as sent by some API responses)', () => {
        const parts = getPriceDisplayParts(
            { price: '50', currency: 'USD', converted_price: '46', converted_currency: 'EUR' },
            'EUR'
        );

        expect(parts).toEqual({
            primary: { amount: 46, currency: 'EUR' },
            secondary: { amount: 50, currency: 'USD' },
        });
    });

    it('returns null when there is no price at all', () => {
        expect(getPriceDisplayParts({ currency: 'USD' }, 'EUR')).toBeNull();
    });
});
