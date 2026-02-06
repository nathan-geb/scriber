import React from 'react';

interface CircularProgressProps {
    percentage: number;
    color: string;
    size?: number;
    strokeWidth?: number;
    trackColor?: string;
    children?: React.ReactNode;
}

export const CircularProgress = ({ percentage, color, trackColor = 'text-white/10', size = 120, strokeWidth = 10, children }: CircularProgressProps) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percentage / 100) * circumference;

    return (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
            <svg className="transform -rotate-90 w-full h-full">
                <circle cx={size / 2} cy={size / 2} r={radius} stroke={trackColor.startsWith('text-') ? "currentColor" : trackColor} strokeWidth={strokeWidth}
                    fill="transparent" className={trackColor.startsWith('text-') ? trackColor : ''} />
                <circle cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={strokeWidth} fill="transparent"
                    strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
                    className="transition-all duration-1000 ease-out" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-white">
                {children}
            </div>
        </div>
    );
};
