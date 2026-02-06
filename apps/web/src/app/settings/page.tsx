'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useMeetings } from '@/hooks/useMeetings';
import { apiEndpoint } from '@echomint/core';
import { useToast } from '@/context/ToastContext';
import { Button } from '@/components/ui/Button';
import { CircularProgress } from '@/components/ui/CircularProgress';
import { Navbar } from '@/components/layout/Navbar';
import {
    Bell,
    User,
    LogOut,
    Moon,
    Sun,
    Clock,
    HelpCircle,
    Shield,
    Mail,
    Smartphone,
    Settings,
    Palette,
    Headphones,
    CreditCard,
    ChevronRight,
    Calendar,
    Link2,
    Send,
    Check,
    Loader2,
} from 'lucide-react';

type SettingsTab = 'account' | 'notifications' | 'preferences' | 'integrations' | 'support';

export default function SettingsPage() {
    const { user, token, logout } = useAuth();
    const { meetings } = useMeetings();
    const toast = useToast();
    const [activeTab, setActiveTab] = useState<SettingsTab>('account');
    const [emailEnabled, setEmailEnabled] = useState(true);
    const [pushEnabled, setPushEnabled] = useState(true);
    const [darkMode, setDarkMode] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user?.notificationSettings) {
            setEmailEnabled(user.notificationSettings.email);
            setPushEnabled(user.notificationSettings.push);
        }
    }, [user]);

    // Calculate usage stats
    const totalMinutes = meetings.reduce((acc, m) => {
        if (!m.durationSeconds) return acc;
        return acc + m.durationSeconds;
    }, 0) / 60;

    const displayMinutes = Math.round(totalMinutes);
    const monthlyLimit = 60;
    const usagePercentage = Math.min(100, (displayMinutes / monthlyLimit) * 100);

    const handleSaveNotifications = async () => {
        setLoading(true);
        try {
            const res = await fetch(apiEndpoint('/users/notifications'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    email: emailEnabled,
                    push: pushEnabled
                })
            });

            if (!res.ok) throw new Error('Failed to update settings');

            toast.success('Settings Saved', 'Your notification preferences have been updated.');
        } catch (error) {
            console.error(error);
            toast.error('Error', 'Failed to save settings');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        if (confirm('Are you sure you want to log out?')) {
            logout();
        }
    };

    // Sidebar navigation items
    const navItems = [
        { id: 'account' as const, label: 'Account', icon: User, description: 'Profile & usage' },
        { id: 'integrations' as const, label: 'Integrations', icon: Link2, description: 'Calendar & Telegram' },
        { id: 'notifications' as const, label: 'Notifications', icon: Bell, description: 'Email & push alerts' },
        { id: 'preferences' as const, label: 'Preferences', icon: Palette, description: 'Theme & display' },
        { id: 'support' as const, label: 'Support', icon: Headphones, description: 'Help & privacy' },
    ];

    // Settings row component
    const SettingsRow = ({
        icon: Icon,
        label,
        value,
        onClick,
        toggle,
        toggleValue,
        onToggle,
        danger = false,
        action
    }: {
        icon: React.ElementType;
        label: string;
        value?: string;
        onClick?: () => void;
        toggle?: boolean;
        toggleValue?: boolean;
        onToggle?: (val: boolean) => void;
        danger?: boolean;
        action?: React.ReactNode;
    }) => (
        <div
            className={`flex items-center justify-between px-5 py-4 ${onClick ? 'cursor-pointer hover:bg-slate-50 transition-colors' : ''}`}
            onClick={onClick}
        >
            <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${danger ? 'bg-red-50 text-red-500' : 'bg-slate-100 text-slate-500'}`}>
                    <Icon size={20} />
                </div>
                <div className="flex flex-col">
                    <span className={`font-medium ${danger ? 'text-red-600' : 'text-slate-700'}`}>{label}</span>
                </div>
            </div>
            <div className="flex items-center gap-3">
                {value && (
                    <span className="text-slate-400 text-sm">{value}</span>
                )}
                {action}
                {toggle && onToggle && (
                    <label className="relative inline-flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
                        <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={toggleValue}
                            onChange={(e) => onToggle(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                    </label>
                )}
                {onClick && !toggle && !action && (
                    <ChevronRight size={20} className="text-slate-300" />
                )}
            </div>
        </div>
    );

    // Render content based on active tab
    const renderContent = () => {
        switch (activeTab) {
            case 'account':
                return (
                    <div className="space-y-6 animate-fade-in">
                        {/* Profile Card */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex items-center gap-5">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-orange-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-violet-500/20">
                                {user?.name?.[0] || 'U'}
                            </div>
                            <div className="flex-1">
                                <h2 className="text-xl font-bold text-slate-900">{user?.name || 'User'}</h2>
                                <p className="text-slate-500 text-sm">{user?.email || 'user@example.com'}</p>
                            </div>
                        </div>

                        {/* Usage Stats Card */}
                        <div className="bg-gradient-to-br from-violet-600 to-orange-500 rounded-2xl shadow-xl p-6 text-white">
                            <div className="flex items-center gap-6">
                                <div className="shrink-0">
                                    <CircularProgress
                                        percentage={usagePercentage}
                                        color="#fff"
                                        trackColor="rgba(255,255,255,0.2)"
                                        size={80}
                                        strokeWidth={6}
                                    >
                                        <span className="text-lg font-bold">{displayMinutes}<span className="text-xs font-normal opacity-70">m</span></span>
                                    </CircularProgress>
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Clock size={14} className="opacity-70" />
                                        <span className="text-xs font-medium uppercase tracking-wide opacity-70">Monthly Usage</span>
                                    </div>
                                    <p className="text-sm opacity-90">
                                        You&apos;ve used <span className="font-bold">{displayMinutes}</span> of <span className="font-bold">{monthlyLimit}</span> minutes this month.
                                    </p>
                                    <button className="mt-3 text-xs font-bold bg-white/20 hover:bg-white/30 px-4 py-1.5 rounded-full transition-colors">
                                        Upgrade to Pro
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Account Actions */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Account Actions</h3>
                            </div>
                            <div className="divide-y divide-slate-100">
                                <SettingsRow
                                    icon={CreditCard}
                                    label="Manage Subscription"
                                    onClick={() => { }}
                                />
                                <SettingsRow
                                    icon={LogOut}
                                    label="Log Out"
                                    onClick={handleLogout}
                                    danger
                                />
                            </div>
                        </div>
                    </div>
                );


            case 'integrations':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Connected Apps</h3>
                            </div>
                            <div className="divide-y divide-slate-100">
                                <SettingsRow
                                    icon={Calendar}
                                    label="Google Calendar"
                                    value="Not Connected"
                                    action={
                                        <Button size="sm" variant="outline" className="text-xs" onClick={() => {
                                            // Trigger Google OAuth
                                            window.location.href = `${apiEndpoint('/auth/google')}?scope=calendar`;
                                        }}>
                                            Connect
                                        </Button>
                                    }
                                />
                                <SettingsRow
                                    icon={Send}
                                    label="Telegram Bot"
                                    value={user?.telegramId ? `@${user.telegramId}` : 'Not Connected'}
                                    action={
                                        !user?.telegramId ? (
                                            <Button size="sm" variant="outline" className="text-xs" onClick={() => window.location.href = '/dashboard'}>
                                                Link
                                            </Button>
                                        ) : (
                                            <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium bg-emerald-50 px-2 py-1 rounded-full">
                                                <Check size={12} /> Linked
                                            </span>
                                        )
                                    }
                                />
                            </div>
                        </div>

                        {/* Info Card */}
                        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex gap-3">
                            <div className="shrink-0 text-blue-500 mt-0.5">
                                <HelpCircle size={18} />
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-blue-900">About Integrations</h4>
                                <p className="text-sm text-blue-700 mt-1">
                                    Connecting your calendar allows Scriber to automatically identify upcoming meetings and prepare for transcription. The Telegram bot lets you capture voice notes on the go.
                                </p>
                            </div>
                        </div>
                    </div>
                );

            case 'notifications':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Alert Preferences</h3>
                            </div>
                            <div className="divide-y divide-slate-100">
                                <SettingsRow
                                    icon={Mail}
                                    label="Email Notifications"
                                    toggle
                                    toggleValue={emailEnabled}
                                    onToggle={setEmailEnabled}
                                />
                                <SettingsRow
                                    icon={Smartphone}
                                    label="Push Notifications"
                                    toggle
                                    toggleValue={pushEnabled}
                                    onToggle={setPushEnabled}
                                />
                            </div>
                            <div className="px-5 py-4 bg-slate-50/50 border-t border-slate-100">
                                <Button
                                    onClick={handleSaveNotifications}
                                    isLoading={loading}
                                    className="w-full bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 text-white"
                                >
                                    Save Preferences
                                </Button>
                            </div>
                        </div>
                    </div>
                );

            case 'preferences':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Appearance</h3>
                            </div>
                            <div className="divide-y divide-slate-100">
                                <SettingsRow
                                    icon={darkMode ? Moon : Sun}
                                    label="Dark Mode"
                                    toggle
                                    toggleValue={darkMode}
                                    onToggle={setDarkMode}
                                />
                            </div>
                        </div>
                    </div>
                );

            case 'support':
                return (
                    <div className="space-y-6 animate-fade-in">
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/50">
                                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Help & Resources</h3>
                            </div>
                            <div className="divide-y divide-slate-100">
                                <SettingsRow
                                    icon={HelpCircle}
                                    label="Help & FAQ"
                                    onClick={() => window.open('https://scriber.app/help', '_blank')}
                                />
                                <SettingsRow
                                    icon={Shield}
                                    label="Privacy Policy"
                                    onClick={() => window.open('https://scriber.app/privacy', '_blank')}
                                />
                            </div>
                        </div>

                        {/* App Version */}
                        <div className="text-center py-4 text-xs text-slate-400">
                            <p>Scriber v1.0.0</p>
                            <p className="mt-1">Made with ❤️ for better meetings</p>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="min-h-screen bg-[#F5F5F7] font-sans text-slate-900 pb-32 lg:pb-12 relative selection:bg-violet-200 overflow-x-hidden">
            {/* Header Background - Gradient with Depth */}
            <div className="absolute top-0 left-0 right-0 h-[200px] bg-gradient-to-br from-[#2D2B3F] via-[#252338] to-[#1E1B2E] z-0">
                <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/8 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2 animate-pulse" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-violet-500/10 rounded-full blur-3xl transform -translate-x-1/2 translate-y-1/2 animate-pulse" style={{ animationDelay: '1s' }} />
            </div>

            {/* Header Content */}
            <header className="px-6 md:px-12 pt-14 pb-6 flex items-center justify-between relative z-20 max-w-7xl mx-auto w-full">
                <div>
                    <p className="text-violet-300/80 text-[11px] font-semibold uppercase tracking-[0.2em] mb-1.5">Account</p>
                    <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
                        <Settings size={28} className="opacity-80" />
                        Settings
                    </h1>
                </div>
                <Navbar />
            </header>

            {/* Main Layout - Desktop: Sidebar + Content */}
            <div className="px-6 md:px-12 relative z-10 max-w-7xl mx-auto w-full">
                <div className="lg:flex lg:gap-8">

                    {/* Sidebar Navigation - Desktop */}
                    <aside className="hidden lg:block lg:w-64 lg:shrink-0">
                        <nav className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden sticky top-8">
                            {navItems.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveTab(item.id)}
                                    className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-all ${activeTab === item.id
                                        ? 'bg-violet-50 border-l-4 border-violet-500 text-violet-700'
                                        : 'hover:bg-slate-50 border-l-4 border-transparent text-slate-600'
                                        }`}
                                >
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${activeTab === item.id
                                        ? 'bg-violet-100 text-violet-600'
                                        : 'bg-slate-100 text-slate-400'
                                        }`}>
                                        <item.icon size={20} />
                                    </div>
                                    <div>
                                        <span className={`block font-semibold text-sm ${activeTab === item.id ? 'text-violet-700' : 'text-slate-700'
                                            }`}>
                                            {item.label}
                                        </span>
                                        <span className="block text-xs text-slate-400">{item.description}</span>
                                    </div>
                                </button>
                            ))}
                        </nav>
                    </aside>

                    {/* Mobile Tab Bar */}
                    <div className="lg:hidden flex gap-2 mb-6 overflow-x-auto pb-2 -mx-6 px-6">
                        {navItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl whitespace-nowrap transition-all ${activeTab === item.id
                                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20'
                                    : 'bg-white text-slate-600 border border-slate-200'
                                    }`}
                            >
                                <item.icon size={16} />
                                <span className="font-medium text-sm">{item.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Main Content Area */}
                    <main className="flex-1 min-w-0 lg:max-w-2xl">
                        {renderContent()}
                    </main>
                </div>
            </div>
        </div>
    );
}
