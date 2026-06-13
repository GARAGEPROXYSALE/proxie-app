import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  TextInput, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import colors from '../theme/colors';

export default function RatingModal() {
  const { ratingPrompt, submitRating, dismissRating } = useApp();
  const { visible, item, buyerName, role } = ratingPrompt || {};

  const [vote, setVote] = useState(null); // 'up' | 'down'
  const [note, setNote] = useState('');
  const slideY = useRef(new Animated.Value(500)).current;

  useEffect(() => {
    if (visible) {
      setVote(null);
      setNote('');
      Animated.spring(slideY, {
        toValue: 0, bounciness: 3, speed: 14, useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(slideY, {
        toValue: 500, duration: 200, useNativeDriver: false,
      }).start();
    }
  }, [visible]);

  if (!visible) return null;

  const otherParty = role === 'seller' ? (buyerName || 'the buyer') : item?.seller?.name || 'the seller';

  return (
    <Modal transparent visible={!!visible} animationType="none" onRequestClose={dismissRating}>
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={dismissRating} />

        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideY }] }]}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.starIcon}>
              <Ionicons name="ribbon-outline" size={28} color={colors.primary} />
            </View>
            <Text style={styles.title}>Rate the experience</Text>
            <Text style={styles.subtitle}>
              How was your transaction with{'\n'}
              <Text style={styles.partyName}>{otherParty}</Text>?
            </Text>
            <Text style={styles.itemLabel}>"{item?.title}"</Text>
          </View>

          {/* Thumbs voting */}
          <View style={styles.thumbsRow}>
            <TouchableOpacity
              style={[styles.thumbBtn, vote === 'up' && styles.thumbUp]}
              onPress={() => setVote('up')}
              activeOpacity={0.8}
            >
              <Ionicons
                name={vote === 'up' ? 'thumbs-up' : 'thumbs-up-outline'}
                size={34}
                color={vote === 'up' ? '#fff' : colors.success}
              />
              <Text style={[styles.thumbLabel, vote === 'up' && styles.thumbLabelActive]}>
                Positive
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.thumbBtn, vote === 'down' && styles.thumbDown]}
              onPress={() => setVote('down')}
              activeOpacity={0.8}
            >
              <Ionicons
                name={vote === 'down' ? 'thumbs-down' : 'thumbs-down-outline'}
                size={34}
                color={vote === 'down' ? '#fff' : colors.warning}
              />
              <Text style={[styles.thumbLabel, vote === 'down' && styles.thumbLabelActive]}>
                Negative
              </Text>
            </TouchableOpacity>
          </View>

          {/* Note */}
          <TextInput
            style={styles.noteInput}
            value={note}
            onChangeText={setNote}
            placeholder="Leave a note (optional)…"
            placeholderTextColor={colors.textLight}
            multiline
            numberOfLines={2}
            maxLength={200}
          />

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, !vote && styles.submitBtnDisabled]}
            onPress={() => vote && submitRating(vote, note.trim())}
            activeOpacity={vote ? 0.85 : 1}
          >
            <Text style={styles.submitText}>
              {vote ? 'Submit Rating' : 'Select a rating above'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipBtn} onPress={dismissRating} activeOpacity={0.7}>
            <Text style={styles.skipText}>Skip for now</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 24,
    paddingBottom: 44,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  starIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EBF2FB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  partyName: {
    fontWeight: '700',
    color: colors.text,
  },
  itemLabel: {
    fontSize: 13,
    color: colors.textLight,
    marginTop: 4,
    fontStyle: 'italic',
  },

  thumbsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
  },
  thumbBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
    gap: 8,
  },
  thumbUp: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  thumbDown: {
    backgroundColor: colors.warning,
    borderColor: colors.warning,
  },
  thumbLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  thumbLabelActive: {
    color: '#fff',
  },

  noteInput: {
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
    marginBottom: 16,
    minHeight: 60,
    textAlignVertical: 'top',
  },

  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    alignItems: 'center',
    paddingVertical: 15,
    marginBottom: 10,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: {
    backgroundColor: colors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});
