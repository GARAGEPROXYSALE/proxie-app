import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  TextInput, Animated, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import colors from '../theme/colors';

export default function MarkSoldModal() {
  const { markSoldModal, closeMarkSoldModal, confirmMarkSold } = useApp();
  const { visible, item } = markSoldModal || {};

  const [buyerName, setBuyerName] = useState('');
  const slideY = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (visible) {
      setBuyerName('');
      Animated.spring(slideY, {
        toValue: 0, bounciness: 4, speed: 14, useNativeDriver: false,
      }).start();
    } else {
      Animated.timing(slideY, {
        toValue: 400, duration: 200, useNativeDriver: false,
      }).start();
    }
  }, [visible]);

  if (!visible && !item) return null;

  return (
    <Modal transparent visible={!!visible} animationType="none" onRequestClose={closeMarkSoldModal}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={closeMarkSoldModal} />

        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideY }] }]}>
          {/* Handle */}
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View style={styles.soldIcon}>
              <Ionicons name="checkmark-circle" size={28} color={colors.success} />
            </View>
            <Text style={styles.title}>Mark as Sold</Text>
            <Text style={styles.subtitle}>
              "{item?.title}" — ${item?.price}
            </Text>
          </View>

          {/* Buyer name */}
          <View style={styles.section}>
            <Text style={styles.label}>Who bought it? <Text style={styles.optional}>(optional)</Text></Text>
            <TextInput
              style={styles.input}
              value={buyerName}
              onChangeText={setBuyerName}
              placeholder="Enter buyer's name or leave blank"
              placeholderTextColor={colors.textLight}
              autoCapitalize="words"
              returnKeyType="done"
            />
            <Text style={styles.hint}>
              If you enter a name, they'll be asked to verify the purchase and both of you can rate the experience.
            </Text>
          </View>

          {/* Actions */}
          <TouchableOpacity
            style={styles.confirmBtn}
            onPress={() => confirmMarkSold(item?.id, buyerName.trim())}
            activeOpacity={0.85}
          >
            <Ionicons name="checkmark" size={18} color="#fff" />
            <Text style={styles.confirmText}>Confirm Sale</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={closeMarkSoldModal} activeOpacity={0.7}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Animated.View>
      </KeyboardAvoidingView>
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
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
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
  soldIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E8F8EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
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
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.text,
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    color: colors.textLight,
    lineHeight: 17,
  },
  confirmBtn: {
    backgroundColor: colors.success,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    gap: 8,
    marginBottom: 10,
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  cancelText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
});
