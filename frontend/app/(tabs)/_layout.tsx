import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet, Platform, AppState } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { COLORS } from '../../src/utils/constants';
import { apiService } from '../../src/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_READ_KEY = 'chat_last_read_timestamp';

export default function TabsLayout() {
  const { isAdmin, user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const appState = useRef(AppState.currentState);

  // Check for unread messages using the API
  const checkUnread = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    
    try {
      const lastReadStr = await AsyncStorage.getItem(LAST_READ_KEY);
      const response = await apiService.getUnreadCount(lastReadStr || undefined);
      const count = response.data?.unread_count || 0;
      console.log('[Chat Badge] Unread count from API:', count);
      setUnreadCount(count);
    } catch (error) {
      console.error('Error checking unread messages:', error);
    }
  }, [user]);

  // Check messages when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[Chat Badge] App became active, checking messages...');
        checkUnread();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [checkUnread]);

  // Initial check and interval
  useEffect(() => {
    if (user) {
      checkUnread();
      const interval = setInterval(checkUnread, 5000);
      return () => clearInterval(interval);
    }
  }, [user, checkUnread]);

  // Mark messages as read - chiamato SOLO quando si apre la tab Chat
  const markAsRead = useCallback(async () => {
    console.log('[Chat Badge] Marking as read...');
    await AsyncStorage.setItem(LAST_READ_KEY, new Date().toISOString());
    setUnreadCount(0);
  }, []);

  // Calculate safe tab bar height for different platforms
  const tabBarHeight = Platform.select({
    ios: 100,
    android: 85,
    web: 90,
    default: 90,
  });
  
  const tabBarPaddingBottom = Platform.select({
    ios: 35,
    android: 20,
    web: 25,
    default: 25,
  });

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingBottom: tabBarPaddingBottom,
          paddingTop: 8,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="prenota"
        options={{
          title: 'Prenota',
          href: isAdmin ? null : '/prenota',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="comunicazioni"
        options={{
          title: 'Chat',
          tabBarIcon: ({ color, size }) => (
            <View style={styles.iconContainer}>
              <Ionicons name="chatbubbles-outline" size={size} color={color} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
        listeners={{
          tabPress: () => {
            markAsRead();
          },
          focus: () => {
            markAsRead();
          },
        }}
      />
      <Tabs.Screen
        name="abbonamento"
        options={{
          title: 'Abbonamento',
          href: isAdmin ? null : '/abbonamento',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="card-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          href: isAdmin ? '/admin' : null,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profilo"
        options={{
          title: 'Profilo',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    position: 'relative',
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    right: -10,
    top: -6,
    backgroundColor: '#EF4444',
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    borderWidth: 2,
    borderColor: COLORS.card,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
