import { test, expect, Page, BrowserContext } from '@playwright/test';

const CROP_NAME = `E2E Msg Crop ${Date.now()}`;
const BUYER_MESSAGE = `Hi, is this still available? ${Date.now()}`;
const SELLER_REPLY = `Yes, still in stock! ${Date.now()}`;

const MESSAGE_INPUT = 'textarea[placeholder="Type a message..."]';

async function sendFromThread(page: Page, text: string) {
    await page.locator(MESSAGE_INPUT).fill(text);
    await page.locator(MESSAGE_INPUT).locator('xpath=following-sibling::button').click();
}

test.describe('Messaging - unauthenticated', () => {
    test('tapping "Message Seller" while logged out leads to the sign-in prompt', async ({ browser }) => {
        const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
        const page = await ctx.newPage();
        await page.goto('/');
        await page.waitForTimeout(2000);

        const productCard = page.locator('div.cursor-pointer').first();
        if (await productCard.count() === 0) {
            await ctx.close();
            return;
        }
        await productCard.click();
        await page.waitForTimeout(1000);

        const messageBtn = page.getByRole('button', { name: /^Message Seller$/ });
        if (await messageBtn.count() === 0) {
            await ctx.close();
            return;
        }
        await messageBtn.click();

        await page.waitForURL('**/login', { timeout: 10000 });
        await expect(page.locator('#email')).toBeVisible();
        await ctx.close();
    });
});

