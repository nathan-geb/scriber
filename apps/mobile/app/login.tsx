import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useConfig } from '../context/ConfigContext';
import { theme } from '@echomint/core';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function LoginScreen() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const { login } = useAuth();
    const { apiUrl } = useConfig();
    const router = useRouter();

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please fill in all fields');
            return;
        }

        setLoading(true);
        try {
            const response = await fetch(`${apiUrl}/api/v1/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Login failed');
            }

            login(data.access_token, data.user);
        } catch (error: any) {
            Alert.alert('Login Failed', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                {/* Logo & Header */}
                <View style={styles.header}>
                    <View style={styles.logoContainer}>
                        <Ionicons name="mic" size={32} color="#fff" />
                    </View>
                    <Text style={styles.title}>Welcome back</Text>
                    <Text style={styles.subtitle}>Sign in to continue to Scriber</Text>
                </View>

                {/* Form */}
                <View style={styles.form}>
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Email</Text>
                        <View style={styles.inputWrapper}>
                            <Ionicons name="mail-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="name@example.com"
                                placeholderTextColor={theme.colors.textLight}
                                value={email}
                                onChangeText={setEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                        </View>
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Password</Text>
                        <View style={styles.inputWrapper}>
                            <Ionicons name="lock-closed-outline" size={20} color={theme.colors.textMuted} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder="••••••••"
                                placeholderTextColor={theme.colors.textLight}
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                            />
                            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                                <Ionicons
                                    name={showPassword ? "eye-off-outline" : "eye-outline"}
                                    size={20}
                                    color={theme.colors.textMuted}
                                />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <TouchableOpacity style={styles.forgotBtn}>
                        <Text style={styles.forgotText}>Forgot password?</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={handleLogin}
                        disabled={loading}
                        activeOpacity={0.8}
                        style={[styles.button, loading && styles.buttonDisabled]}
                    >
                        {loading ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.buttonText}>Sign In</Text>
                        )}
                    </TouchableOpacity>
                </View>

            </View>

            {/* Social Login */}
            <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>Or continue with</Text>
                <View style={styles.dividerLine} />
            </View>

            <View style={styles.socialContainer}>
                <TouchableOpacity
                    style={styles.socialBtn}
                    onPress={() => {
                        // Ideally use Expo AuthSession or WebBrowser to open:
                        // `${apiUrl}/api/v1/auth/google`
                        Alert.alert("Social Login", "Please implement AuthSession/WebBrowser flow in mobile.");
                    }}
                >
                    <Ionicons name="logo-google" size={24} color={theme.colors.textMain} />
                    <Text style={styles.socialBtnText}>Google</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.socialBtn, { backgroundColor: '#000', borderColor: '#000' }]}
                    onPress={() => {
                        // `${apiUrl}/api/v1/auth/apple`
                        Alert.alert("Social Login", "Please implement AuthSession/WebBrowser flow in mobile.");
                    }}
                >
                    <Ionicons name="logo-apple" size={24} color="#fff" />
                    <Text style={[styles.socialBtnText, { color: '#fff' }]}>Apple</Text>
                </TouchableOpacity>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
                <Text style={styles.footerText}>Don't have an account? </Text>
                <TouchableOpacity onPress={() => router.push('/register')}>
                    <Text style={styles.linkText}>Create one</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
        </KeyboardAvoidingView >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logoContainer: {
        width: 72,
        height: 72,
        borderRadius: 20,
        backgroundColor: theme.colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
        // Shadow
        shadowColor: theme.colors.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
        elevation: 8,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: theme.colors.textMain,
        marginBottom: 8,
        letterSpacing: -0.5,
    },
    subtitle: {
        fontSize: 16,
        color: theme.colors.textMuted,
    },
    form: {
        width: '100%',
    },
    inputContainer: {
        marginBottom: 20,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        color: theme.colors.textSecondary,
        textTransform: 'uppercase',
        marginBottom: 8,
        letterSpacing: 0.5,
    },
    inputWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: theme.colors.surface,
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 14,
        paddingHorizontal: 16,
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        paddingVertical: 16,
        fontSize: 16,
        color: theme.colors.textMain,
    },
    eyeBtn: {
        padding: 4,
    },
    forgotBtn: {
        alignSelf: 'flex-end',
        marginBottom: 24,
    },
    forgotText: {
        fontSize: 14,
        color: theme.colors.primary,
        fontWeight: '600',
    },
    button: {
        backgroundColor: theme.colors.primary,
        borderRadius: 14,
        padding: 18,
        alignItems: 'center',
    },
    buttonDisabled: {
        opacity: 0.7,
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 32,
    },
    footerText: {
        fontSize: 15,
        color: theme.colors.textMuted,
    },
    linkText: {
        fontSize: 15,
        color: theme.colors.primary,
        fontWeight: '600',
    },
    dividerContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 24,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: theme.colors.border,
    },
    dividerText: {
        marginHorizontal: 16,
        color: theme.colors.textMuted,
        fontSize: 14,
    },
    socialContainer: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 8,
    },
    socialBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: theme.colors.border,
        backgroundColor: theme.colors.surface,
        gap: 8,
    },
    socialBtnText: {
        fontSize: 15,
        fontWeight: '600',
        color: theme.colors.textMain,
    },
});
