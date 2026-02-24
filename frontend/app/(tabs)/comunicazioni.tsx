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
  Modal,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
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
  
  // Media attachment states
  const [attachment, setAttachment] = useState<{uri: string, type: 'image' | 'video'} | null>(null);
  const [replyAttachment, setReplyAttachment] = useState<{uri: string, type: 'image' | 'video'} | null>(null);
  const [showMediaPicker, setShowMediaPicker] = useState(false);
  const [isReplyMedia, setIsReplyMedia] = useState(false);
  const [fullScreenMedia, setFullScreenMedia] = useState<{uri: string, type: 'image' | 'video'} | null>(null);

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
    if ((!newMessage.trim() && !attachment) || !isAdmin) return;
    
    setSending(true);
    try {
      await apiService.createMessage(newMessage.trim(), attachment?.uri, attachment?.type);
      setNewMessage('');
      setAttachment(null);
      await loadMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Errore', 'Impossibile inviare il messaggio');
    }
    setSending(false);
  };

  const handleSendReply = async (messageId: string) => {
    if (!replyText.trim() && !replyAttachment) return;
    
    setSending(true);
    try {
      await apiService.replyToMessage(messageId, replyText.trim(), replyAttachment?.uri, replyAttachment?.type);
      setReplyText('');
      setReplyAttachment(null);
      setReplyingTo(null);
      await loadMessages();
    } catch (error) {
      console.error('Error sending reply:', error);
      Alert.alert('Errore', 'Impossibile inviare la risposta');
    }
    setSending(false);
  };

  const handleDeleteMessage = async (messageId: string) => {
    Alert.alert(
      '⚠️ Conferma Eliminazione',
      'Sei sicuro di voler eliminare questa comunicazione?',
      [
        { text: 'No', style: 'cancel' },
        { 
          text: 'Sì, Elimina', 
          style: 'destructive',
          onPress: async () => {
            try {
              await apiService.deleteMessage(messageId);
              await loadMessages();
            } catch (error) {
              console.error('Error deleting message:', error);
            }
          }
        }
      ]
    );
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

  // Media picker functions
  const pickImage = async (forReply: boolean = false) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permesso negato', 'Serve il permesso per accedere alla galleria');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
      if (forReply) {
        setReplyAttachment({ uri, type: 'image' });
      } else {
        setAttachment({ uri, type: 'image' });
      }
    }
    setShowMediaPicker(false);
  };

  const pickVideo = async (forReply: boolean = false) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permesso negato', 'Serve il permesso per accedere alla galleria');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      allowsEditing: true,
      quality: 0.5,
      videoMaxDuration: 60,
    });

    if (!result.canceled && result.assets[0]) {
      if (forReply) {
        setReplyAttachment({ uri: result.assets[0].uri, type: 'video' });
      } else {
        setAttachment({ uri: result.assets[0].uri, type: 'video' });
      }
    }
    setShowMediaPicker(false);
  };

  const takePhoto = async (forReply: boolean = false) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permesso negato', 'Serve il permesso per usare la fotocamera');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      const uri = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : asset.uri;
      if (forReply) {
        setReplyAttachment({ uri, type: 'image' });
      } else {
        setAttachment({ uri, type: 'image' });
      }
    }
    setShowMediaPicker(false);
  };

  const openMediaPicker = (forReply: boolean = false) => {
    setIsReplyMedia(forReply);
    setShowMediaPicker(true);
  };

  const removeAttachment = (forReply: boolean = false) => {
    if (forReply) {
      setReplyAttachment(null);
    } else {
      setAttachment(null);
    }
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
                {message.content && <Text style={styles.messageContent}>{message.content}</Text>}
                
                {/* Message Media */}
                {message.media_url && (
                  <TouchableOpacity 
                    style={styles.messageMedia}
                    onPress={() => setFullScreenMedia({ uri: message.media_url!, type: message.media_type as 'image' | 'video' })}
                  >
                    {message.media_type === 'image' ? (
                      <Image source={{ uri: message.media_url }} style={styles.messageImage} resizeMode="cover" />
                    ) : message.media_type === 'video' ? (
                      <View style={styles.messageVideoContainer}>
                        <Ionicons name="play-circle" size={48} color={COLORS.primary} />
                        <Text style={styles.videoText}>Tocca per riprodurre</Text>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                )}

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
                        {reply.content && <Text style={styles.replyContent}>{reply.content}</Text>}
                        
                        {/* Reply Media */}
                        {reply.media_url && (
                          <TouchableOpacity 
                            style={[styles.messageMedia, { marginLeft: 46 }]}
                            onPress={() => setFullScreenMedia({ uri: reply.media_url!, type: reply.media_type as 'image' | 'video' })}
                          >
                            {reply.media_type === 'image' ? (
                              <Image source={{ uri: reply.media_url }} style={styles.messageImage} resizeMode="cover" />
                            ) : reply.media_type === 'video' ? (
                              <View style={styles.messageVideoContainer}>
                                <Ionicons name="play-circle" size={36} color={COLORS.primary} />
                              </View>
                            ) : null}
                          </TouchableOpacity>
                        )}
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
            {/* Attachment Preview */}
            {attachment && (
              <View style={styles.attachmentPreview}>
                {attachment.type === 'image' ? (
                  <Image source={{ uri: attachment.uri }} style={styles.attachmentImage} />
                ) : (
                  <View style={styles.videoPlaceholder}>
                    <Ionicons name="videocam" size={24} color={COLORS.text} />
                    <Text style={styles.videoText}>Video</Text>
                  </View>
                )}
                <TouchableOpacity 
                  style={styles.removeAttachment}
                  onPress={() => removeAttachment(false)}
                >
                  <Ionicons name="close-circle" size={24} color={COLORS.error} />
                </TouchableOpacity>
              </View>
            )}
            
            <View style={styles.inputRow}>
              <TouchableOpacity 
                style={styles.attachButton}
                onPress={() => openMediaPicker(false)}
              >
                <Ionicons name="attach" size={26} color={COLORS.primary} />
              </TouchableOpacity>
              
              <TextInput
                style={styles.input}
                placeholder="Scrivi una comunicazione..."
                placeholderTextColor={COLORS.textSecondary}
                value={newMessage}
                onChangeText={setNewMessage}
                multiline
              />
              <TouchableOpacity 
                style={[styles.sendButton, (!newMessage.trim() && !attachment) && styles.sendButtonDisabled]}
                onPress={handleSendMessage}
                disabled={(!newMessage.trim() && !attachment) || sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={COLORS.text} />
                ) : (
                  <Ionicons name="send" size={24} color={COLORS.text} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Media Picker Modal */}
        <Modal
          visible={showMediaPicker}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowMediaPicker(false)}
        >
          <TouchableOpacity 
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowMediaPicker(false)}
          >
            <View style={styles.mediaPickerModal}>
              <Text style={styles.mediaPickerTitle}>Allega Media</Text>
              
              <TouchableOpacity 
                style={styles.mediaOption}
                onPress={() => takePhoto(isReplyMedia)}
              >
                <Ionicons name="camera" size={28} color={COLORS.primary} />
                <Text style={styles.mediaOptionText}>Scatta Foto</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.mediaOption}
                onPress={() => pickImage(isReplyMedia)}
              >
                <Ionicons name="image" size={28} color={COLORS.success} />
                <Text style={styles.mediaOptionText}>Scegli dalla Galleria</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.mediaOption}
                onPress={() => pickVideo(isReplyMedia)}
              >
                <Ionicons name="videocam" size={28} color={COLORS.warning} />
                <Text style={styles.mediaOptionText}>Scegli Video</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.cancelMediaButton}
                onPress={() => setShowMediaPicker(false)}
              >
                <Text style={styles.cancelMediaText}>Annulla</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Full Screen Media Viewer */}
        <Modal
          visible={!!fullScreenMedia}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setFullScreenMedia(null)}
        >
          <View style={styles.fullScreenModal}>
            <TouchableOpacity 
              style={styles.closeFullScreen}
              onPress={() => setFullScreenMedia(null)}
            >
              <Ionicons name="close" size={32} color={COLORS.text} />
            </TouchableOpacity>
            {fullScreenMedia?.type === 'image' ? (
              <Image 
                source={{ uri: fullScreenMedia.uri }} 
                style={styles.fullScreenImage}
                resizeMode="contain"
              />
            ) : fullScreenMedia?.type === 'video' ? (
              <View style={styles.videoFullScreenPlaceholder}>
                <Ionicons name="videocam" size={64} color={COLORS.primary} />
                <Text style={styles.videoFullScreenText}>Video</Text>
                <TouchableOpacity 
                  style={styles.openVideoButton}
                  onPress={() => {
                    if (fullScreenMedia?.uri) {
                      Linking.openURL(fullScreenMedia.uri);
                    }
                  }}
                >
                  <Text style={styles.openVideoButtonText}>Apri Video</Text>
                </TouchableOpacity>
              </View>
            ) : null}
          </View>
        </Modal>
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
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontSize: 24,
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
    padding: 16,
    paddingBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    marginTop: 16,
  },
  messageCard: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.primary,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  senderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: COLORS.text,
    fontWeight: 'bold',
    fontSize: 16,
  },
  senderName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  adminTag: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  messageTime: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  messageContent: {
    fontSize: 16,
    color: COLORS.text,
    lineHeight: 24,
  },
  repliesContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  replyCard: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    marginLeft: 20,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.success,
  },
  replyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  replyAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  replyAvatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.success + '40',
    justifyContent: 'center',
    alignItems: 'center',
  },
  replyAvatarText: {
    color: COLORS.text,
    fontWeight: 'bold',
    fontSize: 13,
  },
  replyInfo: {
    flex: 1,
  },
  replyName: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  replyTime: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  replyContent: {
    fontSize: 15,
    color: COLORS.text,
    lineHeight: 22,
    marginLeft: 46,
  },
  replyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingVertical: 8,
  },
  replyButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  replyInputContainer: {
    marginTop: 14,
  },
  replyInput: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 14,
    color: COLORS.text,
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  replyActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
  },
  cancelButton: {
    padding: 10,
  },
  cancelButtonText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  sendReplyButton: {
    backgroundColor: COLORS.primary,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 14,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 14,
    color: COLORS.text,
    fontSize: 16,
    maxHeight: 120,
    minHeight: 50,
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  // Attachment styles
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  attachButton: {
    padding: 8,
  },
  attachmentPreview: {
    marginBottom: 12,
    position: 'relative',
  },
  attachmentImage: {
    width: '100%',
    height: 150,
    borderRadius: 12,
  },
  videoPlaceholder: {
    width: '100%',
    height: 100,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  videoText: {
    color: COLORS.text,
    fontSize: 14,
  },
  removeAttachment: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: COLORS.background,
    borderRadius: 12,
  },
  // Media Picker Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  mediaPickerModal: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  mediaPickerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    textAlign: 'center',
    marginBottom: 24,
  },
  mediaOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  mediaOptionText: {
    fontSize: 17,
    color: COLORS.text,
  },
  cancelMediaButton: {
    marginTop: 20,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelMediaText: {
    fontSize: 17,
    color: COLORS.error,
    fontWeight: '600',
  },
  // Full Screen Media
  fullScreenModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeFullScreen: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  fullScreenImage: {
    width: '100%',
    height: '80%',
  },
  fullScreenVideo: {
    width: '100%',
    height: '80%',
  },
  videoFullScreenPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  videoFullScreenText: {
    color: COLORS.text,
    fontSize: 18,
  },
  openVideoButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  openVideoButtonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  // Media in messages
  messageMedia: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  messageImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  messageVideoContainer: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    position: 'absolute',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 30,
    padding: 12,
  },
});
