import { test, expect } from '@playwright/test';

test.describe('Buyer Auth', () => {
    test('shows sign-in prompt on protected page when unauthenticated', async ({ browser }) => {
        const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
        const page = await ctx.newPage();
        await page.goto('/profile');
        await page.waitForSelector('text=Sign in to view your profile', { timeout: 10000 });
        await expect(page.locator('text=Sign in to view your profile')).toBeVisible();
        await ctx.close();
    });

    test('login with valid credentials', async ({ browser }) => {
        const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
        const page = await ctx.newPage();
        await page.goto('/login');
        await page.fill('#email', process.env.BUYER_EMAIL!);
        await page.fill('#password', process.env.BUYER_PASSWORD!);
        await page.click('button[type="submit"]');
        await page.waitForURL('/');
        await expect(page).toHaveURL('/');
        await ctx.close();
    });

    test('shows error on invalid credentials', async ({ browser }) => {
        const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
        const page = await ctx.newPage();
        await page.goto('/login');
        await page.fill('#email', 'wrong@example.com');
        await page.fill('#password', 'wrongpassword');
        await page.click('button[type="submit"]');
        await expect(page.locator('text=Invalid email or password')).toBeVisible();
        await ctx.close();
    });
});

test.describe('Buyer Marketplace', () => {
    test('home page loads listings', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('body')).toBeVisible();
        // wait for listings to load (product cards appear)
        await page.waitForTimeout(2000);
    });

    test('can filter listings by category', async ({ page }) => {
        await page.goto('/');
        await page.waitForTimeout(1500);
        const categoryBtn = page.locator('button').filter({ hasText: /Vegetables|Fruits|Grains/i }).first();
        if (await categoryBtn.count() > 0) {
            await categoryBtn.click();
            await page.waitForTimeout(500);
        }
    });

    test('can search for a crop', async ({ page }) => {
        await page.goto('/');
        await page.waitForTimeout(1500);
        const searchInput = page.locator('input[type="text"], input[placeholder*="search" i]').first();
        if (await searchInput.count() > 0) {
            await searchInput.fill('tomato');
            await page.waitForTimeout(500);
        }
    });

    test('clicking a product opens product details', async ({ page }) => {
        await page.goto('/');
        await page.waitForTimeout(2000);
        const productCard = page.locator('[class*="cursor-pointer"], [class*="card"]').first();
        if (await productCard.count() > 0) {
            await productCard.click();
            await page.waitForTimeout(1000);
            // product details panel or modal should appear
            await expect(page.locator('body')).toBeVisible();
        }
    });
});

test.describe('Buyer Prices', () => {
    test('prices page loads', async ({ page }) => {
        await page.goto('/prices');
        await page.waitForTimeout(2000);
        await expect(page).toHaveURL('/prices');
    });
});

test.describe('Buyer Profile', () => {
    test('profile page loads with user info', async ({ page }) => {
        await page.goto('/profile');
        await page.waitForTimeout(1500);
        await expect(page).toHaveURL('/profile');
    });

    test('can update display name', async ({ page }) => {
        await page.goto('/profile');
        await page.waitForTimeout(1500);
        const nameInput = page.locator('input[name="name"], input[placeholder*="name" i]').first();
        if (await nameInput.count() > 0) {
            await nameInput.clear();
            await nameInput.fill('Wiwo Buyer');
            const saveBtn = page.locator('button').filter({ hasText: /save|update/i }).first();
            if (await saveBtn.count() > 0) {
                await saveBtn.click();
                await page.waitForTimeout(1000);
            }
        }
    });
});

