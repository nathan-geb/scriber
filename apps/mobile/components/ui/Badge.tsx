import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { theme } from '@echomint/core';
import { Ionicons } from '@expo/vector-icons';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'default' | 'processing';
type BadgeSize = 'sm' | 'md' | 'lg';

interface BadgeProps {
    variant?: BadgeVariant;
    size?: BadgeSize;
    /** Show dot indicator */
    dot?: boolean;
    /** Show status icon */
    icon?: boolean;
    children: string;
}

const variantColors: Record<BadgeVariant, { bg: string; text: string }> = {
    success: { bg: theme.colors.successLight, text: theme.colors.success },
    warning: { bg: theme.colors.warningLight, text: theme.colors.warning },
    danger: { bg: theme.colors.dangerLight, text: theme.colors.danger },
    info: { bg: theme.colors.infoLight, text: theme.colors.info },
    processing: { bg: theme.colors.primary100, text: theme.colors.primary },
    default: { bg: theme.colors.surfaceHighlight, text: theme.colors.textMuted },
};

const sizeStyles: Record<BadgeSize, {
    paddingH: number;
    paddingV: number;
    fontSize: number;
    iconSize: number;
    dotSize: number;
}> = {
    sm: { paddingH: 8, paddingV: 2, fontSize: 10, iconSize: 10, dotSize: 5 },
    md: { paddingH: 10, paddingV: 4, fontSize: 12, iconSize: 12, dotSize: 6 },
    lg: { paddingH: 12, paddingV: 6, fontSize: 14, iconSize: 14, dotSize: 8 },
};

function BadgeIcon({ variant, size, color }: { variant: BadgeVariant; size: BadgeSize; color: string }) {
    const iconSize = sizeStyles[size].iconSize;

    if (variant === 'processing') {
        return <ActivityIndicator size="small" color={color} style={{ width: iconSize, height: iconSize }} />;
    }

    const iconName: keyof typeof Ionicons.glyphMap =
        variant === 'success' ? 'checkmark-circle' :
            variant === 'warning' ? 'alert-circle' :
                variant === 'danger' ? 'close-circle' :
                    'ellipse';

    return <Ionicons name={iconName} size={iconSize} color={color} />;
}

export function Badge({
    variant = 'default',
    size = 'sm',
    dot = false,
    icon = false,
    children
}: BadgeProps) {
    const colors = variantColors[variant];
    const sizes = sizeStyles[size];

    return (
        <View style={[
            styles.container,
            {
                backgroundColor: colors.bg,
                paddingHorizontal: sizes.paddingH,
                paddingVertical: sizes.paddingV,
            }
        ]}>
            {dot && (
                <View style={[
                    styles.dot,
                    {
                        width: sizes.dotSize,
                        height: sizes.dotSize,
                        backgroundColor: colors.text
                    }
                ]} />
            )}
            {icon && !dot && (
                <BadgeIcon variant={variant} size={size} color={colors.text} />
            )}
            <Text style={[
                styles.text,
                {
                    color: colors.text,
                    fontSize: sizes.fontSize
                }
            ]}>
                {children}
            </Text>
        </View>
    );
}

// Status helper for meeting statuses
export function getStatusVariant(status: string): BadgeVariant {
    switch (status) {
        case 'COMPLETED':
            return 'success';
        case 'FAILED':
            return 'danger';
        case 'PROCESSING_TRANSCRIPT':
        case 'PROCESSING_MINUTES':
            return 'processing';
        case 'UPLOADED':
        case 'UPLOADING':
            return 'warning';
        default:
            return 'default';
    }
}

export function formatStatusLabel(status: string): string {
    return status.replace(/_/g, ' ').toLowerCase();
}

// Convenience component for meeting status
interface StatusBadgeProps {
    status: string;
    size?: BadgeSize;
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
    const variant = getStatusVariant(status);
    const isProcessing = status === 'PROCESSING_TRANSCRIPT' || status === 'PROCESSING_MINUTES';

    return (
        <Badge
            variant={variant}
            size={size}
            icon={isProcessing}
        >
            {formatStatusLabel(status)}
        </Badge>
    );
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: theme.radius.full,
        gap: 4,
    },
    dot: {
        borderRadius: theme.radius.full,
    },
    text: {
        fontWeight: '600',
        textTransform: 'capitalize',
    },
});
