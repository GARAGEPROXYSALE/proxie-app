import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  Modal, TextInput, FlatList, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import colors from '../theme/colors';

export default function CollectionModal() {
  const {
    collectionModal,
    closeCollectionModal,
    collections,
    itemCollections,
    saveToCollection,
    createCollection,
  } = useApp();

  const { visible, item } = collectionModal;

  const slideY = useRef(new Animated.Value(500)).current;
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmoji, setNewEmoji] = useState('📁');
  const [selected, setSelected] = useState(null);

  const emojiOptions = ['📁', '🛋️', '📱', '👗', '📚', '🍳', '⚽', '🎮', '✨', '❤️'];

  useEffect(() => {
    if (visible) {
      setCreatingNew(false);
      setNewName('');
      setSelected(null);
      Animated.spring(slideY, {
        toValue: 0,
        useNativeDriver: false,
        bounciness: 4,
        speed: 14,
      }).start();
    } else {
      Animated.timing(slideY, {
        toValue: 500,
        duration: 280,
        useNativeDriver: false,
      }).start();
    }
  }, [visible]);

  const currentlySaved = item ? (itemCollections[item.id] || []) : [];

  const handleToggleCollection = (colId) => {
    setSelected(colId === selected ? null : colId);
  };

  const handleSave = () => {
    if (!item) return;
    const targetId = selected || 'saved-all';
    saveToCollection(item.id, targetId);
  };

  const handleCreateAndSave = () => {
    if (!newName.trim() || !item) return;
    const newId = createCollection(newName.trim(), newEmoji);
    saveToCollection(item.id, newId);
    setCreatingNew(false);
    setNewName('');
  };

  if (!visible && !item) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={closeCollectionModal}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={closeCollectionModal} />

        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideY }] }]}>
          {/* Handle bar */}
          <View style={styles.handle} />

          <Text style={styles.title}>Save to...</Text>

          {/* Item preview pill */}
          {item && (
            <View style={styles.itemPill}>
              <Ionicons name="pricetag-outline" size={14} color={colors.primary} />
              <Text style={styles.itemPillText} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.itemPillPrice}>${item.price}</Text>
            </View>
          )}

          {/* Collections list */}
          <FlatList
            data={collections}
            keyExtractor={(c) => c.id}
            style={styles.list}
            scrollEnabled={collections.length > 4}
            renderItem={({ item: col }) => {
              const isSaved = currentlySaved.includes(col.id);
              const isSelected = selected === col.id;
              return (
                <TouchableOpacity
                  style={[styles.collectionRow, (isSaved || isSelected) && styles.collectionRowActive]}
                  onPress={() => !isSaved && handleToggleCollection(col.id)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.colEmoji, (isSaved || isSelected) && styles.colEmojiActive]}>
                    <Text style={styles.emojiText}>{col.emoji}</Text>
                  </View>
                  <View style={styles.colInfo}>
                    <Text style={styles.colName}>{col.name}</Text>
                    <Text style={styles.colCount}>{col.count} {col.count === 1 ? 'item' : 'items'}</Text>
                  </View>
                  <View style={[styles.checkbox, (isSaved || isSelected) && styles.checkboxActive]}>
                    {(isSaved || isSelected) && (
                      <Ionicons name={isSaved ? 'checkmark' : 'checkmark'} size={14} color="#fff" />
                    )}
                  </View>
                </TouchableOpacity>
              );
            }}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
          />

          {/* Create new collection */}
          {!creatingNew ? (
            <TouchableOpacity style={styles.createRow} onPress={() => setCreatingNew(true)} activeOpacity={0.8}>
              <View style={styles.createIcon}>
                <Ionicons name="add" size={20} color={colors.primary} />
              </View>
              <Text style={styles.createText}>Create new collection</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.createForm}>
              {/* Emoji picker */}
              <View style={styles.emojiRow}>
                {emojiOptions.map((e) => (
                  <TouchableOpacity
                    key={e}
                    style={[styles.emojiBtn, newEmoji === e && styles.emojiBtnActive]}
                    onPress={() => setNewEmoji(e)}
                  >
                    <Text style={styles.emojiBtnText}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.createInputRow}>
                <Text style={styles.selectedEmoji}>{newEmoji}</Text>
                <TextInput
                  style={styles.createInput}
                  placeholder="Collection name"
                  placeholderTextColor={colors.textLight}
                  value={newName}
                  onChangeText={setNewName}
                  autoFocus
                  maxLength={40}
                />
                <TouchableOpacity
                  style={[styles.createSaveBtn, !newName.trim() && styles.createSaveBtnDisabled]}
                  onPress={handleCreateAndSave}
                  disabled={!newName.trim()}
                >
                  <Text style={styles.createSaveBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Bottom actions */}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={closeCollectionModal}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.doneBtn, !selected && styles.doneBtnDim]}
              onPress={handleSave}
              disabled={!selected}
            >
              <Ionicons name="bookmark" size={16} color="#fff" />
              <Text style={styles.doneBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
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
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 34,
    paddingTop: 12,
    maxHeight: '80%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  itemPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  itemPillText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    fontWeight: '500',
  },
  itemPillPrice: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '700',
  },

  list: {
    maxHeight: 260,
    marginBottom: 4,
  },
  collectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderRadius: 12,
    gap: 12,
  },
  collectionRowActive: {
    backgroundColor: colors.background,
  },
  colEmoji: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colEmojiActive: {
    backgroundColor: colors.primaryLight + '30',
  },
  emojiText: {
    fontSize: 22,
  },
  colInfo: {
    flex: 1,
  },
  colName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  colCount: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  sep: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 56,
  },

  // Create row
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  createIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },

  // Create form
  createForm: {
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 10,
  },
  emojiRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  emojiBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  emojiBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight + '20',
  },
  emojiBtnText: { fontSize: 18 },
  createInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  selectedEmoji: { fontSize: 20 },
  createInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 4,
  },
  createSaveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  createSaveBtnDisabled: {
    backgroundColor: colors.textLight,
  },
  createSaveBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },

  // Bottom actions
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  doneBtn: {
    flex: 2,
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  doneBtnDim: {
    backgroundColor: colors.textLight,
    shadowOpacity: 0,
  },
  doneBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