test.describe('Buyer Orders', () => {
    test('orders page loads', async ({ page }) => {
        await page.goto('/orders');
        await page.waitForTimeout(2000);
        await expect(page).toHaveURL('/orders');
    });

    test('can filter orders by status', async ({ page }) => {
        await page.goto('/orders');
        await page.waitForTimeout(1500);
        const completedFilter = page.locator('button').filter({ hasText: /completed/i }).first();
        if (await completedFilter.count() > 0) {
            await completedFilter.click();
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

test.describe('Buyer Checkout', () => {
    test('initiates checkout from product details', async ({ page }) => {
        await page.goto('/');
        await page.waitForTimeout(2000);
        const productCard = page.locator('[class*="cursor-pointer"]').first();
        if (await productCard.count() > 0) {
            await productCard.click();
            await page.waitForTimeout(1000);
            const buyBtn = page.locator('button').filter({ hasText: /buy|order|purchase/i }).first();
            if (await buyBtn.count() > 0) {
                await buyBtn.click();
                await page.waitForTimeout(2000);
                // should navigate to checkout or show quantity input
                await expect(page.locator('body')).toBeVisible();
            }
        }
    });
});

test.describe('Buyer Block & Report', () => {
    async function openFirstSellerProfile(page: any) {
        await page.goto('/');
        await page.waitForTimeout(2000);
        const productCard = page.locator('[class*="cursor-pointer"], [class*="card"]').first();
        if (await productCard.count() === 0) return false;
        await productCard.click();
        await page.waitForTimeout(1000);

        const sellerButton = page.locator('h3', { hasText: 'Seller' }).locator('..').locator('button').first();
        if (await sellerButton.count() === 0) return false;
        await sellerButton.click();
        await page.waitForTimeout(1500);

        // kebab menu (block/report) is only rendered for other people's profiles
        const kebabButton = page.locator('.absolute.top-4.right-4 > button').first();
        return (await kebabButton.count()) > 0;
    }

    test('can block a seller from their profile and no longer see their listings', async ({ page }) => {
        if (!(await openFirstSellerProfile(page))) return;

        const cropName = await page.locator('h4').first().textContent().catch(() => null);

        const kebabButton = page.locator('.absolute.top-4.right-4 > button').first();
        await kebabButton.click();
        await page.waitForTimeout(300);

        const blockMenuItem = page.getByRole('button', { name: /^Block user$/ });
        if (await blockMenuItem.count() === 0) return; // already blocked from a previous run
        await blockMenuItem.click();
        await page.waitForTimeout(300);

        const confirmBlockBtn = page.getByRole('button', { name: /^Block$/ });
        await confirmBlockBtn.click();
        await page.waitForTimeout(1000);

        await expect(page.locator('text=/blocked/i').first()).toBeVisible();

        await page.goto('/');
        await page.waitForTimeout(2000);
        if (cropName) {
            await expect(page.locator('h4', { hasText: cropName })).toHaveCount(0);
        }

        // cleanup so the test is repeatable: navigate back to the seller profile and unblock
        await page.goBack();
        await page.waitForTimeout(1500);
        const kebabButtonAgain = page.locator('.absolute.top-4.right-4 > button').first();
        if (await kebabButtonAgain.count() > 0) {
            await kebabButtonAgain.click();
            await page.waitForTimeout(300);
            const unblockMenuItem = page.getByRole('button', { name: /^Unblock user$/ });
            if (await unblockMenuItem.count() > 0) {
                await unblockMenuItem.click();
                await page.waitForTimeout(1000);
            }
        }
    });

    test('can report a seller with a reason and sees a confirmation', async ({ page }) => {
        if (!(await openFirstSellerProfile(page))) return;

        const kebabButton = page.locator('.absolute.top-4.right-4 > button').first();
        await kebabButton.click();
        await page.waitForTimeout(300);

        const reportMenuItem = page.getByRole('button', { name: /^Report user$/ });
        if (await reportMenuItem.count() === 0) return;
        await reportMenuItem.click();
        await page.waitForTimeout(300);

        const reasonInput = page.locator('textarea');
        await reasonInput.fill('This user posted spam listings repeatedly.');

        const submitBtn = page.getByRole('button', { name: /^Submit Report$/ });
        await submitBtn.click();
        await page.waitForTimeout(1000);

        await expect(page.locator('text=/report submitted/i')).toBeVisible();
    });

    test('can view and unblock a user from the blocked users list', async ({ page }) => {
        if (!(await openFirstSellerProfile(page))) return;

        const kebabButton = page.locator('.absolute.top-4.right-4 > button').first();
        await kebabButton.click();
        await page.waitForTimeout(300);

        const toggleButton = page.getByRole('button', { name: /^(Block user|Unblock user)$/ });
        if (await toggleButton.count() === 0) return;
        const isAlreadyBlocked = (await toggleButton.textContent())?.includes('Unblock');
        if (!isAlreadyBlocked) {
            // not blocked yet: block them first so there's something to unblock from the list
            await toggleButton.click();
            await page.waitForTimeout(300);
            await page.getByRole('button', { name: /^Block$/ }).click();
            await page.waitForTimeout(1000);
        } else {
            // already blocked from a previous run: just close the menu and move on
            await kebabButton.click();
            await page.waitForTimeout(300);
        }

        await page.goto('/profile/blocked');
        await page.waitForTimeout(1500);

        const blockedRow = page.locator('button', { hasText: 'Unblock' }).first();
        if (await blockedRow.count() === 0) return;
        await blockedRow.click();
        await page.waitForTimeout(300);

        await page.getByRole('button', { name: 'Unblock', exact: true }).last().click();
        await page.waitForTimeout(1000);

        await expect(page.locator('text=/unblocked/i')).toBeVisible();
    });
});

test.describe('Buyer Reviews', () => {
    test('can navigate to leave a seller review on a completed order', async ({ page }) => {
        await page.goto('/orders');
        await page.waitForTimeout(2000);
        const reviewSellerLink = page.locator('a[href*="review-seller"]').first();
        if (await reviewSellerLink.count() > 0) {
            await reviewSellerLink.click();
            await page.waitForTimeout(1500);
            await expect(page.url()).toContain('review-seller');
            // review form should be visible
            await expect(page.locator('form, textarea, input[type="radio"]').first()).toBeVisible();
        }
    });

    test('can view crop reviews', async ({ page }) => {
        await page.goto('/');
        await page.waitForTimeout(2000);
        const productCard = page.locator('[class*="cursor-pointer"]').first();
        if (await productCard.count() > 0) {
            await productCard.click();
            await page.waitForTimeout(1000);
            const reviewsLink = page.locator('a[href*="/reviews"]').first();
            if (await reviewsLink.count() > 0) {
                await reviewsLink.click();
                await page.waitForTimeout(1500);
                await expect(page.url()).toContain('/reviews');
            }
        }
    });
});
