export const theme = {
    colors: {
        // Primary - Refined Indigo Scale
        primary: '#6366f1',         // Softer, more sophisticated
        primary50: '#eef2ff',
        primary100: '#e0e7ff',
        primary200: '#c7d2fe',
        primary400: '#818cf8',
        primary600: '#4f46e5',
        primary700: '#4338ca',
        primary900: '#312e81',
        primaryLight: '#eef2ff',
        primaryHover: '#4f46e5',
        primaryText: '#818cf8',
        primaryDark: '#312e81',

        // Accent - Warm Coral
        accent: '#f97066',
        accentLight: '#fef2f2',

        // Surfaces - Warmer neutrals
        surface: '#ffffff',
        surfaceRaised: '#fafafa',
        surfaceOverlay: 'rgba(255, 255, 255, 0.95)',
        background: '#f8f7f6',      // Subtle warmth
        paper: '#fffcf5',           // Reading surface
        surfaceHighlight: '#f1f5f9',

        // Secondary
        secondary: '#0f172a',
        secondaryLight: '#1e293b',
        sidebar: '#0b1121',

        // Borders
        border: '#e2e8f0',
        borderLight: '#f1f5f9',

        // Text - Better contrast hierarchy
        textMain: '#18181b',
        textPrimary: '#18181b',
        textSecondary: '#52525b',
        textMuted: '#71717a',
        textLight: '#a1a1aa',
        textInverse: '#ffffff',

        // Semantic - Refined status colors
        success: '#22c55e',
        successLight: '#dcfce7',
        successSoft: '#dcfce7',

        warning: '#eab308',
        warningLight: '#fef9c3',
        warningSoft: '#fef9c3',

        danger: '#ef4444',
        dangerLight: '#fee2e2',
        dangerSoft: '#fee2e2',

        info: '#3b82f6',
        infoLight: '#dbeafe',
        infoSoft: '#dbeafe',

        // Speaker colors for transcript
        speaker1: { bg: '#dbeafe', text: '#1d4ed8', accent: '#3b82f6' },
        speaker2: { bg: '#d1fae5', text: '#047857', accent: '#10b981' },
        speaker3: { bg: '#fef3c7', text: '#b45309', accent: '#f59e0b' },
        speaker4: { bg: '#ffe4e6', text: '#be123c', accent: '#f43f5e' },
    },
    typography: {
        fontSans: 'Inter, system-ui, sans-serif',
        fontDisplay: 'DM Serif Display, Georgia, serif',

        // Type Scale
        textXs: 12,
        textSm: 14,
        textBase: 16,
        textLg: 18,
        textXl: 20,
        text2xl: 24,
        text3xl: 30,
        text4xl: 36,

        // Line heights
        leadingTight: 1.25,
        leadingNormal: 1.5,
        leadingRelaxed: 1.75,

        // Letter spacing
        trackingTight: -0.025,
        trackingNormal: 0,
        trackingWide: 0.05,
    },
    shadows: {
        xs: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.04,
            shadowRadius: 2,
            elevation: 1,
        },
        sm: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.06,
            shadowRadius: 4,
            elevation: 2,
        },
        md: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.08,
            shadowRadius: 8,
            elevation: 4,
        },
        lg: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 12 },
            shadowOpacity: 0.10,
            shadowRadius: 24,
            elevation: 10,
        },
        xl: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 24 },
            shadowOpacity: 0.12,
            shadowRadius: 48,
            elevation: 15,
        },
        // Colored shadows
        primary: {
            shadowColor: '#6366f1',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.25,
            shadowRadius: 24,
            elevation: 8,
        },
        success: {
            shadowColor: '#22c55e',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.25,
            shadowRadius: 24,
            elevation: 8,
        },
        danger: {
            shadowColor: '#ef4444',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.25,
            shadowRadius: 24,
            elevation: 8,
        },
    },
    radius: {
        xs: 4,
        sm: 6,
        md: 10,
        lg: 14,
        xl: 20,
        '2xl': 24,
        full: 9999,
    },
    spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32,
        '2xl': 48,
    },
    animation: {
        fast: 150,
        normal: 200,
        slow: 300,
    },
};
