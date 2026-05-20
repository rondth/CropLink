import '../styles/globals.css';
import { RoleProvider } from '@/components/layout/RoleContext';
import RoleToggle from '@/components/layout/RoleToggle';
import MobileLayout from '@/components/layout/MobileLayout';

export const metadata = { title: 'CropLink', description: 'Marketplace connecting farmers and buyers' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>
                <RoleProvider>
                    <RoleToggle />
                    <MobileLayout>
                        {children}
                    </MobileLayout>
                </RoleProvider>
            </body>
        </html>
    );
}