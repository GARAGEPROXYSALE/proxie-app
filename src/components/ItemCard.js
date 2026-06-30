import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import colors from '../theme/colors';

const conditionColors = {
  'New': colors.success,
  'Like New': '#34C759',
  'Good': colors.primary,
  'Fair': colors.warning,
};

export default function ItemCard({ item, onPress, style }) {
  const { toggleSaved } = useApp();
  const onSave = (e) => {
    e.stopPropagation();
    toggleSaved(item.id);
  };
  return (
    <TouchableOpacity style={[styles.card, style]} onPress={onPress} activeOpacity={0.85}>
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: item.photos[0] }}
          style={styles.image}
          resizeMode="cover"
        />
        <TouchableOpacity style={styles.saveBtn} onPress={onSave} activeOpacity={0.8}>
          <Ionicons
            name={item.saved ? 'heart' : 'heart-outline'}
            size={18}
            color={item.saved ? colors.danger : '#fff'}
          />
        </TouchableOpacity>
        <View style={[styles.conditionBadge, { backgroundColor: conditionColors[item.condition] || colors.primary }]}>
          <Text style={styles.conditionText}>{item.condition}</Text>
        </View>
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <View style={styles.row}>
          <Text style={styles.price}>${item.price}</Text>
          <View style={styles.distanceRow}>
            <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
            <Text style={styles.distance}>{item.distance} mi</Text>
          </View>
        </View>
        <Text style={styles.category}>{item.category}</Text>
      </View>
    </TouchableOpacity>
  );
}

export function ItemCardHorizontal({ item, onPress }) {
  const { toggleSaved } = useApp();
  const onSave = (e) => {
    e?.stopPropagation?.();
    toggleSaved(item.id);
  };
  return (
    <TouchableOpacity style={[styles.hCard, item.sold && styles.hCardSold]} onPress={onPress} activeOpacity={0.85}>
      <View>
        <Image
          source={{ uri: item.photos[0] }}
          style={styles.hImage}
          resizeMode="cover"
        />
        {item.sold && (
          <View style={styles.soldOverlay}>
            <Text style={styles.soldOverlayText}>SOLD</Text>
          </View>
        )}
      </View>
      <View style={styles.hInfo}>
        <Text style={styles.hTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.hPrice}>${item.price}</Text>
        <View style={styles.hMeta}>
          <View style={styles.distanceRow}>
            <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
            <Text style={styles.distance}>{item.distance} mi away</Text>
          </View>
          <Text style={styles.hCategory}>{item.category.toUpperCase()}</Text>
        </View>
        <View style={styles.neighborhoodRow}>
          <Ionicons name="map-outline" size={11} color={colors.textLight} />
          <Text style={styles.hNeighborhood} numberOfLines={1}>{item.neighborhood}</Text>
        </View>
      </View>
      <TouchableOpacity onPress={onSave} style={styles.hSaveBtn}>
        <Ionicons
          name={item.saved ? 'heart' : 'heart-outline'}
          size={20}
          color={item.saved ? colors.danger : colors.textLight}
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  imageContainer: {
    position: 'relative',
  },
  image: {
    width: '100%',
    height: 140,
    backgroundColor: colors.border,
  },
  saveBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 14,
    padding: 5,
  },
  conditionBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  conditionText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  info: {
    padding: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  price: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
  },
  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  distance: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  category: {
    fontSize: 11,
    color: colors.textLight,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // Horizontal card
  hCard: {
    flexDirection: 'row',
    backgroundColor: colors.cardBackground,
    borderRadius: 16,
    overflow: 'hidden',
    marginHorizontal: 16,
    marginVertical: 5,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
    alignItems: 'center',
  },
  hImage: {
    width: 80,
    height: 80,
    backgroundColor: colors.border,
  },
  hInfo: {
    flex: 1,
    padding: 12,
  },
  hTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  hPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 4,
  },
  hMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  hCategory: {
    fontSize: 11,
    color: colors.textLight,
    textTransform: 'uppercase',
  },
  neighborhoodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 1,
  },
  hNeighborhood: {
    fontSize: 11,
    color: colors.textLight,
    fontStyle: 'italic',
  },
  hSaveBtn: {
    padding: 12,
  },
  hCardSold: {
    opacity: 0.7,
  },
  soldOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  soldOverlayText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
});
