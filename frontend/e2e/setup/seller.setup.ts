import { test as setup } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../.auth/seller.json');

setup('authenticate as seller', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', process.env.SELLER_EMAIL!);
    await page.fill('#password', process.env.SELLER_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    await page.context().storageState({ path: authFile });
});
