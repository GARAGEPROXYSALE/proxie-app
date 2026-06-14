import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
  ScrollView, Image, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import colors from '../theme/colors';

export default function SavedScreen({ navigation }) {
  const { listings, collections, itemCollections, openCollectionModal, createCollection } = useApp();
  const [activeCollection, setActiveCollection] = useState(null); // null = show grid

  const savedItems = listings.filter((l) => l.saved);

  const itemsInCollection = (colId) =>
    savedItems.filter((l) => (itemCollections[l.id] || []).includes(colId));

  const displayItems = activeCollection
    ? itemsInCollection(activeCollection.id)
    : savedItems;

  const handleCreateCollection = () => {
    Alert.prompt
      ? Alert.prompt('New Collection', 'Enter a name:', (name) => {
          if (name?.trim()) createCollection(name.trim(), '📁');
        })
      : Alert.alert('Create Collection', 'Use the Save modal to create collections.');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={activeCollection ? () => setActiveCollection(null) : () => navigation.goBack()}>
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {activeCollection ? activeCollection.name : 'Saved Items'}
        </Text>
        <TouchableOpacity onPress={handleCreateCollection}>
          <Ionicons name="add" size={24} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1, paddingBottom: 40 }}>
        {/* Collection grid view */}
        {!activeCollection && (
          <>
            <Text style={styles.sectionLabel}>Collections</Text>
            <View style={styles.collectionGrid}>
              {collections.map((col) => {
                const items = itemsInCollection(col.id);
                const preview = items[0];
                return (
                  <TouchableOpacity
                    key={col.id}
                    style={styles.collectionCard}
                    onPress={() => setActiveCollection(col)}
                    activeOpacity={0.85}
                  >
                    {/* Photo strip */}
                    <View style={styles.colPhotoStrip}>
                      {preview ? (
                        <>
                          <Image
                            source={{ uri: preview.photos[0] }}
                            style={styles.colMainPhoto}
                            resizeMode="cover"
                          />
                          {items[1] && (
                            <Image
                              source={{ uri: items[1].photos[0] }}
                              style={styles.colSecondPhoto}
                              resizeMode="cover"
                            />
                          )}
                        </>
                      ) : (
                        <View style={styles.colEmptyPhoto}>
                          <Text style={styles.colEmptyEmoji}>{col.emoji}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.colFooter}>
                      <Text style={styles.colEmoji}>{col.emoji}</Text>
                      <View style={styles.colText}>
                        <Text style={styles.colName} numberOfLines={1}>{col.name}</Text>
                        <Text style={styles.colCount}>{col.count} items</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color={colors.textLight} />
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* Create new collection card */}
              <TouchableOpacity
                style={[styles.collectionCard, styles.createCard]}
                onPress={handleCreateCollection}
                activeOpacity={0.85}
              >
                <View style={styles.createPhotoArea}>
                  <View style={styles.createIconCircle}>
                    <Ionicons name="add" size={28} color={colors.primary} />
                  </View>
                </View>
                <View style={styles.colFooter}>
                  <Text style={styles.colEmoji}>📁</Text>
                  <View style={styles.colText}>
                    <Text style={[styles.colName, { color: colors.primary }]}>New collection</Text>
                    <Text style={styles.colCount}>Create one</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionLabel}>All Saved ({savedItems.length})</Text>
          </>
        )}

        {/* Items list */}
        {displayItems.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>{activeCollection?.emoji || '🔖'}</Text>
            <Text style={styles.emptyTitle}>Nothing saved here yet</Text>
            <Text style={styles.emptySub}>
              {activeCollection
                ? `Save items to "${activeCollection.name}" when browsing nearby.`
                : 'Tap the bookmark icon on any item to save it.'}
            </Text>
          </View>
        ) : (
          <View style={styles.itemGrid}>
            {displayItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.itemCard}
                onPress={() => navigation.navigate('ItemDetail', { item })}
                activeOpacity={0.85}
              >
                <Image
                  source={{ uri: item.photos[0] }}
                  style={styles.itemPhoto}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={styles.saveOverlay}
                  onPress={() => openCollectionModal(item, () => {})}
                >
                  <Ionicons name="bookmark" size={16} color={colors.primary} />
                </TouchableOpacity>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.itemPrice}>${item.price}</Text>
                  <View style={styles.itemMeta}>
                    <Ionicons name="location-outline" size={11} color={colors.textSecondary} />
                    <Text style={styles.itemDist}>{item.distance} mi</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 20,
    marginBottom: 10,
    paddingHorizontal: 16,
  },

  // Collection grid
  collectionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 10,
  },
  collectionCard: {
    width: '47%',
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  colPhotoStrip: {
    height: 100,
    flexDirection: 'row',
    backgroundColor: colors.border,
  },
  colMainPhoto: {
    flex: 3,
    height: '100%',
  },
  colSecondPhoto: {
    flex: 1,
    height: '100%',
    marginLeft: 2,
  },
  colEmptyPhoto: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  colEmptyEmoji: {
    fontSize: 36,
  },
  colFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 6,
  },
  colEmoji: { fontSize: 16 },
  colText: { flex: 1 },
  colName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  colCount: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 1,
  },
  createCard: {
    borderWidth: 2,
    borderColor: colors.primaryLight,
    borderStyle: 'dashed',
  },
  createPhotoArea: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  createIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.primaryLight + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Item grid
  itemGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    gap: 10,
  },
  itemCard: {
    width: '47%',
    backgroundColor: colors.cardBackground,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  itemPhoto: {
    width: '100%',
    height: 110,
    backgroundColor: colors.border,
  },
  saveOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 12,
    padding: 5,
  },
  itemInfo: {
    padding: 10,
  },
  itemTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 3,
  },
  itemPrice: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  itemDist: {
    fontSize: 11,
    color: colors.textSecondary,
  },

  // Empty
  empty: {
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 40,
    gap: 8,
  },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginTop: 8,
  },
  emptySub: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
