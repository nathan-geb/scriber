import React, { createContext, useContext, ReactNode } from 'react';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

interface ConfigContextType {
    apiUrl: string;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export function ConfigProvider({ children }: { children: ReactNode }) {
    const getApiUrl = () => {
        // Typically, your packager IP allows connection from device/emulator
        const hostUri = Constants.expoConfig?.hostUri;
        const host = hostUri ? hostUri.split(':')[0] : 'localhost';

        // Android Emulator specific host
        if (Platform.OS === 'android' && !Constants.isDevice) {
            return 'http://10.0.2.2:3001';
        }

        // Physical device or iOS Simulator
        return `http://${host}:3001`;
    };

    const apiUrl = getApiUrl();

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
