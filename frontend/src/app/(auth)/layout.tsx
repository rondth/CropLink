import MobileLayout from '@/components/layout/MobileLayout';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <MobileLayout showChrome={false}>
            {children}
        </MobileLayout>
    );
}