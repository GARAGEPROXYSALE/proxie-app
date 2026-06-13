import React, { useState } from 'react';
import {
  View, Text, Modal, TouchableOpacity, StyleSheet,
  TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import colors from '../theme/colors';

const TIME_SLOTS = [
  'Morning (8am–12pm)',
  'Afternoon (12pm–5pm)',
  'Evening (5pm–8pm)',
  'Flexible',
];

// Quick day options
function quickDays() {
  const days = ['Today', 'Tomorrow'];
  const d = new Date();
  for (let i = 2; i <= 5; i++) {
    const next = new Date(d);
    next.setDate(d.getDate() + i);
    days.push(next.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }));
  }
  return days;
}

export default function MeetupModal({ visible, onClose, thread, item }) {
  const { sendMessage, messages } = useApp();
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [location, setLocation] = useState('');

  const currentThread = messages.find((t) => t.id === thread?.id) || thread;
  const canSubmit = selectedDay && selectedTime;
  const DAYS = quickDays();

  const handleSubmit = () => {
    if (!canSubmit) return;
    const locPart = location.trim() ? ` at ${location.trim()}` : '';
    const meetupText = `📅 Meetup request: ${selectedDay} · ${selectedTime}${locPart}`;
    sendMessage(currentThread.id, meetupText, {
      type: 'meetup',
      meetupDay: selectedDay,
      meetupTime: selectedTime,
      meetupLocation: location.trim() || null,
    });
    reset();
    onClose();
  };

  const reset = () => {
    setSelectedDay(null);
    setSelectedTime(null);
    setLocation('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

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
            <Text style={styles.title}>Schedule a Meetup</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Listing context */}
            {item && (
              <View style={styles.listingCtx}>
                <Ionicons name="storefront-outline" size={14} color={colors.primary} />
                <Text style={styles.listingName} numberOfLines={1}>{item.title}</Text>
              </View>
            )}

            {/* Day picker */}
            <Text style={styles.label}>Pick a day</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.dayScroll} contentContainerStyle={styles.dayScrollContent}>
              {DAYS.map((day) => (
                <TouchableOpacity
                  key={day}
                  style={[styles.dayChip, selectedDay === day && styles.dayChipSelected]}
                  onPress={() => setSelectedDay(day)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.dayText, selectedDay === day && styles.dayTextSelected]}>{day}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Time picker */}
            <Text style={styles.label}>Time preference</Text>
            <View style={styles.timeGrid}>
              {TIME_SLOTS.map((slot) => (
                <TouchableOpacity
                  key={slot}
                  style={[styles.timeChip, selectedTime === slot && styles.timeChipSelected]}
                  onPress={() => setSelectedTime(slot)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.timeText, selectedTime === slot && styles.timeTextSelected]}>{slot}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Location */}
            <Text style={styles.label}>Meetup location <Text style={styles.optional}>(optional)</Text></Text>
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={18} color={colors.primary} />
              <TextInput
                style={styles.locationInput}
                placeholder="e.g. Building lobby, front desk, corner store..."
                placeholderTextColor={colors.textLight}
                value={location}
                onChangeText={setLocation}
                maxLength={120}
              />
            </View>

            {/* Summary preview */}
            {canSubmit && (
              <View style={styles.preview}>
                <Ionicons name="calendar-outline" size={16} color={colors.primary} />
                <Text style={styles.previewText}>
                  {selectedDay} · {selectedTime}{location.trim() ? ` · ${location.trim()}` : ''}
                </Text>
              </View>
            )}

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, !canSubmit && styles.submitDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
              activeOpacity={0.85}
            >
              <Ionicons name="send-outline" size={18} color="#fff" />
              <Text style={styles.submitText}>Send Meetup Request</Text>
            </TouchableOpacity>

            <Text style={styles.hint}>
              A meetup card will be sent in the chat. Both you and the seller can confirm or suggest changes.
            </Text>

            <View style={{ height: 32 }} />
          </ScrollView>
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
    maxHeight: '88%',
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

  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 10,
    marginTop: 4,
  },
  optional: {
    fontWeight: '400',
    color: colors.textLight,
    fontSize: 13,
  },

  // Day picker
  dayScroll: { marginBottom: 20 },
  dayScrollContent: { gap: 8, paddingRight: 8 },
  dayChip: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  dayChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  dayText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  dayTextSelected: {
    color: '#fff',
  },

  // Time grid
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  timeChip: {
    backgroundColor: colors.cardBackground,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  timeChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  timeTextSelected: {
    color: '#fff',
    fontWeight: '600',
  },

  // Location
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.cardBackground,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  locationInput: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },

  // Preview
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary + '12',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  previewText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },

  // Submit
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
