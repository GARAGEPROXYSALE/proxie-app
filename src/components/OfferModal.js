import React, { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
  TextInput, Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import colors from '../theme/colors';

export default function OfferModal({ visible, onClose, thread, item }) {
  const { sendMessage, messages } = useApp();
  const [price, setPrice] = useState('');
  const [note, setNote] = useState('');

  const currentThread = messages.find((t) => t.id === thread?.id) || thread;
  const originalPrice = item?.price;
  const canSubmit = price.trim().length > 0 && parseFloat(price) > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    const offerText = `💰 Offer: $${parseFloat(price).toFixed(0)}${note.trim() ? ` — ${note.trim()}` : ''}`;
    sendMessage(currentThread.id, offerText, {
      type: 'offer',
      offerPrice: parseFloat(price),
      offerNote: note.trim(),
    });
    setPrice('');
    setNote('');
    onClose();
  };

  const handleClose = () => {
    setPrice('');
    setNote('');
    onClose();
  };

  const discount = originalPrice && price
    ? Math.round(((originalPrice - parseFloat(price)) / originalPrice) * 100)
    : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.avoidContainer}
      >
        <View style={styles.sheet}>
          {/* Handle */}
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.title}>Make an Offer</Text>
            <View style={{ width: 24 }} />
          </View>

          {/* Listing context */}
          {item && (
            <View style={styles.listingCtx}>
              <Ionicons name="pricetag-outline" size={14} color={colors.primary} />
              <Text style={styles.listingName} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.listingPrice}>Listed at ${originalPrice}</Text>
            </View>
          )}

          {/* Price input */}
          <View style={styles.field}>
            <Text style={styles.label}>Your offer price</Text>
            <View style={styles.priceRow}>
              <View style={styles.dollarSign}>
                <Text style={styles.dollarText}>$</Text>
              </View>
              <TextInput
                style={styles.priceInput}
                placeholder="0"
                placeholderTextColor={colors.textLight}
                value={price}
                onChangeText={(t) => setPrice(t.replace(/[^0-9.]/g, ''))}
                keyboardType="decimal-pad"
                maxLength={8}
                autoFocus
              />
              {discount !== null && !isNaN(discount) && discount > 0 && (
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>{discount}% off</Text>
                </View>
              )}
            </View>
          </View>

          {/* Note */}
          <View style={styles.field}>
            <Text style={styles.label}>Add a note <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput
              style={styles.noteInput}
              placeholder="e.g. Can I pick up this weekend?"
              placeholderTextColor={colors.textLight}
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={200}
              textAlignVertical="top"
            />
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, !canSubmit && styles.submitDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            <Ionicons name="send-outline" size={18} color="#fff" />
            <Text style={styles.submitText}>Send Offer</Text>
          </TouchableOpacity>

          <Text style={styles.hint}>
            Your offer will be sent as a message. The seller can accept, counter, or decline.
          </Text>

          <View style={{ height: 24 }} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  avoidContainer: {
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 20,
  },
  handleRow: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    marginBottom: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },

  listingCtx: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 20,
  },
  listingName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  listingPrice: {
    fontSize: 13,
    color: colors.textSecondary,
  },

  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  optional: {
    fontWeight: '400',
    color: colors.textLight,
    fontSize: 13,
  },

  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.primary,
    overflow: 'hidden',
  },
  dollarSign: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: colors.primary + '10',
  },
  dollarText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  priceInput: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  discountBadge: {
    backgroundColor: colors.success + '20',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 10,
  },
  discountText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.success,
  },

  noteInput: {
    backgroundColor: colors.cardBackground,
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    height: 80,
  },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 15,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 10,
  },
  submitDisabled: {
    backgroundColor: colors.textLight,
    shadowOpacity: 0,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  hint: {
    fontSize: 12,
    color: colors.textLight,
    textAlign: 'center',
    lineHeight: 17,
  },
});
