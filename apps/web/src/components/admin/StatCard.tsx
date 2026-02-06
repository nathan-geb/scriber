import React from 'react';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ReactNode;
    trend?: {
        value: number;
        isPositive: boolean;
    };
    color?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
}

const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600',
    red: 'bg-red-100 text-red-600',
};

export function StatCard({
    title,
    value,
    icon,
    trend,
    color = 'blue',
}: StatCardProps) {
    return (
        <div className="bg-surface border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm text-text-muted font-medium">{title}</p>
                    <p className="text-2xl font-bold text-text-main mt-1">{value}</p>
                    {trend && (
                        <p
                            className={`text-xs mt-2 font-medium ${trend.isPositive ? 'text-green-600' : 'text-red-600'
                                }`}
                        >
                            {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
                            <span className="text-text-muted ml-1">vs last week</span>
                        </p>
                    )}
                </div>
                <div
                    className={`h-12 w-12 rounded-xl flex items-center justify-center ${colorClasses[color]}`}
                >
                    {icon}
                </div>
            </div>
        </div>
    );
}
