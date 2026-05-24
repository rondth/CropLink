import '../styles/globals.css';
import { RoleProvider } from '@/components/layout/RoleContext';
import RoleToggle from '@/components/layout/RoleToggle';
import MobileLayout from '@/components/layout/MobileLayout';
import { AuthProvider } from '@/lib/AuthContext';

export const metadata = { title: 'CropLink', description: 'Marketplace connecting farmers and buyers' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>
                <AuthProvider>
                    <RoleProvider>
                        <RoleToggle />
                        {children}
                    </RoleProvider>
                </AuthProvider>
            </body>
        </html>
    );
}