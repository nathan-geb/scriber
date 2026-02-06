'use client';

import React, { createContext, useContext, ReactNode } from 'react';

interface ConfigContextType {
    apiUrl: string;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: ReactNode }) {
    // Get API URL from environment or default to localhost
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

    return (
        <ConfigContext.Provider value={{ apiUrl }}>
            {children}
        </ConfigContext.Provider>
    );
}

export function useConfig() {
    const context = useContext(ConfigContext);
    if (context === undefined) {
        throw new Error('useConfig must be used within a ConfigProvider');
    }
    return context;
}
