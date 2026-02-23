import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiService, Message } from '../../src/services/api';
import { useAuth } from '../../src/context/AuthContext';
import { COLORS } from '../../src/utils/constants';

const LAST_READ_KEY = 'chat_last_read_timestamp';

export default function ComunicazioniScreen() {
  const { isAdmin, user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Mark messages as read when screen is focused
  const markAsRead = useCallback(async () => {
    await AsyncStorage.setItem(LAST_READ_KEY, new Date().toISOString());
  }, []);

  const loadMessages = async () => {
    try {
      const response = await apiService.getMessages();
      setMessages(response.data);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadMessages();
      markAsRead(); // Mark as read when screen comes into focus
    }, [markAsRead])
  );

  // Auto-refresh every 5 seconds for real-time chat
  useEffect(() => {
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMessages();
    markAsRead(); // Mark as read on refresh
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !isAdmin) return;
    
    setSending(true);
    try {
      await apiService.createMessage(newMessage.trim());
      setNewMessage('');
      await loadMessages();
    } catch (error) {
      console.error('Error sending message:', error);
    }
    setSending(false);
  };

  const handleSendReply = async (messageId: string) => {
    if (!replyText.trim()) return;
    
    setSending(true);
    try {
      await apiService.replyToMessage(messageId, replyText.trim());
      setReplyText('');
      setReplyingTo(null);
      await loadMessages();
    } catch (error) {
      console.error('Error sending reply:', error);
    }
    setSending(false);
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      await apiService.deleteMessage(messageId);
      await loadMessages();
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Adesso';
    if (diffMins < 60) return `${diffMins} min fa`;
    if (diffHours < 24) return `${diffHours} ore fa`;
    if (diffDays < 7) return `${diffDays} giorni fa`;
    return date.toLocaleDateString('it-IT');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Comunicazioni</Text>
          <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
            <Ionicons name="refresh" size={24} color={COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* Messages List */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />
          }
        >
          {messages.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="chatbubbles-outline" size={64} color={COLORS.textSecondary} />
              <Text style={styles.emptyText}>Nessuna comunicazione</Text>
            </View>
          ) : (
            messages.map((message) => (
              <View key={message.id} style={styles.messageCard}>
                {/* Message Header */}
                <View style={styles.messageHeader}>
                  <View style={styles.senderInfo}>
                    {message.sender_profile_image ? (
                      <Image source={{ uri: message.sender_profile_image }} style={styles.avatar} />
                    ) : (
                      <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarText}>
                          {message.sender_nome?.[0]}{message.sender_cognome?.[0]}
                        </Text>
                      </View>
                    )}
                    <View>
                      <Text style={styles.senderName}>
                        {message.sender_nome} {message.sender_cognome}
                        {message.is_admin_message && (
                          <Text style={styles.adminTag}> (Admin)</Text>
                        )}
                      </Text>
                      <Text style={styles.messageTime}>{formatDate(message.created_at)}</Text>
                    </View>
                  </View>
                  {isAdmin && (
                    <TouchableOpacity onPress={() => handleDeleteMessage(message.id)}>
                      <Ionicons name="trash-outline" size={20} color={COLORS.error} />
                    </TouchableOpacity>
                  )}
                </View>

                {/* Message Content */}
                <Text style={styles.messageContent}>{message.content}</Text>

                {/* Replies */}
                {message.replies.length > 0 && (
                  <View style={styles.repliesContainer}>
                    {message.replies.map((reply) => (
                      <View key={reply.id} style={styles.replyCard}>
                        <View style={styles.replyHeader}>
                          {reply.user_profile_image ? (
                            <Image source={{ uri: reply.user_profile_image }} style={styles.replyAvatar} />
                          ) : (
                            <View style={styles.replyAvatarPlaceholder}>
                              <Text style={styles.replyAvatarText}>
                                {reply.user_nome?.[0]}{reply.user_cognome?.[0]}
                              </Text>
                            </View>
                          )}
                          <View style={styles.replyInfo}>
                            <Text style={styles.replyName}>{reply.user_nome} {reply.user_cognome}</Text>
                            <Text style={styles.replyTime}>{formatDate(reply.created_at)}</Text>
                          </View>
                        </View>
                        <Text style={styles.replyContent}>{reply.content}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Reply Input */}
                {replyingTo === message.id ? (
                  <View style={styles.replyInputContainer}>
                    <TextInput
                      style={styles.replyInput}
                      placeholder="Scrivi una risposta..."
                      placeholderTextColor={COLORS.textSecondary}
                      value={replyText}
                      onChangeText={setReplyText}
                      multiline
                    />
                    <View style={styles.replyActions}>
                      <TouchableOpacity onPress={() => setReplyingTo(null)} style={styles.cancelButton}>
                        <Text style={styles.cancelButtonText}>Annulla</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        onPress={() => handleSendReply(message.id)} 
                        style={styles.sendReplyButton}
                        disabled={sending}
                      >
                        {sending ? (
                          <ActivityIndicator size="small" color={COLORS.text} />
                        ) : (
                          <Ionicons name="send" size={18} color={COLORS.text} />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity 
                    style={styles.replyButton}
                    onPress={() => setReplyingTo(message.id)}
                  >
                    <Ionicons name="chatbubble-outline" size={16} color={COLORS.primary} />
                    <Text style={styles.replyButtonText}>Rispondi</Text>
                  </TouchableOpacity>
                )}
              </View>
            ))
          )}
        </ScrollView>

        {/* New Message Input (Admin Only) */}
        {isAdmin && (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Scrivi una comunicazione..."
              placeholderTextColor={COLORS.textSecondary}
              value={newMessage}
              onChangeText={setNewMessage}
              multiline
            />
            <TouchableOpacity 
              style={[styles.sendButton, !newMessage.trim() && styles.sendButtonDisabled]}
              onPress={handleSendMessage}
              disabled={!newMessage.trim() || sending}
            >
              {sending ? (
                <ActivityIndicator size="small" color={COLORS.text} />
              ) : (
                <Ionicons name="send" size={24} color={COLORS.text} />
              )}
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  keyboardView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  refreshButton: {
    padding: 8,
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 10,
    marginTop: 16,
  },
  messageCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  senderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: COLORS.text,
    fontWeight: 'bold',
    fontSize: 10,
  },
  senderName: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.text,
  },
  adminTag: {
    color: COLORS.primary,
    fontSize: 10,
  },
  messageTime: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  messageContent: {
    fontSize: 10,
    color: COLORS.text,
    lineHeight: 22,
  },
  repliesContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  replyCard: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  replyAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  replyAvatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primary + '60',
    justifyContent: 'center',
    alignItems: 'center',
  },
  replyAvatarText: {
    color: COLORS.text,
    fontWeight: 'bold',
    fontSize: 10,
  },
  replyInfo: {
    flex: 1,
  },
  replyName: {
    fontSize: 10,
    fontWeight: '600',
    color: COLORS.text,
  },
  replyTime: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  replyContent: {
    fontSize: 10,
    color: COLORS.text,
    marginLeft: 36,
  },
  replyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  replyButtonText: {
    color: COLORS.primary,
    fontSize: 10,
  },
  replyInputContainer: {
    marginTop: 12,
  },
  replyInput: {
    backgroundColor: COLORS.background,
    borderRadius: 8,
    padding: 12,
    color: COLORS.text,
    fontSize: 10,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  replyActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    padding: 8,
  },
  cancelButtonText: {
    color: COLORS.textSecondary,
  },
  sendReplyButton: {
    backgroundColor: COLORS.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: COLORS.text,
    fontSize: 10,
    maxHeight: 100,
    minHeight: 44,
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
