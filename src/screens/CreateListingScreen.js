import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Image, Alert, KeyboardAvoidingView, Platform,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { getUserLocation } from '../lib/location';
import { uploadListingPhoto } from '../lib/db';
import { supabase } from '../lib/supabase';
import { sanitizeText, sanitizePrice, validateListingPayload } from '../lib/sanitize';
import colors from '../theme/colors';

const CONDITIONS = ['New', 'Like New', 'Good', 'Fair'];
const CATEGORIES = ['Furniture', 'Electronics', 'Clothing', 'Books', 'Kitchen', 'Sports', 'Toys', 'Tickets', 'Other'];
const TICKET_TYPES = ['General Admission', 'Reserved', 'VIP', 'Suite'];

export default function CreateListingScreen({ navigation }) {
  const { addListing, user } = useApp();

  // Shared
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [photos, setPhotos] = useState([]);
  const [gpsCoords, setGpsCoords] = useState(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');

  // Standard listing fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [condition, setCondition] = useState('Good');

  // Ticket-specific fields
  const [eventName, setEventName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [venue, setVenue] = useState('');
  const [numTickets, setNumTickets] = useState('1');
  const [seatInfo, setSeatInfo] = useState('');
  const [ticketType, setTicketType] = useState('Reserved');
  const [ticketNotes, setTicketNotes] = useState('');

  const isTickets = category === 'Tickets';

  const isValid = isTickets
    ? eventName.trim() && price.trim() && eventDate.trim() && venue.trim() && numTickets
    : title.trim() && price.trim() && description.trim() && category;

  useEffect(() => {
    getUserLocation().then((loc) => setGpsCoords(loc)).catch(() => {});
  }, []);

  const handleAddPhoto = async () => {
    if (photos.length >= 6) {
      Alert.alert('Max photos', 'You can add up to 6 photos per listing.');
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow photo access to add listing photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
      selectionLimit: 6 - photos.length,
    });
    if (!result.canceled && result.assets) {
      // Store full asset objects so uploadListingPhoto can use .file on web
      setPhotos((prev) => [...prev, ...result.assets].slice(0, 6));
    }
  };

  const handleTakePhoto = async () => {
    if (photos.length >= 6) return;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow camera access.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets?.[0]) {
      setPhotos((prev) => [...prev, result.assets[0]].slice(0, 6));
    }
  };

  const removePhoto = (index) => setPhotos((prev) => prev.filter((_, i) => i !== index));

  const buildTicketListing = () => {
    const n = parseInt(numTickets, 10) || 1;
    const builtTitle = `${eventName.trim()} — ${n} ${ticketType} Ticket${n !== 1 ? 's' : ''}`;
    const lines = [
      `📅 ${eventDate.trim()}${eventTime.trim() ? ` · ${eventTime.trim()}` : ''}`,
      `📍 ${venue.trim()}`,
      `🎟 ${n} ${ticketType} ticket${n !== 1 ? 's' : ''}`,
      seatInfo.trim() ? `💺 ${seatInfo.trim()}` : null,
      ticketNotes.trim() ? `\n${ticketNotes.trim()}` : null,
    ].filter(Boolean);
    return { title: builtTitle, description: lines.join('\n') };
  };

  const handlePublish = async () => {
    setPublishError('');
    const cleanPrice = sanitizePrice(price);

    let cleanTitle, cleanDesc;
    if (isTickets) {
      const built = buildTicketListing();
      cleanTitle = built.title;
      cleanDesc = built.description;
    } else {
      cleanTitle = sanitizeText(title, 80);
      cleanDesc = sanitizeText(description, 500);
    }

    const errors = validateListingPayload({ title: cleanTitle, price: cleanPrice, description: cleanDesc, category });
    if (errors.length > 0) { setPublishError(errors[0]); return; }

    setPublishing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      let uploadedUrls = [];
      if (session?.user && photos.length > 0) {
        uploadedUrls = await Promise.all(
          photos.map((asset) => uploadListingPhoto(asset, session.user.id))
        );
      } else {
        uploadedUrls = photos.map((a) => (typeof a === 'string' ? a : a.uri));
      }

      await addListing({
        title: cleanTitle,
        price: cleanPrice,
        description: cleanDesc,
        condition: isTickets ? 'New' : condition,
        category,
        photos: uploadedUrls,
        latitude: gpsCoords?.latitude || null,
        longitude: gpsCoords?.longitude || null,
      });

      navigation.goBack();
    } catch (e) {
      console.error('[CreateListing] publish failed:', e);
      setPublishError(e?.message || 'Could not publish. Please check your connection and try again.');
    } finally {
      setPublishing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Listing</Text>
          <TouchableOpacity onPress={handlePublish} disabled={!isValid || publishing}>
            {publishing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={[styles.publishBtn, !isValid && styles.publishBtnDisabled]}>Publish</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Photo section */}
          <View style={styles.photoSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll} contentContainerStyle={styles.photoScrollContent}>
              {photos.map((asset, i) => (
                <View key={i} style={styles.photoThumb}>
                  <Image source={{ uri: typeof asset === 'string' ? asset : asset.uri }} style={styles.thumbImg} resizeMode="cover" />
                  <TouchableOpacity style={styles.removePhoto} onPress={() => removePhoto(i)}>
                    <Ionicons name="close-circle" size={22} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              {photos.length < 6 && (
                <View style={styles.addPhotoButtons}>
                  <TouchableOpacity style={styles.photoBtn} onPress={handleAddPhoto} activeOpacity={0.8}>
                    <Ionicons name="images-outline" size={26} color={colors.primary} />
                    <Text style={styles.photoBtnText}>Gallery</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.photoBtn} onPress={handleTakePhoto} activeOpacity={0.8}>
                    <Ionicons name="camera-outline" size={26} color={colors.primary} />
                    <Text style={styles.photoBtnText}>Camera</Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
            {photos.length === 0 && (
              <Text style={styles.photoHint}>Add up to 6 photos — good photos get more buyers</Text>
            )}
          </View>

          <View style={styles.form}>
            {/* GPS indicator */}
            <View style={styles.gpsRow}>
              <View style={[styles.gpsDot, { backgroundColor: gpsCoords ? colors.success : colors.textLight }]} />
              <Text style={styles.gpsText}>{gpsCoords ? 'Location captured — buyers nearby will see this' : 'Getting location…'}</Text>
            </View>

            {/* Category */}
            <View style={styles.field}>
              <Text style={styles.label}>Category *</Text>
              <View style={styles.chipGrid}>
                {CATEGORIES.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chip, category === c && styles.chipActive, c === 'Tickets' && styles.ticketChip, category === c && c === 'Tickets' && styles.ticketChipActive]}
                    onPress={() => setCategory(c)}
                  >
                    {c === 'Tickets' && (
                      <Ionicons name="ticket-outline" size={13} color={category === 'Tickets' ? '#fff' : '#9B59B6'} />
                    )}
                    <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Price */}
            <View style={styles.field}>
              <Text style={styles.label}>
                {isTickets ? 'Asking price (total) *' : 'Price *'}
              </Text>
              <View style={styles.priceInput}>
                <Text style={styles.dollarSign}>$</Text>
                <TextInput
                  style={styles.priceField}
                  placeholder="0"
                  placeholderTextColor={colors.textLight}
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                  maxLength={8}
                />
                <TouchableOpacity style={styles.freeBtn} onPress={() => setPrice('0')}>
                  <Text style={styles.freeBtnText}>Free</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ── TICKET FIELDS ────────────────────────────────── */}
            {isTickets && (
              <>
                <View style={styles.ticketBanner}>
                  <Ionicons name="ticket" size={16} color="#9B59B6" />
                  <Text style={styles.ticketBannerText}>Ticket details — fill in what you know</Text>
                </View>

                {/* Event Name */}
                <View style={styles.field}>
                  <Text style={styles.label}>Event name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Taylor Swift · The Eras Tour"
                    placeholderTextColor={colors.textLight}
                    value={eventName}
                    onChangeText={setEventName}
                    maxLength={100}
                  />
                </View>

                {/* Date + Time row */}
                <View style={styles.rowFields}>
                  <View style={[styles.field, { flex: 1 }]}>
                    <Text style={styles.label}>Date *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. Aug 14, 2025"
                      placeholderTextColor={colors.textLight}
                      value={eventDate}
                      onChangeText={setEventDate}
                      maxLength={30}
                    />
                  </View>
                  <View style={[styles.field, { flex: 1 }]}>
                    <Text style={styles.label}>Time <Text style={styles.optional}>(optional)</Text></Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 7:30 PM"
                      placeholderTextColor={colors.textLight}
                      value={eventTime}
                      onChangeText={setEventTime}
                      maxLength={20}
                    />
                  </View>
                </View>

                {/* Venue */}
                <View style={styles.field}>
                  <Text style={styles.label}>Venue *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. Madison Square Garden, New York, NY"
                    placeholderTextColor={colors.textLight}
                    value={venue}
                    onChangeText={setVenue}
                    maxLength={100}
                  />
                </View>

                {/* # Tickets + Seat Info row */}
                <View style={styles.rowFields}>
                  <View style={[styles.field, { flex: 1 }]}>
                    <Text style={styles.label}># of Tickets *</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="1"
                      placeholderTextColor={colors.textLight}
                      value={numTickets}
                      onChangeText={setNumTickets}
                      keyboardType="numeric"
                      maxLength={2}
                    />
                  </View>
                  <View style={[styles.field, { flex: 2 }]}>
                    <Text style={styles.label}>Section / Row / Seat <Text style={styles.optional}>(optional)</Text></Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. Sec 112, Row C, Seats 1–2"
                      placeholderTextColor={colors.textLight}
                      value={seatInfo}
                      onChangeText={setSeatInfo}
                      maxLength={80}
                    />
                  </View>
                </View>

                {/* Ticket Type */}
                <View style={styles.field}>
                  <Text style={styles.label}>Ticket type</Text>
                  <View style={styles.condRow}>
                    {TICKET_TYPES.map((t) => (
                      <TouchableOpacity
                        key={t}
                        style={[styles.condChip, ticketType === t && styles.condChipActive]}
                        onPress={() => setTicketType(t)}
                      >
                        <Text style={[styles.condText, ticketType === t && styles.condTextActive]} numberOfLines={1}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Additional Notes */}
                <View style={styles.field}>
                  <Text style={styles.label}>Additional notes <Text style={styles.optional}>(optional)</Text></Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Transfer method, reason for selling, any restrictions..."
                    placeholderTextColor={colors.textLight}
                    value={ticketNotes}
                    onChangeText={setTicketNotes}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    maxLength={300}
                  />
                </View>
              </>
            )}

            {/* ── STANDARD FIELDS (non-ticket) ─────────────────── */}
            {!isTickets && (
              <>
                {/* Title */}
                <View style={styles.field}>
                  <Text style={styles.label}>Title *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="What are you selling?"
                    placeholderTextColor={colors.textLight}
                    value={title}
                    onChangeText={setTitle}
                    maxLength={80}
                  />
                </View>

                {/* Condition */}
                <View style={styles.field}>
                  <Text style={styles.label}>Condition</Text>
                  <View style={styles.condRow}>
                    {CONDITIONS.map((c) => (
                      <TouchableOpacity
                        key={c}
                        style={[styles.condChip, condition === c && styles.condChipActive]}
                        onPress={() => setCondition(c)}
                      >
                        <Text style={[styles.condText, condition === c && styles.condTextActive]}>{c}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {/* Description */}
                <View style={styles.field}>
                  <Text style={styles.label}>Description *</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Describe your item — size, color, why you're selling it..."
                    placeholderTextColor={colors.textLight}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={5}
                    textAlignVertical="top"
                    maxLength={500}
                  />
                  <Text style={styles.charCount}>{description.length}/500</Text>
                </View>
              </>
            )}

            {publishError ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle" size={18} color="#fff" />
                <Text style={styles.errorBannerText}>{publishError}</Text>
              </View>
            ) : null}

            <View style={styles.tip}>
              <Ionicons name="bulb-outline" size={16} color={colors.warning} />
              <Text style={styles.tipText}>
                {isTickets
                  ? 'Ticket listings appear on buyers\' radars just like any other item.'
                  : 'Your item appears on nearby buyers\' radars when you Go Live.'}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.publishFullBtn, (!isValid || publishing) && styles.publishFullBtnDisabled]}
              onPress={handlePublish}
              disabled={!isValid || publishing}
              activeOpacity={0.85}
            >
              {publishing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name={isTickets ? 'ticket-outline' : 'radio-outline'} size={18} color="#fff" />
                  <Text style={styles.publishFullText}>{isTickets ? 'List Tickets' : 'Publish Listing'}</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: colors.background,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  publishBtn: { fontSize: 16, fontWeight: '700', color: colors.primary },
  publishBtnDisabled: { color: colors.textLight },
  scroll: { flex: 1 },

  photoSection: {
    margin: 16, borderRadius: 20, overflow: 'hidden',
    backgroundColor: colors.cardBackground, minHeight: 120,
    borderWidth: 1, borderColor: colors.border,
  },
  photoScroll: { flexGrow: 0 },
  photoScrollContent: { padding: 12, gap: 10, flexDirection: 'row', alignItems: 'center' },
  photoThumb: { width: 100, height: 100, borderRadius: 12, overflow: 'visible', position: 'relative' },
  thumbImg: { width: 100, height: 100, borderRadius: 12 },
  removePhoto: { position: 'absolute', top: -6, right: -6, zIndex: 10 },
  addPhotoButtons: { flexDirection: 'row', gap: 10 },
  photoBtn: {
    width: 100, height: 100, borderRadius: 12, borderWidth: 2, borderStyle: 'dashed',
    borderColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  photoBtnText: { fontSize: 11, fontWeight: '600', color: colors.primary },
  photoHint: { fontSize: 12, color: colors.textLight, textAlign: 'center', paddingBottom: 14, paddingHorizontal: 16 },

  form: { paddingHorizontal: 16 },
  gpsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  gpsDot: { width: 8, height: 8, borderRadius: 4 },
  gpsText: { fontSize: 12, color: colors.textSecondary },
  field: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 },
  optional: { fontWeight: '400', color: colors.textLight, fontSize: 12 },
  input: {
    backgroundColor: colors.cardBackground, borderRadius: 14, padding: 14,
    fontSize: 15, color: colors.text, borderWidth: 1, borderColor: colors.border,
  },
  textArea: { height: 90, paddingTop: 14 },
  charCount: { fontSize: 11, color: colors.textLight, textAlign: 'right', marginTop: 4 },
  priceInput: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.cardBackground,
    borderRadius: 14, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14,
  },
  dollarSign: { fontSize: 20, fontWeight: '700', color: colors.primary, marginRight: 4 },
  priceField: { flex: 1, fontSize: 20, fontWeight: '700', color: colors.text, paddingVertical: 14 },
  freeBtn: { backgroundColor: colors.primaryLight, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  freeBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12,
    backgroundColor: colors.cardBackground, borderWidth: 1, borderColor: colors.border,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  ticketChip: { borderColor: '#9B59B640', backgroundColor: '#9B59B608' },
  ticketChipActive: { backgroundColor: '#9B59B6', borderColor: '#9B59B6' },
  chipText: { fontSize: 13, color: colors.textSecondary, fontWeight: '500' },
  chipTextActive: { color: '#fff', fontWeight: '700' },

  condRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  condChip: {
    flex: 1, paddingVertical: 10, borderRadius: 12, minWidth: 70,
    backgroundColor: colors.cardBackground, borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  condChipActive: { backgroundColor: colors.primaryLight, borderColor: colors.primaryLight },
  condText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  condTextActive: { color: '#fff', fontWeight: '700' },

  rowFields: { flexDirection: 'row', gap: 10 },

  ticketBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#9B59B610', borderRadius: 12, padding: 12, marginBottom: 20,
    borderWidth: 1, borderColor: '#9B59B630',
  },
  ticketBannerText: { fontSize: 13, fontWeight: '600', color: '#9B59B6' },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: colors.danger, borderRadius: 12, padding: 14, marginBottom: 16,
  },
  errorBannerText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#fff', lineHeight: 18 },
  tip: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#FFF8E8', borderRadius: 12, padding: 12, marginBottom: 20,
  },
  tipText: { flex: 1, fontSize: 13, color: '#92630A', lineHeight: 18 },
  publishFullBtn: {
    backgroundColor: colors.primary, borderRadius: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  publishFullBtnDisabled: { backgroundColor: colors.textLight, shadowOpacity: 0 },
  publishFullText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
