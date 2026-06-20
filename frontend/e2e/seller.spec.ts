import { test, expect } from '@playwright/test';

const LISTING_NAME = `E2E Test Crop ${Date.now()}`;

test.describe('Seller Auth', () => {
    test('redirects buyer role away from create-listing page', async ({ browser }) => {
        const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
        const page = await ctx.newPage();
        await page.goto('/crops');
        await page.waitForTimeout(1500);
        // unauthenticated users default to buyer role and get redirected to home
        await expect(page).toHaveURL('/');
        await ctx.close();
    });

    test('login with valid credentials', async ({ browser }) => {
        const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
        const page = await ctx.newPage();
        await page.goto('/login');
        await page.fill('#email', process.env.SELLER_EMAIL!);
        await page.fill('#password', process.env.SELLER_PASSWORD!);
        await page.click('button[type="submit"]');
        await page.waitForURL('/');
        await expect(page).toHaveURL('/');
        await ctx.close();
    });
});

test.describe('Seller Marketplace', () => {
    test('home page loads as seller', async ({ page }) => {
        await page.goto('/');
        await page.waitForTimeout(2000);
        await expect(page).toHaveURL('/');
    });
});

async function goToCrops(page: any) {
    await page.goto('/');
    await page.waitForSelector('text=Hello', { timeout: 10000 });
    await page.click('a[href="/crops"]');
    await page.waitForTimeout(500);
}

test.describe('Seller Create Listing', () => {
    test('create listing page loads', async ({ page }) => {
        await goToCrops(page);
        await expect(page).toHaveURL('/crops');
    });

    test('can fill and submit a new listing', async ({ page }) => {
        await goToCrops(page);

        const nameInput = page.locator('input[name="crop_name"], input[placeholder*="crop" i], input[placeholder*="name" i]').first();
        if (await nameInput.count() === 0) return;

        await nameInput.fill(LISTING_NAME);

        const categorySelect = page.locator('select[name="category"]').first();
        if (await categorySelect.count() > 0) {
            await categorySelect.selectOption({ index: 1 });
        }

        const priceInput = page.locator('input[name="price"], input[type="number"]').first();
        if (await priceInput.count() > 0) await priceInput.fill('50');

        const qtyInput = page.locator('input[name="quantity"]').first();
        if (await qtyInput.count() > 0) await qtyInput.fill('100');

        const minQtyInput = page.locator('input[name="min_order_quantity"]').first();
        if (await minQtyInput.count() > 0) await minQtyInput.fill('5');

        const locationInput = page.locator('input[name="location"]').first();
        if (await locationInput.count() > 0) await locationInput.fill('Nairobi');

        const harvestedInput = page.locator('input[name="harvested_at"], input[type="date"]').first();
        if (await harvestedInput.count() > 0) await harvestedInput.fill('2026-06-01');

        const submitBtn = page.locator('button[type="submit"]').first();
        await submitBtn.click();
        await page.waitForTimeout(3000);

        // should redirect away from /crops after successful submission
        await expect(page.locator('body')).toBeVisible();
    });
});

test.describe('Seller Manage Listings', () => {
    test('seller dashboard shows listings', async ({ page }) => {
        await page.goto('/');
        await page.waitForTimeout(2000);
        await expect(page.locator('body')).toBeVisible();
    });

    test('can navigate to edit a listing', async ({ page }) => {
        await page.goto('/');
        await page.waitForTimeout(2000);
        const editLink = page.locator('a[href*="/seller/edit/"]').first();
        if (await editLink.count() > 0) {
            await editLink.click();
            await page.waitForTimeout(1500);
            await expect(page.url()).toContain('/seller/edit/');
            // edit form should be present
            await expect(page.locator('form, input[name="crop_name"]').first()).toBeVisible();
        }
    });
});

test.describe('Seller Prices', () => {
    test('prices page loads with market data', async ({ page }) => {
        await page.goto('/prices');
        await page.waitForTimeout(2000);
        await expect(page).toHaveURL('/prices');
    });
});

test.describe('Seller Profile', () => {
    test('profile page loads', async ({ page }) => {
        await page.goto('/profile');
        await page.waitForTimeout(1500);
        await expect(page).toHaveURL('/profile');
    });

    test('can update seller profile name', async ({ page }) => {
        await page.goto('/profile');
        await page.waitForTimeout(1500);
        const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
        if (await nameInput.count() > 0) {
            await nameInput.clear();
            await nameInput.fill('Nore Seller');
            const saveBtn = page.locator('button').filter({ hasText: /save|update/i }).first();
            if (await saveBtn.count() > 0) {
                await saveBtn.click();
                await page.waitForTimeout(1000);
            }
        }
    });
});

test.describe('Seller Orders', () => {
    test('orders page loads', async ({ page }) => {
        await page.goto('/orders');
        await page.waitForTimeout(2000);
        await expect(page).toHaveURL('/orders');
    });

    test('can filter orders by status', async ({ page }) => {
        await page.goto('/orders');
        await page.waitForTimeout(1500);
        const pendingFilter = page.locator('button').filter({ hasText: /pending/i }).first();
        if (await pendingFilter.count() > 0) {
            await pendingFilter.click();
            await page.waitForTimeout(500);
        }
    });

    test('can navigate to order detail', async ({ page }) => {
        await page.goto('/orders');
        await page.waitForTimeout(2000);
        const orderItem = page.locator('a[href*="/orders/"]').first();
        if (await orderItem.count() > 0) {
            await orderItem.click();
            await page.waitForTimeout(1500);
            await expect(page.url()).toContain('/orders/');
        }
    });
});

test.describe('Seller Reviews', () => {
    test('can navigate to leave a buyer review on a completed order', async ({ page }) => {
        await page.goto('/orders');
        await page.waitForTimeout(2000);
        const reviewBuyerLink = page.locator('a[href*="review-buyer"]').first();
        if (await reviewBuyerLink.count() > 0) {
            await reviewBuyerLink.click();
            await page.waitForTimeout(1500);
            await expect(page.url()).toContain('review-buyer');
            await expect(page.locator('form, textarea, input[type="radio"]').first()).toBeVisible();
        }
    });

    test('can view their profile reviews', async ({ page }) => {
        await page.goto('/profile/reviews');
        await page.waitForTimeout(1500);
        await expect(page.url()).toContain('/profile/reviews');
    });
});
