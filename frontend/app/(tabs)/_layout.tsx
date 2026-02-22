import React, { useEffect, useState, useCallback } from 'react';
import { Tabs, useFocusEffect } from 'expo-router';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { COLORS } from '../../src/utils/constants';
import { apiService } from '../../src/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_READ_KEY = 'chat_last_read_timestamp';

export default function TabsLayout() {
  const { isAdmin, user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  // Check for unread messages
  const checkUnread = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    
    try {
      const response = await apiService.getMessages();
      const messages = response.data || [];
      
      // Get last read timestamp from storage
      const lastReadStr = await AsyncStorage.getItem(LAST_READ_KEY);
      const lastReadTime = lastReadStr ? new Date(lastReadStr).getTime() : 0;
      
      let count = 0;
      for (const msg of messages) {
        // Count new messages (not from current user if admin)
        const msgTime = new Date(msg.created_at).getTime();
        if (msgTime > lastReadTime) {
          // Don't count own messages for admin
          if (!(isAdmin && msg.sender_id === user.id)) {
            count++;
          }
        }
        
        // Count new replies from others
        const replies = msg.replies || [];
        for (const reply of replies) {
          const replyTime = new Date(reply.created_at).getTime();
          if (replyTime > lastReadTime && reply.user_id !== user.id) {
            count++;
          }
        }
      }
      
      setUnreadCount(count);
    } catch (error) {
      console.error('Error checking unread messages:', error);
    }
  }, [user, isAdmin]);

  useEffect(() => {
    if (user) {
      checkUnread();
      const interval = setInterval(checkUnread, 5000); // Check every 5 seconds
      return () => clearInterval(interval);
    }
  }, [user, checkUnread]);

  // Mark messages as read when entering chat tab
  const markAsRead = useCallback(async () => {
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
