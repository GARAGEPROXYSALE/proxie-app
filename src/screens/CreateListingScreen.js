import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ScrollView, Image, Alert, KeyboardAvoidingView, Platform,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import { getUserLocation, reverseGeocode } from '../lib/location';
import { uploadListingPhoto, fetchOutpostFee } from '../lib/db';
import { supabase } from '../lib/supabase';
import { sanitizeText, sanitizePrice, validateListingPayload } from '../lib/sanitize';
import colors from '../theme/colors';

const CONDITIONS = ['New', 'Like New', 'Good', 'Fair'];
const CATEGORIES = ['Furniture', 'Electronics', 'Clothing', 'Books', 'Kitchen', 'Sports', 'Toys', 'Tickets', 'Other'];
const TICKET_TYPES = ['General Admission', 'Reserved', 'VIP', 'Suite'];
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TIME_RE = /^(1[0-2]|0?[1-9]):([0-5]\d)\s?(AM|PM)$/i;
const DATE_RE = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/20\d{2}$/;

function to24hr(t) {
  const m = t.trim().match(/^(\d{1,2}):(\d{2})\s?(AM|PM)$/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const min = m[2];
  const period = m[3].toUpperCase();
  if (period === 'PM' && h !== 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${min}`;
}

function timeToMinutes(t) {
  const t24 = to24hr(t);
  if (!t24) return 0;
  const [h, m] = t24.split(':').map(Number);
  return h * 60 + m;
}

export default function CreateListingScreen({ navigation }) {
  const { addListing, user, payOutpostFee, beginOutpostMonitoring } = useApp();

  // Shared
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [photos, setPhotos] = useState([]);
  const [gpsCoords, setGpsCoords] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('loading'); // 'loading' | 'ok' | 'denied'
  const [gpsAddress, setGpsAddress] = useState(null); // reverse-geocoded, or null (e.g. on web)
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [manualAddressMode, setManualAddressMode] = useState(false);
  const [manualAddress, setManualAddress] = useState('');
  const [manualAddressError, setManualAddressError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [published, setPublished] = useState(false);

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

  // Availability
  const [availabilityType, setAvailabilityType] = useState('anytime'); // 'anytime' | 'scheduled'
  const [scheduleDays, setScheduleDays] = useState([]); // [0-6]
  const [scheduleStart, setScheduleStart] = useState('9:00 AM');
  const [scheduleEnd, setScheduleEnd] = useState('5:00 PM');

  // Outpost — pre-post for a future date/location, GPS auto-confirms it live
  const [isOutpost, setIsOutpost] = useState(false);
  const [outpostAddress, setOutpostAddress] = useState('');
  const [outpostDate, setOutpostDate] = useState('');
  const [outpostTime, setOutpostTime] = useState('');
  const [outpostFee, setOutpostFee] = useState(5.99);

  const isTickets = category === 'Tickets';

  const isScheduleValid = availabilityType === 'anytime' || (
    scheduleDays.length > 0 &&
    TIME_RE.test(scheduleStart) &&
    TIME_RE.test(scheduleEnd) &&
    timeToMinutes(scheduleStart) < timeToMinutes(scheduleEnd)
  );

  const outpostScheduledDate = (() => {
    if (!DATE_RE.test(outpostDate) || !TIME_RE.test(outpostTime)) return null;
    const [month, day, year] = outpostDate.split('/').map(Number);
    const [hour, minute] = outpostTime.split(':').map(Number);
    const d = new Date(year, month - 1, day, hour, minute);
    return Number.isNaN(d.getTime()) ? null : d;
  })();

  const isOutpostValid = !isOutpost || (
    outpostAddress.trim().length > 4 &&
    outpostScheduledDate &&
    outpostScheduledDate.getTime() > Date.now()
  );

  // Outpost listings supply their own geocoded address at publish time, so
  // they don't need device GPS — every other listing does, and a seller
  // must explicitly confirm the detected location before it can be used,
  // not just have GPS silently succeed in the background.
  const isValid = photos.length > 0 && isScheduleValid && isOutpostValid && (isOutpost || locationConfirmed) && (
    isTickets
      ? eventName.trim() && (price === '' || price.trim()) && eventDate.trim() && venue.trim() && numTickets
      : title.trim() && (price === '' || price.trim()) && description.trim() && category
  );

  const toggleScheduleDay = (day) => {
    setScheduleDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort());
  };

  const requestLocation = () => {
    setGpsStatus('loading');
    setLocationConfirmed(false);
    setGpsAddress(null);
    getUserLocation()
      .then(async (loc) => {
        if (loc) {
          setGpsCoords(loc);
          setGpsStatus('ok');
          const address = await reverseGeocode(loc.latitude, loc.longitude);
          setGpsAddress(address);
        } else {
          setGpsStatus('denied');
        }
      })
      .catch(() => setGpsStatus('denied'));
  };

  const handleManualAddressConfirm = async () => {
    setManualAddressError('');
    const geocoded = await Location.geocodeAsync(manualAddress.trim()).catch(() => []);
    if (!geocoded?.[0]) {
      setManualAddressError("Couldn't find that address. Try adding a city or zip code.");
      return;
    }
    setGpsCoords({ latitude: geocoded[0].latitude, longitude: geocoded[0].longitude });
    setGpsAddress(manualAddress.trim());
    setGpsStatus('ok');
    setLocationConfirmed(true);
    setManualAddressMode(false);
  };

  useEffect(() => {
    requestLocation();
    fetchOutpostFee().then(setOutpostFee).catch(() => {});
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

    if (photos.length === 0) { setPublishError('At least one photo is required.'); return; }
    if (!isOutpost && !locationConfirmed) {
      setPublishError('Please confirm your location before publishing.');
      return;
    }
    const errors = validateListingPayload({ title: cleanTitle, price: cleanPrice, description: cleanDesc, category });
    if (errors.length > 0) { setPublishError(errors[0]); return; }
    if (isOutpost && !isOutpostValid) {
      setPublishError('Enter the Outpost address and a future date/time.');
      return;
    }

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

      // Outpost listings target a future location the seller isn't at yet —
      // geocode the typed address instead of using the device's current GPS.
      let outpostLat = null;
      let outpostLon = null;
      if (isOutpost) {
        const geocoded = await Location.geocodeAsync(outpostAddress.trim()).catch(() => []);
        if (!geocoded?.[0]) {
          setPublishError("Couldn't find that address. Try adding a city or zip code.");
          setPublishing(false);
          return;
        }
        outpostLat = geocoded[0].latitude;
        outpostLon = geocoded[0].longitude;
      }

      const saved = await addListing({
        title: cleanTitle,
        price: cleanPrice,
        description: cleanDesc,
        condition: isTickets ? 'New' : condition,
        category,
        photos: uploadedUrls,
        latitude: isOutpost ? outpostLat : (gpsCoords?.latitude || null),
        longitude: isOutpost ? outpostLon : (gpsCoords?.longitude || null),
        address: isOutpost ? outpostAddress.trim() : null,
        availabilityType,
        schedule: availabilityType === 'scheduled'
          ? [{ days: scheduleDays, start: to24hr(scheduleStart) || scheduleStart, end: to24hr(scheduleEnd) || scheduleEnd }]
          : [],
        isOutpost,
        outpostScheduledAt: isOutpost ? outpostScheduledDate.toISOString() : null,
      });

      if (isOutpost && saved?.id) {
        // Opens Stripe Checkout in the system browser — the listing already
        // exists (outpost_fee_paid: false) and stays hidden from the public
        // feed until the webhook flips that flag.
        await payOutpostFee(saved.id).catch(() => {
          setPublishError('Listing saved, but the payment page could not be opened. Open it again from My Garage to pay the Outpost fee.');
        });
        await beginOutpostMonitoring().catch(() => {});
        navigation.goBack();
      } else {
        setPublished(true);
      }
    } catch (e) {
      console.error('[CreateListing] publish failed:', e);
      setPublishError(e?.message || 'Could not publish. Please check your connection and try again.');
    } finally {
      setPublishing(false);
    }
  };

  if (published) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.successWrap}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={72} color={colors.success} />
          </View>
          <Text style={styles.successTitle}>It's live!</Text>
          <Text style={styles.successSub}>
            Your listing is active for <Text style={{ fontWeight: '800', color: colors.text }}>7 days</Text>.{'\n'}
            After that, hop into My Garage and tap{' '}
            <Text style={{ fontWeight: '800', color: colors.primary }}>Relist</Text> to repost it in one tap —
            no need to fill anything out again.
          </Text>
          <View style={styles.successTips}>
            <View style={styles.successTipRow}>
              <Ionicons name="notifications-outline" size={16} color={colors.primary} />
              <Text style={styles.successTipText}>We'll remind you before it expires</Text>
            </View>
            <View style={styles.successTipRow}>
              <Ionicons name="chatbubble-outline" size={16} color={colors.primary} />
              <Text style={styles.successTipText}>Buyers will message you directly in the app</Text>
            </View>
            <View style={styles.successTipRow}>
              <Ionicons name="repeat-outline" size={16} color={colors.primary} />
              <Text style={styles.successTipText}>Relist anytime to bump it back to the top</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.successBtn} onPress={() => navigation.goBack()} activeOpacity={0.88}>
            <Text style={styles.successBtnText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

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
              <Text style={[styles.publishBtn, !isValid && styles.publishBtnDisabled]}>
                {isOutpost ? 'Pay & Post' : 'Publish'}
              </Text>
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
            {photos.length === 0 ? (
              <Text style={styles.photoHintRequired}>
                <Ionicons name="camera-outline" size={13} /> Photo required · Good photos get more buyers
              </Text>
            ) : null}
          </View>

          <View style={styles.form}>
            {/* Location — required for every non-Outpost listing, and a
                seller must explicitly confirm it before it can be used. No
                listing goes live on a silently-captured, unverified GPS fix. */}
            {!isOutpost && (
              <View style={styles.locationSection}>
                {gpsStatus === 'denied' ? (
                  <TouchableOpacity style={styles.gpsRowDenied} onPress={requestLocation} activeOpacity={0.8}>
                    <View style={[styles.gpsDot, { backgroundColor: colors.danger }]} />
                    <Text style={styles.gpsTextDenied}>Location is required to publish — tap to enable</Text>
                    <Ionicons name="refresh" size={14} color={colors.danger} />
                  </TouchableOpacity>
                ) : gpsStatus === 'loading' ? (
                  <View style={styles.gpsRow}>
                    <View style={[styles.gpsDot, { backgroundColor: colors.textLight }]} />
                    <Text style={styles.gpsText}>Getting location…</Text>
                  </View>
                ) : locationConfirmed ? (
                  <View style={styles.locationConfirmedRow}>
                    <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    <Text style={styles.locationConfirmedText} numberOfLines={2}>
                      {gpsAddress || `${gpsCoords.latitude.toFixed(4)}, ${gpsCoords.longitude.toFixed(4)}`}
                    </Text>
                    <TouchableOpacity onPress={() => setLocationConfirmed(false)}>
                      <Text style={styles.locationChangeLink}>Change</Text>
                    </TouchableOpacity>
                  </View>
                ) : manualAddressMode ? (
                  <View style={styles.locationConfirmBox}>
                    <Text style={styles.locationConfirmTitle}>Enter your address</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 123 Main St, Queens, NY"
                      placeholderTextColor={colors.textLight}
                      value={manualAddress}
                      onChangeText={setManualAddress}
                      maxLength={120}
                    />
                    {manualAddressError ? (
                      <Text style={styles.scheduleError}>{manualAddressError}</Text>
                    ) : null}
                    <View style={styles.locationConfirmActions}>
                      <TouchableOpacity style={styles.locationConfirmBtn} onPress={handleManualAddressConfirm} activeOpacity={0.85}>
                        <Text style={styles.locationConfirmBtnText}>Use this address</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.locationRetryBtn} onPress={() => setManualAddressMode(false)} activeOpacity={0.7}>
                        <Text style={styles.locationRetryBtnText}>Cancel</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ) : (
                  <View style={styles.locationConfirmBox}>
                    <Text style={styles.locationConfirmTitle}>Is this your location?</Text>
                    <View style={styles.locationConfirmAddressRow}>
                      <Ionicons name="location" size={16} color={colors.primary} />
                      <Text style={styles.locationConfirmAddress} numberOfLines={2}>
                        {gpsAddress || `Approx. ${gpsCoords.latitude.toFixed(4)}, ${gpsCoords.longitude.toFixed(4)}`}
                      </Text>
                    </View>
                    <Text style={styles.locationConfirmHint}>
                      Buyers use this to see how far away your listing is — make sure it's right.
                    </Text>
                    <View style={styles.locationConfirmActions}>
                      <TouchableOpacity style={styles.locationConfirmBtn} onPress={() => setLocationConfirmed(true)} activeOpacity={0.85}>
                        <Ionicons name="checkmark" size={16} color="#fff" />
                        <Text style={styles.locationConfirmBtnText}>Yes, that's right</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.locationRetryBtn} onPress={requestLocation} activeOpacity={0.7}>
                        <Text style={styles.locationRetryBtnText}>Retry</Text>
                      </TouchableOpacity>
                    </View>
                    <TouchableOpacity onPress={() => setManualAddressMode(true)}>
                      <Text style={styles.locationManualLink}>That's not right — enter address manually</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

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
                <TouchableOpacity
                  style={[styles.freeBtn, (!price || price === '0') && styles.freeBtnActive]}
                  onPress={() => setPrice('0')}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.freeBtnText, (!price || price === '0') && styles.freeBtnTextActive]}>Free</Text>
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

            {/* Availability */}
            <View style={styles.field}>
              <Text style={styles.label}>When are you available?</Text>
              <View style={styles.availToggleRow}>
                <TouchableOpacity
                  style={[styles.availToggleBtn, availabilityType === 'anytime' && styles.availToggleBtnActive]}
                  onPress={() => setAvailabilityType('anytime')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="infinite-outline" size={15} color={availabilityType === 'anytime' ? '#fff' : colors.textSecondary} />
                  <Text style={[styles.availToggleText, availabilityType === 'anytime' && styles.availToggleTextActive]}>Anytime</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.availToggleBtn, availabilityType === 'scheduled' && styles.availToggleBtnActive]}
                  onPress={() => setAvailabilityType('scheduled')}
                  activeOpacity={0.8}
                >
                  <Ionicons name="calendar-outline" size={15} color={availabilityType === 'scheduled' ? '#fff' : colors.textSecondary} />
                  <Text style={[styles.availToggleText, availabilityType === 'scheduled' && styles.availToggleTextActive]}>Scheduled</Text>
                </TouchableOpacity>
              </View>

              {availabilityType === 'scheduled' && (
                <View style={styles.scheduleBox}>
                  <Text style={styles.scheduleSubLabel}>Which days?</Text>
                  <View style={styles.dayChipRow}>
                    {DAY_LABELS.map((label, idx) => (
                      <TouchableOpacity
                        key={label}
                        style={[styles.dayChip, scheduleDays.includes(idx) && styles.dayChipActive]}
                        onPress={() => toggleScheduleDay(idx)}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.dayChipText, scheduleDays.includes(idx) && styles.dayChipTextActive]}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.scheduleSubLabel}>What time?</Text>
                  <View style={styles.timeRow}>
                    <View style={styles.timeField}>
                      <Text style={styles.timeFieldLabel}>From</Text>
                      <TextInput
                        style={styles.timeInput}
                        placeholder="9:00 AM"
                        placeholderTextColor={colors.textLight}
                        value={scheduleStart}
                        onChangeText={setScheduleStart}
                        maxLength={8}
                        autoCapitalize="characters"
                      />
                    </View>
                    <Text style={styles.timeDash}>–</Text>
                    <View style={styles.timeField}>
                      <Text style={styles.timeFieldLabel}>To</Text>
                      <TextInput
                        style={styles.timeInput}
                        placeholder="5:00 PM"
                        placeholderTextColor={colors.textLight}
                        value={scheduleEnd}
                        onChangeText={setScheduleEnd}
                        maxLength={8}
                        autoCapitalize="characters"
                      />
                    </View>
                  </View>
                  <Text style={styles.scheduleHint}>
                    e.g. 9:00 AM – 5:00 PM. Your listing stays visible at all times — buyers just see when you're actually available.
                  </Text>
                  {!isScheduleValid && (
                    <Text style={styles.scheduleError}>
                      Pick at least one day and a valid time range (e.g. 9:00 AM – 5:00 PM).
                    </Text>
                  )}
                </View>
              )}
            </View>

            {/* Outpost — paused: backing DB columns (is_outpost, outpost_scheduled_at)
                don't exist yet, so this stays hidden until that's built out. */}
            {false && !isTickets && (
              <View style={styles.field}>
                <TouchableOpacity
                  style={styles.outpostToggleRow}
                  onPress={() => setIsOutpost((v) => !v)}
                  activeOpacity={0.8}
                >
                  <View style={styles.outpostToggleLeft}>
                    <View style={[styles.outpostIconWrap, isOutpost && styles.outpostIconWrapActive]}>
                      <Ionicons name="flag-outline" size={16} color={isOutpost ? '#fff' : colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.outpostToggleTitle}>Post as Outpost</Text>
                      <Text style={styles.outpostToggleSub}>Pre-post for a future date/location you're not at yet</Text>
                    </View>
                  </View>
                  <View style={[styles.switchTrack, isOutpost && styles.switchTrackOn]}>
                    <View style={[styles.switchThumb, isOutpost && styles.switchThumbOn]} />
                  </View>
                </TouchableOpacity>

                {isOutpost && (
                  <View style={styles.scheduleBox}>
                    <Text style={styles.scheduleSubLabel}>Outpost address</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. 123 Main St, Austin, TX"
                      placeholderTextColor={colors.textLight}
                      value={outpostAddress}
                      onChangeText={setOutpostAddress}
                      maxLength={120}
                    />

                    <Text style={[styles.scheduleSubLabel, { marginTop: 14 }]}>When will you be there?</Text>
                    <View style={styles.timeRow}>
                      <View style={[styles.timeField, { flex: 1.4 }]}>
                        <Text style={styles.timeFieldLabel}>Date</Text>
                        <TextInput
                          style={styles.timeInput}
                          placeholder="MM/DD/YYYY"
                          placeholderTextColor={colors.textLight}
                          value={outpostDate}
                          onChangeText={setOutpostDate}
                          maxLength={10}
                        />
                      </View>
                      <View style={styles.timeField}>
                        <Text style={styles.timeFieldLabel}>Time</Text>
                        <TextInput
                          style={styles.timeInput}
                          placeholder="09:00"
                          placeholderTextColor={colors.textLight}
                          value={outpostTime}
                          onChangeText={setOutpostTime}
                          maxLength={5}
                        />
                      </View>
                    </View>

                    <View style={styles.outpostFeeRow}>
                      <Ionicons name="card-outline" size={15} color={colors.textSecondary} />
                      <Text style={styles.outpostFeeText}>
                        One-time posting fee: <Text style={{ fontWeight: '800', color: colors.text }}>${outpostFee.toFixed(2)}</Text>
                      </Text>
                    </View>
                    <Text style={styles.scheduleHint}>
                      Your listing stays hidden from buyers until the fee clears. Once you physically
                      arrive at this address on or after the scheduled time, it automatically goes live —
                      no extra step needed. Buyers can still message you to ask questions before then.
                    </Text>
                    {!isOutpostValid && (outpostAddress || outpostDate || outpostTime) && (
                      <Text style={styles.scheduleError}>
                        Enter a valid address and a date/time that's in the future.
                      </Text>
                    )}
                  </View>
                )}
              </View>
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
                  : isOutpost
                    ? 'After payment, this stays hidden until you arrive on-site — then it goes live automatically.'
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
                  <Ionicons name={isTickets ? 'ticket-outline' : isOutpost ? 'card-outline' : 'radio-outline'} size={18} color="#fff" />
                  <Text style={styles.publishFullText}>
                    {isTickets ? 'List Tickets' : isOutpost ? 'Pay & Post Outpost' : 'Publish Listing'}
                  </Text>
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
  photoHintRequired: { fontSize: 12, color: colors.warning, textAlign: 'center', paddingBottom: 14, paddingHorizontal: 16, fontWeight: '500' },

  form: { paddingHorizontal: 16 },
  gpsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  gpsDot: { width: 8, height: 8, borderRadius: 4 },
  gpsText: { fontSize: 12, color: colors.textSecondary },
  gpsRowDenied: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.danger + '12', borderWidth: 1, borderColor: colors.danger + '30',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16,
  },
  gpsTextDenied: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.danger },

  locationSection: { marginBottom: 16 },
  locationConfirmedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.success + '12', borderWidth: 1, borderColor: colors.success + '30',
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
  },
  locationConfirmedText: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.text },
  locationChangeLink: { fontSize: 12, fontWeight: '700', color: colors.primary },

  locationConfirmBox: {
    backgroundColor: colors.cardBackground, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  locationConfirmTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 10 },
  locationConfirmAddressRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: colors.primary + '10', borderRadius: 10, padding: 10, marginBottom: 8,
  },
  locationConfirmAddress: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text, lineHeight: 18 },
  locationConfirmHint: { fontSize: 11, color: colors.textLight, lineHeight: 16, marginBottom: 12 },
  locationConfirmActions: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  locationConfirmBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.primary, borderRadius: 12, paddingVertical: 12,
  },
  locationConfirmBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  locationRetryBtn: {
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  locationRetryBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  locationManualLink: { fontSize: 12, color: colors.textLight, textAlign: 'center', marginTop: 10, textDecorationLine: 'underline' },

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
  freeBtn: { backgroundColor: colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, opacity: 0.5 },
  freeBtnActive: { backgroundColor: colors.primary, opacity: 1 },
  freeBtnText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  freeBtnTextActive: { color: '#fff' },

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

  // Availability
  availToggleRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  availToggleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 12,
    backgroundColor: colors.cardBackground, borderWidth: 1, borderColor: colors.border,
  },
  availToggleBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  availToggleText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  availToggleTextActive: { color: '#fff' },

  scheduleBox: {
    marginTop: 14, padding: 14, borderRadius: 14,
    backgroundColor: colors.cardBackground, borderWidth: 1, borderColor: colors.border,
  },
  scheduleSubLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, marginBottom: 8, marginTop: 4 },
  dayChipRow: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  dayChip: {
    flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center',
    backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border,
  },
  dayChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  dayChipText: { fontSize: 11, fontWeight: '600', color: colors.textSecondary },
  dayChipTextActive: { color: '#fff' },

  timeRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  timeField: { flex: 1 },
  timeFieldLabel: { fontSize: 11, color: colors.textLight, marginBottom: 6, fontWeight: '500' },
  timeInput: {
    backgroundColor: colors.background, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text, textAlign: 'center',
  },
  timeDash: { fontSize: 16, color: colors.textLight, paddingBottom: 10 },

  scheduleHint: { fontSize: 11, color: colors.textLight, lineHeight: 16, marginTop: 12 },
  scheduleError: { fontSize: 11, color: colors.danger, lineHeight: 16, marginTop: 8, fontWeight: '500' },

  // Outpost
  outpostToggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.cardBackground, borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: colors.border,
  },
  outpostToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, marginRight: 10 },
  outpostIconWrap: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.primary + '15',
    alignItems: 'center', justifyContent: 'center',
  },
  outpostIconWrapActive: { backgroundColor: colors.primary },
  outpostToggleTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  outpostToggleSub: { fontSize: 11, color: colors.textLight, marginTop: 2, lineHeight: 15 },

  switchTrack: {
    width: 44, height: 26, borderRadius: 13,
    backgroundColor: colors.border, padding: 3, justifyContent: 'center',
  },
  switchTrackOn: { backgroundColor: colors.primary },
  switchThumb: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2,
  },
  switchThumbOn: { transform: [{ translateX: 18 }] },

  outpostFeeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border,
  },
  outpostFeeText: { fontSize: 13, color: colors.textSecondary },

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
  successWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 32, gap: 0,
  },
  successIcon: { marginBottom: 20 },
  successTitle: { fontSize: 32, fontWeight: '800', color: colors.text, letterSpacing: -0.5, marginBottom: 14 },
  successSub: {
    fontSize: 15, color: colors.textSecondary, textAlign: 'center',
    lineHeight: 23, marginBottom: 28,
  },
  successTips: {
    alignSelf: 'stretch', gap: 10, marginBottom: 36,
    backgroundColor: colors.cardBackground, borderRadius: 16, padding: 16,
  },
  successTipRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  successTipText: { fontSize: 13, fontWeight: '500', color: colors.text, flex: 1 },
  successBtn: {
    backgroundColor: colors.primary, borderRadius: 16,
    paddingVertical: 16, paddingHorizontal: 48,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  successBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  publishFullBtn: {
    backgroundColor: colors.primary, borderRadius: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 10, elevation: 6,
  },
  publishFullBtnDisabled: { backgroundColor: colors.textLight, shadowOpacity: 0 },
  publishFullText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
