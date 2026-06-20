import { defineConfig, devices } from '@playwright/test';
import { config } from 'dotenv';
import path from 'path';

config({ path: path.resolve(__dirname, 'e2e/.env') });

export default defineConfig({
    testDir: './e2e',
    fullyParallel: false,
    retries: 1,
    timeout: 30000,
    use: {
        baseURL: 'https://croplink-git-dev-crop-link-s-projects.vercel.app',
        headless: true,
        screenshot: 'only-on-failure',
        video: 'retain-on-failure',
    },
    projects: [
        { name: 'buyer-setup', testMatch: '**/setup/buyer.setup.ts' },
        { name: 'seller-setup', testMatch: '**/setup/seller.setup.ts' },
        {
            name: 'buyer',
            testMatch: '**/buyer.spec.ts',
            dependencies: ['buyer-setup'],
            use: {
                ...devices['Desktop Chrome'],
                storageState: 'e2e/.auth/buyer.json',
            },
        },
        {
            name: 'seller',
            testMatch: '**/seller.spec.ts',
            dependencies: ['seller-setup'],
            use: {
                ...devices['Desktop Chrome'],
                storageState: 'e2e/.auth/seller.json',
            },
        },
    ],
});
