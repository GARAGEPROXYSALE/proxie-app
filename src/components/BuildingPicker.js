import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, FlatList,
  StyleSheet, SafeAreaView, TouchableWithoutFeedback,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ROCHDALE_SECTIONS } from '../data/buildings';
import colors from '../theme/colors';

/**
 * BuildingPicker
 *
 * Props:
 *   value        — currently selected building string (or null/empty)
 *   onChange     — (value: string | null) => void
 *   placeholder  — string shown when nothing is selected
 *   style        — optional container style override
 */
export default function BuildingPicker({ value, onChange, placeholder = 'Select your building', style }) {
  const [open, setOpen] = useState(false);

  const handleSelect = (building) => {
    onChange(building.value);
    setOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setOpen(false);
  };

  const renderSectionHeader = (section) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionLabel}>{section}</Text>
    </View>
  );

  const renderBuilding = (building) => {
    const selected = building.value === value;
    return (
      <TouchableOpacity
        key={building.value}
        style={[styles.option, selected && styles.optionSelected]}
        onPress={() => handleSelect(building)}
        activeOpacity={0.7}
      >
        <View style={styles.optionLeft}>
          <View style={[styles.optionDot, selected && styles.optionDotSelected]} />
          <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
            {building.label}
          </Text>
        </View>
        {selected && (
          <Ionicons name="checkmark" size={18} color={colors.primary} />
        )}
      </TouchableOpacity>
    );
  };

  // Build flat data array with section headers for FlatList
  const listData = [];
  ROCHDALE_SECTIONS.forEach((s) => {
    listData.push({ type: 'header', section: s.section, key: `h-${s.section}` });
    s.buildings.forEach((b) => {
      listData.push({ type: 'building', ...b, key: b.value });
    });
  });

  return (
    <>
      {/* Trigger button */}
      <TouchableOpacity
        style={[styles.trigger, style, value && styles.triggerFilled]}
        onPress={() => setOpen(true)}
        activeOpacity={0.7}
      >
        <Ionicons
          name="business-outline"
          size={18}
          color={value ? colors.primary : colors.textLight}
        />
        <Text style={[styles.triggerText, !value && styles.triggerPlaceholder]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textLight} />
      </TouchableOpacity>

      {/* Picker modal */}
      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setOpen(false)}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <View style={styles.sheet}>
          {/* Sheet header */}
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Select Your Building</Text>
            <TouchableOpacity onPress={() => setOpen(false)} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.complex}>
            <Ionicons name="business" size={14} color={colors.primary} />
            <Text style={styles.complexName}>Rochdale Village · South Jamaica, Queens</Text>
          </View>

          <FlatList
            data={listData}
            keyExtractor={(item) => item.key}
            renderItem={({ item }) =>
              item.type === 'header'
                ? renderSectionHeader(item.section)
                : renderBuilding(item)
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
            ListFooterComponent={
              value ? (
                <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
                  <Ionicons name="close-circle-outline" size={16} color={colors.danger} />
                  <Text style={styles.clearText}>Remove building</Text>
                </TouchableOpacity>
              ) : null
            }
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // Trigger
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.cardBackground,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  triggerFilled: {
    borderColor: colors.primary + '60',
    backgroundColor: colors.primary + '08',
  },
  triggerText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  triggerPlaceholder: {
    color: colors.textLight,
    fontWeight: '400',
  },

  // Modal backdrop
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },

  // Bottom sheet
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '72%',
    paddingTop: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.cardBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  complex: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.primary + '0D',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  complexName: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },

  // List
  list: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  sectionHeader: {
    paddingTop: 18,
    paddingBottom: 6,
    paddingHorizontal: 4,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 2,
  },
  optionSelected: {
    backgroundColor: colors.primary + '12',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  optionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  optionDotSelected: {
    backgroundColor: colors.primary,
  },
  optionText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: '400',
  },
  optionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },

  // Clear
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    marginTop: 8,
  },
  clearText: {
    fontSize: 14,
    color: colors.danger,
    fontWeight: '500',
  },
});
