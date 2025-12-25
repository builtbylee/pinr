import React, { useEffect } from 'react';
import { StyleSheet, Text, View, Animated, Dimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useMemoryStore } from '../store/useMemoryStore';

const { width } = Dimensions.get('window');

export const ToastNotification = () => {
    const { toast, hideToast } = useMemoryStore();
    const translateY = new Animated.Value(-100);

    useEffect(() => {
        if (toast.visible) {
            // Slide Down
            Animated.spring(translateY, {
                toValue: 50, // Top margin
                useNativeDriver: true,
                friction: 8,
            }).start();

            // Auto Hide
            const timer = setTimeout(() => {
                hideToast();
            }, 3000);

            return () => clearTimeout(timer);
        } else {
            // Slide Up
            Animated.timing(translateY, {
                toValue: -100,
                duration: 300,
                useNativeDriver: true,
            }).start();
        }
    }, [toast.visible]);

    if (!toast.visible) return null;

    const getIcon = () => {
        switch (toast.type) {
            case 'success': return 'check-circle';
            case 'error': return 'alert-circle';
            case 'info': return 'info';
            default: return 'check-circle';
        }
    };

    const getColor = () => {
        switch (toast.type) {
            case 'success': return '#4CD964'; // iOS Green
            case 'error': return '#FF3B30'; // iOS Red
            case 'info': return '#007AFF'; // iOS Blue
            default: return '#1a1a1a';
        }
    };

    return (
        <Animated.View style={[styles.container, { transform: [{ translateY }] }]}>
            <View style={[styles.blur, { backgroundColor: 'rgba(255, 255, 255, 0.98)' }]}>
                <View style={styles.content}>
                    <View style={[styles.iconContainer, { backgroundColor: getColor() }]}>
                        <Feather name={getIcon()} size={20} color="white" />
                    </View>
                    <Text style={styles.message}>{toast.message}</Text>
                </View>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        top: 0,
        left: 20,
        right: 20,
        alignItems: 'center',
        zIndex: 9999, // Topmost
    },
    blur: {
        borderRadius: 24,
        overflow: 'hidden',
        width: '100%',
        maxWidth: 400,
    },
    content: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: 'rgba(255,255,255,0.8)',
    },
    iconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    message: {
        fontSize: 14,
        fontWeight: '600',
        color: '#1a1a1a',
        flex: 1,
    },
});
