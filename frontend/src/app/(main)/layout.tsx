import MobileLayout from '@/components/layout/MobileLayout';

export default function MainLayout({ children }: { children: React.ReactNode }) {
    return (
        <MobileLayout>
            {children}
        </MobileLayout>
    );
}