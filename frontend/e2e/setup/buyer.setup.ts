import { test as setup } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../.auth/buyer.json');

setup('authenticate as buyer', async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', process.env.BUYER_EMAIL!);
    await page.fill('#password', process.env.BUYER_PASSWORD!);
    await page.click('button[type="submit"]');
    await page.waitForURL('/');
    await page.context().storageState({ path: authFile });
});
