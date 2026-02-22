import React, { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { COLORS } from '../../src/utils/constants';
import { apiService } from '../../src/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function TabsLayout() {
  const { isAdmin, user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  // Check for unread messages
  useEffect(() => {
    const checkUnread = async () => {
      if (!user) return;
      
      try {
        const lastReadTime = await AsyncStorage.getItem('lastChatReadTime');
        const response = await apiService.getMessages();
        const messages = response.data;
        
        if (lastReadTime) {
          const lastRead = new Date(lastReadTime);
          let count = 0;
          messages.forEach(msg => {
            if (new Date(msg.created_at) > lastRead) count++;
            msg.replies.forEach(reply => {
              if (new Date(reply.created_at) > lastRead && reply.user_id !== user.id) count++;
            });
          });
          setUnreadCount(count);
        } else {
          setUnreadCount(messages.length > 0 ? messages.length : 0);
        }
      } catch (error) {
        console.error('Error checking unread:', error);
      }
    };

    checkUnread();
    const interval = setInterval(checkUnread, 30000);
    return () => clearInterval(interval);
  }, [user]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.border,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
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
            <View>
              <Ionicons name="chatbubbles-outline" size={size} color={color} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </View>
          ),
        }}
        listeners={{
          tabPress: () => {
            AsyncStorage.setItem('lastChatReadTime', new Date().toISOString());
            setUnreadCount(0);
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
  badge: {
    position: 'absolute',
    right: -8,
    top: -4,
    backgroundColor: COLORS.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
