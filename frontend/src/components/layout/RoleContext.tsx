'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth } from '@/lib/AuthContext';

type Role = 'buyer' | 'seller';

interface RoleContextType {
    role: Role;
    isLoading: boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
    const { user, isLoading } = useAuth();
    const role: Role = user?.role === 'seller' ? 'seller' : 'buyer';

    return (
        <RoleContext.Provider value={{ role, isLoading }}>
            {children}
        </RoleContext.Provider>
    );
}

export function useRole() {
    const context = useContext(RoleContext);
    if (context === undefined) {
        throw new Error('useRole must be used within a RoleProvider');
    }
    return context;
}