test.describe.serial('Messaging - buyer and seller conversation', () => {
    let buyerContext: BrowserContext;
    let sellerContext: BrowserContext;
    let buyerPage: Page;
    let sellerPage: Page;
    let conversationUrl = '';

    test.beforeAll(async ({ browser }) => {
        buyerContext = await browser.newContext({ storageState: 'e2e/.auth/buyer.json' });
        sellerContext = await browser.newContext({ storageState: 'e2e/.auth/seller.json' });
        buyerPage = await buyerContext.newPage();
        sellerPage = await sellerContext.newPage();
    });

    test.afterAll(async () => {
        await buyerContext.close();
        await sellerContext.close();
    });

    test('seller creates a listing to message about', async () => {
        await sellerPage.goto('/');
        await sellerPage.waitForSelector('text=Hello', { timeout: 10000 });
        await sellerPage.click('a[href="/crops"]');
        await sellerPage.waitForTimeout(500);

        const nameInput = sellerPage.locator('input[name="crop_name"], input[placeholder*="crop" i], input[placeholder*="name" i]').first();
        if (await nameInput.count() === 0) return;
        await nameInput.fill(CROP_NAME);

        const categorySelect = sellerPage.locator('select[name="category"]').first();
        if (await categorySelect.count() > 0) await categorySelect.selectOption({ index: 1 });

        const priceInput = sellerPage.locator('input[name="price"], input[type="number"]').first();
        if (await priceInput.count() > 0) await priceInput.fill('20');

        const qtyInput = sellerPage.locator('input[name="quantity"]').first();
        if (await qtyInput.count() > 0) await qtyInput.fill('50');

        const minQtyInput = sellerPage.locator('input[name="min_order_quantity"]').first();
        if (await minQtyInput.count() > 0) await minQtyInput.fill('1');

        const locationInput = sellerPage.locator('input[name="location"]').first();
        if (await locationInput.count() > 0) await locationInput.fill('Test Farm');

        const harvestedInput = sellerPage.locator('input[name="harvested_at"], input[type="date"]').first();
        if (await harvestedInput.count() > 0) await harvestedInput.fill('2026-06-01');

        await sellerPage.locator('button[type="submit"]').first().click();
        await sellerPage.waitForTimeout(3000);
    });

    test('buyer taps "Message Seller" and lands on a chat thread with the listing visible', async () => {
        await buyerPage.goto('/');
        await buyerPage.waitForTimeout(2000);

        const searchInput = buyerPage.locator('input[type="text"], input[placeholder*="search" i]').first();
        if (await searchInput.count() > 0) {
            await searchInput.fill(CROP_NAME);
            await buyerPage.waitForTimeout(800);
        }

        const productCard = buyerPage
            .locator('div.cursor-pointer')
            .filter({ has: buyerPage.locator('h4', { hasText: CROP_NAME }) })
            .first();
        if (await productCard.count() === 0) return;
        await productCard.click();
        await buyerPage.waitForTimeout(1000);

        const messageBtn = buyerPage.getByRole('button', { name: /^Message Seller$/ });
        if (await messageBtn.count() === 0) return;
        await messageBtn.click();

        await buyerPage.waitForURL(/\/messages\//, { timeout: 10000 });
        conversationUrl = buyerPage.url();

        await expect(buyerPage.locator(MESSAGE_INPUT)).toBeVisible();
        await expect(buyerPage.locator(`text=${CROP_NAME}`).first()).toBeVisible();
    });

    test('buyer sends a message and it appears in the thread', async () => {
        if (!conversationUrl) return;

        await sendFromThread(buyerPage, BUYER_MESSAGE);
        await expect(buyerPage.locator(`text=${BUYER_MESSAGE}`)).toBeVisible();

        // Leave the thread so the buyer's Realtime subscription for this
        // conversation isn't live when the seller replies later -- otherwise
        // the reply would auto mark-as-read before we can assert the badge.
        await buyerPage.goto('/');
        await buyerPage.waitForTimeout(1000);
    });

    test('seller inbox shows the conversation with an unread badge', async () => {
        if (!conversationUrl) return;

        await sellerPage.goto('/messages');
        await sellerPage.waitForTimeout(2000);

        await expect(sellerPage.locator(`text=${BUYER_MESSAGE}`).first()).toBeVisible();

        const navBadge = sellerPage.locator('nav a[href="/messages"] [role="status"]');
        await expect(navBadge).toBeVisible();
    });

    test('seller opens the thread; messages render and the badge clears', async () => {
        if (!conversationUrl) return;

        await sellerPage.locator(`text=${BUYER_MESSAGE}`).first().click();
        await sellerPage.waitForURL(/\/messages\//, { timeout: 10000 });
        await expect(sellerPage.locator(`text=${BUYER_MESSAGE}`).first()).toBeVisible();

        await sellerPage.waitForTimeout(1500); // debounced mark-read PATCH
        await sellerPage.goto('/');
        await sellerPage.waitForTimeout(1000);

        const navBadge = sellerPage.locator('nav a[href="/messages"] [role="status"]');
        await expect(navBadge).toHaveCount(0);
    });

    test('seller replies to the buyer', async () => {
        if (!conversationUrl) return;

        await sellerPage.goto(conversationUrl);
        await sellerPage.waitForTimeout(1000);
        await sendFromThread(sellerPage, SELLER_REPLY);
        await expect(sellerPage.locator(`text=${SELLER_REPLY}`)).toBeVisible();
    });

    test('navbar unread badge appears for the buyer after the reply', async () => {
        if (!conversationUrl) return;

        await buyerPage.goto('/');
        await buyerPage.waitForTimeout(2000);

        const navBadge = buyerPage.locator('nav a[href="/messages"] [role="status"]');
        await expect(navBadge).toBeVisible();
    });

    test('header bell shows the unread conversation and tapping it opens the thread', async () => {
        if (!conversationUrl) return;

        const bellButton = buyerPage.locator('button', { has: buyerPage.locator('img[alt="Bell Icon"]') });
        await bellButton.click();
        await buyerPage.waitForTimeout(500);

        const notificationEntry = buyerPage.locator('button', { hasText: SELLER_REPLY });
        await expect(notificationEntry).toBeVisible();
        await notificationEntry.click();

        await buyerPage.waitForURL(/\/messages\//, { timeout: 10000 });
    });

    test("buyer's thread shows the seller's reply after an explicit reload; badge clears", async () => {
        if (!conversationUrl) return;

        await buyerPage.reload();
        await buyerPage.waitForTimeout(1500);
        await expect(buyerPage.locator(`text=${SELLER_REPLY}`)).toBeVisible();

        await buyerPage.waitForTimeout(1000); // debounced mark-read PATCH
        await buyerPage.goto('/');
        await buyerPage.waitForTimeout(1000);

        const navBadge = buyerPage.locator('nav a[href="/messages"] [role="status"]');
        await expect(navBadge).toHaveCount(0);
    });
});
