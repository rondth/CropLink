import '../styles/globals.css';
import { RoleProvider } from '@/components/layout/RoleContext';
import { AuthProvider } from '@/lib/AuthContext';

export const metadata = { title: 'CropLink', description: 'Marketplace connecting farmers and buyers' };

export const viewport = {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    themeColor: '#2d5a27',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en">
            <body>
                <AuthProvider>
                    <RoleProvider>
                        {children}
                    </RoleProvider>
                </AuthProvider>
            </body>
        </html>
    );
}