'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useAuth } from '@/lib/AuthContext';

type Role = 'buyer' | 'seller';

interface RoleContextType {
    role: Role;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const role: Role = user?.role === 'seller' ? 'seller' : 'buyer';

    return (
        <RoleContext.Provider value={{ role }}>
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
