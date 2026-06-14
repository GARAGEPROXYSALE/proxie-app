import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../context/AppContext';
import { markMessagesRead } from '../lib/db';
import ChatMenuSheet from '../components/ChatMenuSheet';
import OfferModal from '../components/OfferModal';
import MeetupModal from '../components/MeetupModal';
import UserActionSheet from '../components/UserActionSheet';
import colors from '../theme/colors';

const MEETUP_SAFETY_KEY = 'proxie_meetup_safety_seen';

const SAFETY_TIPS = [
  { icon: 'people-outline', text: 'Meet in your building lobby or a public common area' },
  { icon: 'eye-outline', text: 'Bring a friend or let someone know where you\'re going' },
  { icon: 'cash-outline', text: 'Use cash or trusted payment apps — no wire transfers' },
  { icon: 'warning-outline', text: 'Trust your gut. Cancel if anything feels off' },
];

function SafeMeetupBanner({ onDismiss }) {
  return (
    <View style={safetyStyles.banner}>
      <View style={safetyStyles.header}>
        <View style={safetyStyles.iconWrap}>
          <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
        </View>
        <Text style={safetyStyles.title}>Safe Meetup Tips</Text>
        <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close" size={18} color={colors.textLight} />
        </TouchableOpacity>
      </View>
      {SAFETY_TIPS.map((tip) => (
        <View key={tip.icon} style={safetyStyles.tipRow}>
          <Ionicons name={tip.icon} size={15} color={colors.primary} style={safetyStyles.tipIcon} />
          <Text style={safetyStyles.tipText}>{tip.text}</Text>
        </View>
      ))}
      <TouchableOpacity style={safetyStyles.dismissBtn} onPress={onDismiss} activeOpacity={0.8}>
        <Text style={safetyStyles.dismissText}>Got it</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function ChatScreen({ navigation, route }) {
  const { thread, item, prefill } = route.params;
  const { sendMessage, messages, user, markRead, openRatingPrompt } = useApp();
  const [text, setText] = useState(prefill || '');
  const [menuOpen, setMenuOpen] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [meetupOpen, setMeetupOpen] = useState(false);
  const [sellerSheetOpen, setSellerSheetOpen] = useState(false);
  const [showSafetyBanner, setShowSafetyBanner] = useState(false);
  const flatRef = useRef(null);

  // Clear unread count when conversation opens (local state + DB)
  useEffect(() => {
    markRead(thread.id);
    if (thread.dbConversationId && user?.id) {
      markMessagesRead(thread.dbConversationId, user.id).catch(() => {});
    }
  }, [thread.id]);

  // Show safe meetup banner once per install
  useEffect(() => {
    AsyncStorage.getItem(MEETUP_SAFETY_KEY).then((val) => {
      if (!val) setShowSafetyBanner(true);
    }).catch(() => {});
  }, []);

  // Check if seller left a pending rating for us (buyer flow)
  useEffect(() => {
    const key = `proxie_pending_buyer_rating_${thread.id}`;
    AsyncStorage.getItem(key).then((raw) => {
      if (!raw) return;
      try {
        const { item: ratedItem, sellerName } = JSON.parse(raw);
        AsyncStorage.removeItem(key).catch(() => {});
        setTimeout(() => {
          openRatingPrompt({ item: ratedItem, buyerName: sellerName, role: 'buyer' });
        }, 1200);
      } catch {}
    }).catch(() => {});
  }, [thread.id]);

  const dismissSafetyBanner = () => {
    setShowSafetyBanner(false);
    AsyncStorage.setItem(MEETUP_SAFETY_KEY, 'seen').catch(() => {});
  };

  // Always read latest thread from context
  const currentThread = messages.find((m) => m.id === thread.id) || thread;

  const quickReplies = [
    'Is this still available?',
    'Would you take less?',
    'Can I pick up today?',
    'Are you available right now?',
  ];

  const handleSend = () => {
    if (!text.trim()) return;
    sendMessage(currentThread.id, text.trim());
    setText('');
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const handleQuick = (q) => {
    sendMessage(currentThread.id, q);
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
  };

  // ── Message renderers ────────────────────────────────────────

  const renderOfferBubble = (msg, isMe) => (
    <View style={[styles.offerCard, isMe ? styles.offerCardMe : styles.offerCardThem]}>
      <View style={styles.offerHeader}>
        <Ionicons name="cash-outline" size={16} color={isMe ? '#fff' : colors.primary} />
        <Text style={[styles.offerLabel, isMe && styles.offerLabelMe]}>Offer</Text>
      </View>
      <Text style={[styles.offerPrice, isMe && styles.offerPriceMe]}>
        ${msg.offerPrice?.toFixed(0)}
      </Text>
      {msg.offerNote ? (
        <Text style={[styles.offerNote, isMe && styles.offerNoteMe]}>{msg.offerNote}</Text>
      ) : null}
      {!isMe && (
        <View style={styles.offerActions}>
          <TouchableOpacity style={styles.offerAccept}>
            <Text style={styles.offerAcceptText}>Accept</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.offerDecline}>
            <Text style={styles.offerDeclineText}>Counter</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderMeetupBubble = (msg, isMe) => (
    <View style={[styles.meetupCard, isMe ? styles.meetupCardMe : styles.meetupCardThem]}>
      <View style={styles.meetupHeader}>
        <Ionicons name="calendar-outline" size={16} color={isMe ? '#fff' : colors.primary} />
        <Text style={[styles.meetupLabel, isMe && styles.meetupLabelMe]}>Meetup Request</Text>
      </View>
      <Text style={[styles.meetupDay, isMe && styles.meetupDayMe]}>{msg.meetupDay}</Text>
      <Text style={[styles.meetupTime, isMe && styles.meetupTimeMe]}>{msg.meetupTime}</Text>
      {msg.meetupLocation ? (
        <View style={styles.meetupLocRow}>
          <Ionicons name="location-outline" size={13} color={isMe ? 'rgba(255,255,255,0.8)' : colors.primary} />
          <Text style={[styles.meetupLoc, isMe && styles.meetupLocMe]}>{msg.meetupLocation}</Text>
        </View>
      ) : null}
      {!isMe && (
        <View style={styles.offerActions}>
          <TouchableOpacity style={styles.offerAccept}>
            <Text style={styles.offerAcceptText}>Confirm</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.offerDecline}>
            <Text style={styles.offerDeclineText}>Suggest new time</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderMessage = ({ item: msg }) => {
    const isMe = msg.from === user?.id || msg.from === 'me';
    return (
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        {!isMe && (
          <View style={styles.msgAvatar}>
            <Ionicons name="person" size={14} color={colors.primaryLight} />
          </View>
        )}
        <View style={styles.msgContent}>
          {msg.type === 'offer'
            ? renderOfferBubble(msg, isMe)
            : msg.type === 'meetup'
            ? renderMeetupBubble(msg, isMe)
            : (
              <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{msg.text}</Text>
              </View>
            )
          }
          <Text style={[styles.msgTime, isMe && styles.msgTimeMe]}>{msg.time}</Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerCenter} onPress={() => setSellerSheetOpen(true)} activeOpacity={0.7}>
            <View style={styles.headerAvatar}>
              <Ionicons name="person" size={18} color={colors.primaryLight} />
            </View>
            <View style={styles.headerNames}>
              <View style={styles.headerNameRow}>
                <Text style={styles.headerName}>{currentThread.with.name}</Text>
                {currentThread.muted && (
                  <Ionicons name="notifications-off" size={14} color={colors.textLight} />
                )}
                {currentThread.pinned && (
                  <Ionicons name="pin" size={13} color={colors.primary} />
                )}
              </View>
              <Text style={styles.headerListing} numberOfLines={1}>
                {currentThread.listingTitle}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMenuOpen(true)} style={styles.dotsBtn}>
            <Ionicons name="ellipsis-horizontal" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Messages */}
        <FlatList
          ref={flatRef}
          data={currentThread.messages}
          keyExtractor={(m) => m.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
          ListHeaderComponent={() => (
            <>
              {showSafetyBanner && (
                <SafeMeetupBanner onDismiss={dismissSafetyBanner} />
              )}
              {currentThread.messages.length === 0 && !showSafetyBanner ? (
                <View style={styles.emptyChat}>
                  <Ionicons name="chatbubble-outline" size={48} color={colors.primaryLight} />
                  <Text style={styles.emptyChatText}>Start the conversation!</Text>
                  <Text style={styles.emptyChatSub}>Use quick replies below or type a message.</Text>
                </View>
              ) : null}
            </>
          )}
        />

        {/* Quick replies */}
        {currentThread.messages.length < 3 && (
          <View style={styles.quickReplies}>
            {quickReplies.map((q) => (
              <TouchableOpacity key={q} style={styles.quickBtn} onPress={() => handleQuick(q)}>
                <Text style={styles.quickText}>{q}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Input */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Message..."
            placeholderTextColor={colors.textLight}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendBtn, !text.trim() && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!text.trim()}
          >
            <Ionicons name="send" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* 3-dot menu sheet */}
      <ChatMenuSheet
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        thread={currentThread}
        item={item}
        navigation={navigation}
        onOpenOffer={() => setOfferOpen(true)}
        onOpenMeetup={() => setMeetupOpen(true)}
      />

      {/* Offer modal */}
      <OfferModal
        visible={offerOpen}
        onClose={() => setOfferOpen(false)}
        thread={currentThread}
        item={item}
      />

      {/* Meetup modal */}
      <MeetupModal
        visible={meetupOpen}
        onClose={() => setMeetupOpen(false)}
        thread={currentThread}
        item={item}
      />

      {/* Seller action sheet (tap header) */}
      <UserActionSheet
        visible={sellerSheetOpen}
        onClose={() => setSellerSheetOpen(false)}
        seller={currentThread.with}
        listing={item}
        navigation={navigation}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.cardBackground,
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 12,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCE9F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerNames: { flex: 1 },
  headerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  headerName: { fontSize: 15, fontWeight: '700', color: colors.text },
  headerListing: { fontSize: 12, color: colors.primary },
  dotsBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Messages
  messageList: {
    padding: 16,
    gap: 12,
    paddingBottom: 8,
  },
  msgRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 8,
  },
  msgRowMe: {
    flexDirection: 'row-reverse',
  },
  msgAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#DCE9F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgContent: {
    maxWidth: '78%',
    gap: 3,
  },

  // Standard bubble
  bubble: {
    padding: 12,
    borderRadius: 18,
  },
  bubbleThem: {
    backgroundColor: colors.cardBackground,
    borderBottomLeftRadius: 4,
  },
  bubbleMe: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  bubbleTextMe: {
    color: '#fff',
  },
  msgTime: {
    fontSize: 10,
    color: colors.textLight,
    alignSelf: 'flex-start',
  },
  msgTimeMe: {
    alignSelf: 'flex-end',
  },

  // Offer card
  offerCard: {
    borderRadius: 16,
    padding: 14,
    gap: 6,
    minWidth: 180,
  },
  offerCardThem: {
    backgroundColor: colors.cardBackground,
    borderWidth: 1.5,
    borderColor: colors.primary + '40',
    borderBottomLeftRadius: 4,
  },
  offerCardMe: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  offerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  offerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  offerLabelMe: { color: 'rgba(255,255,255,0.8)' },
  offerPrice: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.primary,
  },
  offerPriceMe: { color: '#fff' },
  offerNote: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  offerNoteMe: { color: 'rgba(255,255,255,0.85)' },
  offerActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  offerAccept: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  offerAcceptText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  offerDecline: {
    flex: 1,
    backgroundColor: colors.primary + '15',
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  offerDeclineText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },

  // Meetup card
  meetupCard: {
    borderRadius: 16,
    padding: 14,
    gap: 4,
    minWidth: 200,
  },
  meetupCardThem: {
    backgroundColor: colors.cardBackground,
    borderWidth: 1.5,
    borderColor: colors.success + '50',
    borderBottomLeftRadius: 4,
  },
  meetupCardMe: {
    backgroundColor: colors.success,
    borderBottomRightRadius: 4,
  },
  meetupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  meetupLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.success,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  meetupLabelMe: { color: 'rgba(255,255,255,0.85)' },
  meetupDay: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  meetupDayMe: { color: '#fff' },
  meetupTime: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  meetupTimeMe: { color: 'rgba(255,255,255,0.85)' },
  meetupLocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  meetupLoc: {
    fontSize: 12,
    color: colors.primary,
    flex: 1,
  },
  meetupLocMe: { color: 'rgba(255,255,255,0.9)' },

  // Quick replies
  quickReplies: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  quickBtn: {
    backgroundColor: colors.cardBackground,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },

  // Input bar
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingBottom: 20,
    backgroundColor: colors.cardBackground,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.text,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  sendBtnDisabled: {
    backgroundColor: colors.textLight,
    shadowOpacity: 0,
  },

  // Empty
  emptyChat: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyChatText: { fontSize: 16, fontWeight: '600', color: colors.text },
  emptyChatSub: { fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
});

const safetyStyles = StyleSheet.create({
  banner: {
    margin: 16,
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.primary + '30',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14,
  },
  iconWrap: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: colors.primary + '15',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.text },
  tipRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10,
  },
  tipIcon: { marginTop: 1, flexShrink: 0 },
  tipText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
  dismissBtn: {
    marginTop: 6,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  dismissText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
