import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import colors from '../theme/colors';

export default function SaveToast({ visible, onNavigate }) {
  const translateY = useRef(new Animated.Value(80)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: false,
          bounciness: 8,
          speed: 14,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 80,
          duration: 250,
          useNativeDriver: false,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start();
    }
  }, [visible]);

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY }], opacity, pointerEvents: visible ? 'box-none' : 'none' }]}
    >
      <View style={styles.toast}>
        {/* Left: lock + label */}
        <View style={styles.left}>
          <View style={styles.lockCircle}>
            <Ionicons name="lock-closed" size={13} color="#fff" />
          </View>
          <View>
            <Text style={styles.savedText}>Saved</Text>
            <Text style={styles.privacyText}>Only you</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Right: view all arrow */}
        <TouchableOpacity style={styles.right} onPress={onNavigate} activeOpacity={0.7}>
          <Text style={styles.viewText}>View saves</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
    zIndex: 999,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
    gap: 12,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  lockCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 18,
  },
  privacyText: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 14,
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 4,
  },
  viewText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
});
