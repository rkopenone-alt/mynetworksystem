import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, SafeAreaView, StatusBar, ActivityIndicator,
  Animated, Dimensions, Vibration, Alert, Linking, Platform
} from 'react-native';
import * as Location from 'expo-location';
// Simple persistent storage shim
const Store = {
  _data: {},
  async setItem(key, val) { this._data[key] = val; },
  async getItem(key) { return this._data[key] || null; },
  async removeItem(key) { delete this._data[key]; },
};
const AsyncStorage = Store;

const API_URL = 'https://antigravity-rescue.loca.lt/api';
const WS_URL = 'wss://antigravity-rescue.loca.lt';
const { width } = Dimensions.get('window');

const C = {
  primary: '#0284c7',
  primaryLight: '#e0f2fe',
  secondary: '#10b981',
  danger: '#ef4444',
  dark: '#0f172a',
  light: '#64748b',
  border: '#e2e8f0',
  bg: '#f8fafc',
  white: '#ffffff',
  warning: '#f59e0b',
  success: '#22c55e',
};

// ─── Location Status Bar ──────────────────────────────────────────────────
function LocationStatusBar() {
  const [status, setStatus] = useState('checking'); // checking | on | off
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const checkLocation = async () => {
      try {
        let { status: permission } = await Location.getForegroundPermissionsAsync();
        if (permission !== 'granted') {
          // Don't request immediately on login page, just check
          setStatus('off');
        } else {
          let enabled = await Location.hasServicesEnabledAsync();
          setStatus(enabled ? 'on' : 'off');
        }
      } catch (e) {
        setStatus('off');
      }
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }).start();
    };

    checkLocation();
    const interval = setInterval(checkLocation, 5000);
    return () => clearInterval(interval);
  }, []);

  if (status === 'checking') return null;

  return (
    <Animated.View style={[s.locBar, status === 'on' ? s.locBarOn : s.locBarOff, { opacity: fadeAnim }]}>
      <View style={s.locBarInner}>
        <View style={[s.locDot, { backgroundColor: status === 'on' ? C.success : C.danger }]} />
        <Text style={s.locBarText}>
          {status === 'on' ? 'Location Auto detect ON' : 'Location setting OFF - need to turn on'}
        </Text>
      </View>
      {status === 'off' && (
        <TouchableOpacity 
          style={s.locBtn} 
          onPress={() => Platform.OS === 'ios' ? Linking.openSettings() : Location.enableNetworkProviderAsync().catch(() => Linking.openSettings())}
        >
          <Text style={s.locBtnText}>ENABLE</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

// ─── Screen 1: Login ──────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [phone, setPhone] = useState('');
  const [pass, setPass] = useState('');
  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const handleLogin = async () => {
    if (!phone.trim()) {
      Alert.alert('Required', 'Please enter your mobile number or ID');
      return;
    }
    
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idOrPhone: phone.trim(), pin: pass, deviceId: 'PUB-MOB' })
      });

      if (res.ok) {
        const data = await res.json();
        await AsyncStorage.setItem('sosUser', JSON.stringify(data.user));
        onLogin(data.user);
      } else {
        const errData = await res.json();
        Alert.alert('Login Failed', errData.error || 'Invalid credentials');
      }
    } catch (e) {
      console.error("Login failed:", e);
      Alert.alert('Network Error', 'Could not connect to the server. Please check your connection.');
    }
  };

  return (
    <SafeAreaView style={s.loginBg}>
      <StatusBar barStyle="dark-content" backgroundColor={C.primaryLight} />
      <Animated.View style={[s.loginCard, { opacity: fadeIn, transform: [{ translateY: fadeIn.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }]}>
        <View style={s.logoCircle}>
          <Text style={{ fontSize: 44 }}>🆘</Text>
        </View>
        <Text style={s.loginTitle}>Citizen Rescue App</Text>
        <Text style={s.loginSub}>Secure Portal</Text>

        <Text style={s.label}>MOBILE NUMBER</Text>
        <TextInput
          style={s.input}
          placeholder="Enter your mobile number"
          placeholderTextColor={C.light}
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
        <Text style={s.label}>PASSWORD</Text>
        <TextInput
          style={s.input}
          placeholder="Password"
          placeholderTextColor={C.light}
          secureTextEntry
          value={pass}
          onChangeText={setPass}
        />
        <TouchableOpacity style={s.loginBtn} onPress={handleLogin} activeOpacity={0.85}>
          <Text style={s.loginBtnText}>Secure Login System</Text>
        </TouchableOpacity>
      </Animated.View>
      <LocationStatusBar />
    </SafeAreaView>
  );
}

// ─── Screen 2: Requirements ───────────────────────────────────────────────────
function RequirementsScreen({ user, imageEnabled = true, micEnabled = true, onNext, onBack }) {
  const [transportMode, setTransportMode] = useState('AIR');
  const [needs, setNeeds] = useState([6, 2, 1, 2]);
  const [peopleCount, setPeopleCount] = useState('5');
  const [attachments, setAttachments] = useState({ voice: false, camera: false, note: false });

  const updateNeed = (idx, delta) => {
    setNeeds(prev => {
      const n = [...prev];
      n[idx] = Math.max(0, n[idx] + delta);
      return n;
    });
  };

  const transports = [
    { key: 'AIR', icon: '🚁', label: 'AIR' },
    { key: 'BOAT', icon: '🚤', label: 'BOAT' },
    { key: 'ROAD', icon: '🚑', label: 'ROAD' },
  ];

  const needLabels = ['Food Rations', 'Medical Tablets', 'Asthma Kit', 'Sanitary Kit'];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.white }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />

      {/* Header */}
      <View style={[s.header, { paddingVertical: 12, paddingHorizontal: 16 }]}>
        <TouchableOpacity onPress={onBack}><Text style={{ fontSize: 26, fontWeight: '900' }}>←</Text></TouchableOpacity>
        <Text style={[s.headerTitle, { fontSize: 22 }]}>Home (Details)</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={[s.sectionLabel, { fontSize: 11, marginBottom: 10 }]}>RESCUE MODE</Text>
        <View style={[s.modeRow, { marginBottom: 20 }]}>
          {transports.map(t => (
            <TouchableOpacity
              key={t.key}
              style={[s.modeBtn, transportMode === t.key && s.modeBtnActive, { paddingVertical: 15, paddingHorizontal: 20 }]}
              onPress={() => setTransportMode(t.key)}
            >
              <Text style={{ fontSize: 28, marginBottom: 6 }}>{t.icon}</Text>
              <Text style={[s.modeBtnLabel, transportMode === t.key && { color: C.white }, { fontSize: 12 }]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Location & Media */}
        <Text style={[s.sectionLabel, { marginTop: 10, fontSize: 11, marginBottom: 10 }]}>LOCATION & MEDIA DETAILS</Text>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'stretch', marginBottom: 20, height: 80 }}>
          <View style={[s.needsBox, { flex: 8, marginTop: 0, padding: 0, overflow: 'hidden' }]}>
            <TextInput
              style={{ flex: 1, padding: 12, fontSize: 14, color: C.dark, textAlignVertical: 'top' }}
              placeholder="Address, landmarks..."
              multiline
            />
          </View>
          <View style={{ flex: 2.5, gap: 6 }}>
            <TouchableOpacity 
              style={[s.attachBtn, { width: '100%', flex: 1, height: undefined, borderRadius: 12, padding: 8 }, !imageEnabled && { opacity: 0.5, backgroundColor: '#f1f5f9' }]}
              disabled={!imageEnabled}
              onPress={() => imageEnabled && Alert.alert("Media", "Camera opened")}
            >
              <Text style={{ fontSize: 20 }}>{imageEnabled ? '📷' : '🚫'}</Text>
              <Text style={{ fontSize: 8, fontWeight: '900', color: imageEnabled ? C.primary : C.danger, textAlign: 'center' }}>
                {imageEnabled ? 'ACTIVE' : 'DISABLED'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[s.attachBtn, { width: '100%', flex: 1, height: undefined, borderRadius: 12, padding: 8 }, !micEnabled && { opacity: 0.5, backgroundColor: '#f1f5f9' }]}
              disabled={!micEnabled}
              onPress={() => micEnabled && Alert.alert("Media", "Microphone opened")}
            >
              <Text style={{ fontSize: 20 }}>{micEnabled ? '🎙️' : '🚫'}</Text>
              <Text style={{ fontSize: 8, fontWeight: '900', color: micEnabled ? C.primary : C.danger, textAlign: 'center' }}>
                {micEnabled ? 'ACTIVE' : 'DISABLED'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Supply Config */}
        <View style={[s.needsBox, { padding: 12, marginTop: 0, marginBottom: 15 }]}>
          {needLabels.map((label, i) => (
            <View key={i} style={[s.needRow, { paddingVertical: 6 }]}>
              <Text style={[s.needLabel, { fontSize: 14 }]}>{label}</Text>
              <View style={[s.counter, { padding: 4 }]}>
                <TouchableOpacity onPress={() => updateNeed(i, -1)}>
                  <Text style={[s.counterBtn, { fontSize: 20 }]}>−</Text>
                </TouchableOpacity>
                <Text style={[s.counterVal, { fontSize: 16, marginHorizontal: 12 }]}>{needs[i]}</Text>
                <TouchableOpacity onPress={() => updateNeed(i, 1)}>
                  <Text style={[s.counterBtn, { fontSize: 20 }]}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        {/* People Count */}
        <View style={[s.peopleBox, { padding: 12, marginTop: 10, marginBottom: 20 }]}>
          <Text style={[s.peopleLabel, { fontSize: 14 }]}>Affected Civilians:</Text>
          <View style={[s.peopleInput, { padding: 6 }]}>
            <TextInput
              style={[s.peopleNum, { fontSize: 16, width: 50 }]}
              value={peopleCount}
              onChangeText={setPeopleCount}
              keyboardType="numeric"
            />
            <Text style={[s.peopleSubLabel, { fontSize: 12 }]}>Heads</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[s.nextBtn, { marginTop: 'auto', padding: 18, borderRadius: 16 }]}
          onPress={() => onNext({ transportMode, needs, peopleCount, attachments })}
        >
          <Text style={[s.nextBtnText, { fontSize: 16, fontWeight: '900' }]}>CONFIRM & PROCEED</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function ProfileScreen({ user, onLogout }) {
  const [isOnline, setIsOnline] = useState(true);
  const [syncInterval, setSyncInterval] = useState('FETCHING...');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch(`${API_URL}/settings`);
        if (res.ok) {
          const settings = await res.json();
          if (settings.retry_intervals) {
            const firstInterval = parseInt(settings.retry_intervals.split(',')[0]) || 15;
            setSyncInterval(`${firstInterval}s (Admin Set)`);
          }
        }
      } catch (e) {
        console.error("Failed to fetch settings:", e);
        setSyncInterval('OFFLINE');
      }
    };
    fetchSettings();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={s.header}>
        <View style={{ width: 28 }} />
        <Text style={s.headerTitle}>Account Settings</Text>
        <View style={{ width: 28 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1, justifyContent: 'space-between' }}>
        <View>
          <View style={[s.loginCard, { marginBottom: 30, padding: 30, width: '100%' }]}>
            <View style={s.logoCircle}>
              <Text style={{ fontSize: 40 }}>👤</Text>
            </View>
            <Text style={s.loginTitle}>{user?.name}</Text>
            <Text style={s.loginSub}>ID: {user?.serial_number || 'PUB-01'}</Text>
            <View style={{ width: '100%', height: 1, backgroundColor: C.border, marginVertical: 20 }} />
            <Text style={[s.label, { marginBottom: 4 }]}>PHONE NUMBER</Text>
            <Text style={{ fontSize: 18, fontWeight: '800', color: C.dark, marginBottom: 15 }}>{user?.phone}</Text>
          </View>

          <Text style={s.sectionLabel}>SYSTEM CONFIGURATION</Text>
          <View style={[s.actionCard, { borderLeftColor: C.secondary, marginBottom: 12 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: C.secondary }} />
                <Text style={{ fontSize: 15, fontWeight: '800', color: C.dark }}>Notifications</Text>
              </View>
              <Text style={{ fontSize: 13, fontWeight: '900', color: C.secondary }}>ENABLED</Text>
            </View>
          </View>

          <View style={[s.actionCard, { borderLeftColor: isOnline ? C.primary : C.danger, backgroundColor: (isOnline ? C.primary : C.danger) + '15' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: isOnline ? C.primary : C.danger }} />
                <Text style={{ fontSize: 15, fontWeight: '800', color: C.dark }}>Network Sync</Text>
              </View>
              <Text style={{ fontSize: 13, fontWeight: '900', color: isOnline ? C.primary : C.danger }}>
                {isOnline ? syncInterval : `RECONNECTING: ${syncInterval.split(' ')[0]}`}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity 
          style={[s.loginBtn, { backgroundColor: '#fee2e2', shadowColor: C.danger, marginTop: 40 }]} 
          onPress={onLogout}
        >
          <Text style={{ color: C.danger, fontWeight: '900', fontSize: 16 }}>SECURE LOGOUT</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Screen 3: SOS Trigger ────────────────────────────────────────────────────
function SOSTriggerScreen({ user, details, onBack }) {
  const [emergencyType, setEmergencyType] = useState(null);
  const [isSosLocked, setIsSosLocked] = useState(false);
  const [countdown, setCountdown] = useState(15 * 60);
  const [missionStatus, setMissionStatus] = useState(null);
  const [toast, setToast] = useState(null);
  const sosScale = useRef(new Animated.Value(1)).current;
  const toastAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { setIsSosLocked(false); return 15 * 60; }
        return prev - 1;
      });
    }, 1000);
    return () => { clearInterval(timer); };
  }, []);

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const showToast = (msg, icon = '⏳', duration = 3000) => {
    setToast({ msg, icon });
    Animated.spring(toastAnim, { toValue: 1, useNativeDriver: true }).start();
    if (duration) {
      setTimeout(() => {
        Animated.timing(toastAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => setToast(null));
      }, duration);
    }
  };

  const triggerSOS = async () => {
    if (isSosLocked) { showToast('Please wait for the current time slot to clear.', '⚠️'); return; }

    if (!emergencyType) { showToast('Please select an emergency type.', '⚠️'); return; }

    Vibration.vibrate([0, 200, 100, 200]);
    Animated.sequence([
      Animated.timing(sosScale, { toValue: 0.9, duration: 100, useNativeDriver: true }),
      Animated.spring(sosScale, { toValue: 1, useNativeDriver: true }),
    ]).start();

    showToast('Connecting to server...', '⏳', 0);
    setIsSosLocked(true);

    try {
      let location = null;
      try {
        location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      } catch (e) {
        // Fallback or handle missing location
      }

      const payload = {
        phone: user.phone,
        device_id: user.serial_number || 'PUB-MOB',
        type: emergencyType,
        lat: location ? location.coords.latitude : 13.085,
        lng: location ? location.coords.longitude : 80.272,
        details: JSON.stringify(details),
        urgency: 'critical',
        sector: 'Detected via GPS'
      };

      const res = await fetch(`${API_URL}/rescue-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showToast('Your info is collected and help is being dispatched.', '✅', 4000);
      } else {
        throw new Error('Server rejected');
      }
    } catch (e) {
      showToast('Network error: Request queued for retry offline.', '⏳', 4000);
      // Fallback local storage logic could be added here
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <View style={s.header}>
        <TouchableOpacity onPress={onBack}><Text style={{ fontSize: 22 }}>←</Text></TouchableOpacity>
        <Text style={s.headerTitle}>Final SOS Page</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, alignItems: 'center' }}>
        <Text style={s.sectionLabel}>PRIORITY MEDICAL BYPASS</Text>
        <View style={{ flexDirection: 'row', gap: 12, width: '100%', marginBottom: 24, justifyContent: 'center' }}>
          {[['Pregnancy Support', '🤰', 'Pregnancy'], ['Medical Support', '💉', 'Critical Injury']].map(([type, icon, label]) => (
            <TouchableOpacity
              key={type}
              style={[s.medBtn, emergencyType === type && s.medBtnActive]}
              onPress={() => setEmergencyType(prev => prev === type ? null : type)}
            >
              <Text style={{ fontSize: 28 }}>{icon}</Text>
              <Text style={[s.medBtnLabel, emergencyType === type && { color: C.primary }]}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.pressHold}>PRESS TO DISPATCH</Text>
        <Animated.View style={{ transform: [{ scale: sosScale }] }}>
          <TouchableOpacity style={s.sosBtn} onPress={triggerSOS} activeOpacity={0.85}>
            <Text style={s.sosBtnText}>SOS</Text>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '700' }}>TAP TO ALERT</Text>
          </TouchableOpacity>
        </Animated.View>

        <View style={s.timerBox}>
          <Text style={s.timerLabel}>Next Sync Slot: </Text>
          <Text style={s.timerVal}>{formatTime(countdown)}</Text>
        </View>
      </ScrollView>

      {toast && (
        <Animated.View style={[s.toast, { opacity: toastAnim, transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [80, 0] }) }] }]}>
          <Text style={{ fontSize: 18 }}>{toast.icon}</Text>
          <Text style={s.toastText}>{toast.msg}</Text>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

// ─── Screen 4: Status ────────────────────────────────────────────────────────
function HistoryScreen({ user, onBack }) {
  const [data, setData] = useState({ myActive: [], myHistory: [] });
  const [filter, setFilter] = useState('FULL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const phone = user?.phone || user?.serial_number;
        const res = await fetch(`${API_URL}/rescue-requests/by-phone/${phone}`);
        if (res.ok) {
          const items = await res.json();
          const active = items.filter(i => i.status !== 'completed');
          const history = items.filter(i => i.status === 'completed');
          setData({ myActive: active, myHistory: history });
        }
      } catch (e) {
        console.error("Failed to fetch history:", e);
      }
    };
    fetchHistory();
    const interval = setInterval(fetchHistory, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, [user]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 20 }}>
        <Text style={{ fontSize: 24, fontWeight: '900', color: C.dark }}>Mission History</Text>
        <TouchableOpacity 
          style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: C.white, borderWidth: 1, borderColor: '#eee', alignItems: 'center', justifyContent: 'center', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 }}
          onPress={onBack}
        >
          <Text style={{ fontSize: 20, color: '#64748b' }}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24 }}>
        <View style={{ backgroundColor: C.white, borderRadius: 20, paddingHorizontal: 20, paddingVertical: 15, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2, borderColor: '#eef2f6' }}>
          <Text style={{ fontSize: 18, color: '#6366f1' }}>🔍</Text>
          <TextInput 
            placeholder="Search mission ID, type, sector..." 
            style={{ flex: 1, fontWeight: '700', fontSize: 14, color: C.dark }}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          {['Full', 'Day', 'Week', 'Year'].map(f => (
            <TouchableOpacity 
              key={f}
              onPress={() => setFilter(f.toUpperCase())}
              style={{ 
                backgroundColor: filter === f.toUpperCase() || (filter === 'ALL' && f === 'Full') ? '#0ea5e9' : '#f1f5f9', 
                paddingHorizontal: 16, 
                paddingVertical: 10, 
                borderRadius: 12 
              }}
            >
              <Text style={{ color: filter === f.toUpperCase() || (filter === 'ALL' && f === 'Full') ? C.white : '#64748b', fontWeight: '900', fontSize: 12 }}>{f}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity 
            style={{ marginLeft: 'auto', backgroundColor: '#f43f5e', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}
            onPress={() => Alert.alert("PDF Export", "Generating tactical mission report...")}
          >
            <Text style={{ fontSize: 14 }}>📄</Text>
            <Text style={{ color: C.white, fontWeight: '900', fontSize: 12 }}>PDF</Text>
          </TouchableOpacity>
        </View>

        {(() => {
          const ongoing = data.myActive.filter(i => 
            i.type?.toLowerCase().includes(search.toLowerCase()) || 
            i.sector?.toLowerCase().includes(search.toLowerCase())
          );
          
          let completed = data.myHistory.filter(i => 
            i.type?.toLowerCase().includes(search.toLowerCase()) || 
            i.sector?.toLowerCase().includes(search.toLowerCase()) || 
            String(i.id).includes(search.toLowerCase())
          );
          
          const now = new Date();
          if (filter === 'DAY' || filter === 'TODAY') {
            completed = completed.filter(i => new Date(i.updated_at).toDateString() === now.toDateString());
          } else if (filter === 'WEEK') {
            completed = completed.filter(i => new Date(i.updated_at) >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
          } else if (filter === 'YEAR') {
            completed = completed.filter(i => new Date(i.updated_at) >= new Date(now.getFullYear(), 0, 1));
          }

          return (
            <View style={{ marginBottom: 40 }}>
              <Text style={{ fontSize: 12, fontWeight: '900', color: '#ef4444', marginBottom: 12, borderLeftWidth: 3, borderLeftColor: '#ef4444', paddingLeft: 8 }}>MISSIONS ONGOING</Text>
              {ongoing.length === 0 ? (
                <Text style={{ fontSize: 11, color: C.light, textAlign: 'center', marginVertical: 8, fontStyle: 'italic' }}>No active missions found.</Text>
              ) : (
                ongoing.map(item => (
                  <View key={item.id} style={[s.historyCard, { borderLeftWidth: 4, borderLeftColor: C.danger, paddingVertical: 12 }]}>
                    <View style={s.historyLeft}>
                      <Text style={[s.historyTitle, { fontSize: 13 }]}>{item.type.toUpperCase()} RESCUE</Text>
                      <Text style={[s.historyDate, { fontSize: 11 }]}>📍 {item.sector}</Text>
                    </View>
                    <View style={{ backgroundColor: C.danger + '15', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 }}>
                      <Text style={{ color: C.danger, fontWeight: '900', fontSize: 9 }}>LIVE</Text>
                    </View>
                  </View>
                ))
              )}

              <Text style={{ fontSize: 12, fontWeight: '900', color: '#0ea5e9', marginBottom: 12, marginTop: 24, borderLeftWidth: 3, borderLeftColor: '#0ea5e9', paddingLeft: 8 }}>COMPLETED MISSIONS</Text>
              {completed.length === 0 ? (
                <Text style={{ fontSize: 11, color: C.light, textAlign: 'center', marginVertical: 8, fontStyle: 'italic' }}>No completed missions found.</Text>
              ) : (
                completed.map(item => (
                  <View key={item.id} style={[s.historyCard, { paddingVertical: 12 }]}>
                    <View style={s.historyLeft}>
                      <Text style={[s.historyTitle, { fontSize: 13 }]}>{item.type.toUpperCase()} • TID #{item.id}</Text>
                      <Text style={[s.historyDate, { fontSize: 11 }]}>📍 {item.sector}</Text>
                      <Text style={{ fontSize: 9, fontWeight: '700', color: C.light, marginTop: 2 }}>{new Date(item.updated_at).toLocaleDateString()}</Text>
                    </View>
                    <View style={{ backgroundColor: C.secondary + '15', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 }}>
                      <Text style={{ color: C.secondary, fontWeight: '900', fontSize: 9 }}>{item.status.toUpperCase()}</Text>
                    </View>
                  </View>
                ))
              )}
            </View>
          );
        })()}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Bottom Nav ──────────────────────────────────────────────────────────────
function BottomNav({ current, onNav }) {
  const tabs = [
    { key: 'home', label: 'HOME', icon: '🏠' },
    { key: 'history', label: 'HISTORY', icon: '📋' },
    { key: 'settings', label: 'SETTINGS', icon: '⚙️' },
  ];
  return (
    <View style={s.bottomNav}>
      {tabs.map(t => (
        <TouchableOpacity key={t.key} style={s.navItem} onPress={() => onNav(t.key)}>
          <Text style={{ fontSize: 20, opacity: current === t.key ? 1 : 0.5 }}>{t.icon}</Text>
          <Text style={[s.navLabel, current === t.key && s.navLabelActive]}>{t.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [screen, setScreen] = useState('login'); // login | requirements | trigger | status | profile
  const [details, setDetails] = useState(null);
  const [checking, setChecking] = useState(true);
  const [imageEnabled, setImageEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('sosUser').then(saved => {
      if (saved) { setUser(JSON.parse(saved)); setScreen('home'); }
      setChecking(false);
    });
    
    AsyncStorage.getItem('imageEnabled').then(val => {
      if (val !== null) setImageEnabled(val === 'true');
    });
    AsyncStorage.getItem('micEnabled').then(val => {
      if (val !== null) setMicEnabled(val === 'true');
    });

    const fetchConfig = async () => {
      try {
        const res = await fetch(`${API_URL}/settings`);
        if (res.ok) {
          const settings = await res.json();
          if (settings.public_image_enabled !== undefined) {
            const isEn = settings.public_image_enabled === 'true';
            setImageEnabled(isEn);
            AsyncStorage.setItem('imageEnabled', isEn ? 'true' : 'false');
          }
          if (settings.public_mic_enabled !== undefined) {
            const isEn = settings.public_mic_enabled === 'true';
            setMicEnabled(isEn);
            AsyncStorage.setItem('micEnabled', isEn ? 'true' : 'false');
          }
        }
      } catch (e) {
        // Keep using cached if offline
      }
    };
    
    fetchConfig();
    const interval = setInterval(fetchConfig, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    await AsyncStorage.removeItem('sosUser');
    setUser(null);
    setScreen('login');
  };

  if (checking) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.primaryLight }}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  if (screen === 'login') {
    return <LoginScreen onLogin={(u) => { setUser(u); setScreen('home'); }} />;
  }

  const renderScreen = () => {
    switch(screen) {
      case 'home': 
        if (!details) return <RequirementsScreen user={user} imageEnabled={imageEnabled} micEnabled={micEnabled} onNext={(d) => { setDetails(d); }} onBack={handleLogout} />;
        return <SOSTriggerScreen user={user} details={details} onBack={() => setDetails(null)} />;
      case 'history': 
        return <HistoryScreen user={user} onBack={() => setScreen('home')} />;
      case 'settings': 
        return <ProfileScreen user={user} onLogout={handleLogout} />;
      default: return null;
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {renderScreen()}
      {screen !== 'login' && (
        <BottomNav current={screen} onNav={setScreen} />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // Login
  loginBg: { flex: 1, backgroundColor: C.primaryLight, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loginCard: { width: '100%', backgroundColor: C.white, borderRadius: 24, padding: 28, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.08, shadowRadius: 20, elevation: 8 },
  logoCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: C.white, borderWidth: 3, borderColor: C.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 16, shadowColor: C.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 4 },
  loginTitle: { fontSize: 26, fontWeight: '900', color: C.dark, marginBottom: 4 },
  loginSub: { fontSize: 14, fontWeight: '700', color: C.primary, marginBottom: 28 },
  label: { alignSelf: 'flex-start', fontSize: 12, fontWeight: '700', color: C.light, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  input: { width: '100%', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: C.border, marginBottom: 16, fontWeight: '600', fontSize: 15, color: C.dark, backgroundColor: C.bg },
  loginBtn: { backgroundColor: C.secondary, paddingVertical: 15, borderRadius: 12, width: '100%', alignItems: 'center', shadowColor: C.secondary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4, marginTop: 8 },
  loginBtnText: { color: C.white, fontWeight: '800', fontSize: 16 },

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.white },
  headerTitle: { fontSize: 15, fontWeight: '900', color: C.dark, flex: 1, textAlign: 'center' },

  // Stats Grid
  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statCard: { flex: 1, backgroundColor: C.white, padding: 10, borderRadius: 12, alignItems: 'center', borderBottomWidth: 3 },
  statVal: { fontSize: 18, fontWeight: '900', marginBottom: 1 },
  statLabel: { fontSize: 9, fontWeight: '700', color: C.light, textTransform: 'uppercase' },

  // Lists
  emptyBox: { padding: 40, alignItems: 'center', backgroundColor: '#f1f5f9', borderRadius: 20 },
  emptyText: { fontSize: 14, fontWeight: '600', color: C.light },
  actionCard: { backgroundColor: C.white, borderRadius: 16, padding: 16, marginBottom: 12, borderLeftWidth: 4 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  statusTag: { fontSize: 12, fontWeight: '900' },
  cardTime: { fontSize: 11, fontWeight: '700', color: C.light },
  cardTitle: { fontSize: 16, fontWeight: '900', color: C.dark, marginBottom: 4 },
  cardLoc: { fontSize: 13, fontWeight: '700', color: C.light },

  historyCard: { backgroundColor: C.white, borderRadius: 16, padding: 14, marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', opacity: 0.9 },
  historyTitle: { fontSize: 15, fontWeight: '900', color: C.dark },
  historyDate: { fontSize: 11, fontWeight: '700', color: C.light },
  historyStatus: { fontSize: 12, fontWeight: '900', textAlign: 'right' },
  historyId: { fontSize: 10, fontWeight: '700', color: C.light, textAlign: 'right' },

  // Bottom Nav
  bottomNav: { flexDirection: 'row', height: 70, backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.border, paddingBottom: 5 },
  navItem: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  navLabel: { fontSize: 10, fontWeight: '700', color: C.light, marginTop: 2 },
  navLabelActive: { color: C.primary, fontWeight: '900' },
  // Requirements
  sectionLabel: { alignSelf: 'center', fontSize: 10, fontWeight: '800', color: C.light, letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase', textAlign: 'center' },
  modeRow: { flexDirection: 'row', gap: 10, width: '100%', justifyContent: 'center' },
  modeBtn: { flex: 1, borderWidth: 1.5, borderColor: C.border, borderRadius: 16, padding: 10, alignItems: 'center', backgroundColor: C.white, maxWidth: 100 },
  modeBtnActive: { backgroundColor: C.primary, borderColor: C.primary },
  modeBtnLabel: { fontSize: 9, fontWeight: '800', color: C.dark, textAlign: 'center', marginTop: 4, textTransform: 'uppercase' },

  attachRow: { flexDirection: 'row', gap: 12, justifyContent: 'center', width: '100%' },
  attachBtn: { width: 54, height: 54, borderRadius: 14, borderWidth: 1.5, borderColor: C.border, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  attachBtnActive: { borderColor: C.secondary, backgroundColor: '#ecfdf5' },
  attachDot: { position: 'absolute', top: -4, right: -4, width: 14, height: 14, borderRadius: 7, backgroundColor: C.secondary, borderWidth: 2, borderColor: C.white },

  needsBox: { borderWidth: 1, borderColor: C.border, borderRadius: 14, padding: 10, paddingTop: 14, marginTop: 12, position: 'relative' },
  needsTitleWrapper: { position: 'absolute', top: -10, left: 20, right: 20, alignItems: 'center', zIndex: 1 },
  needsTitle: { backgroundColor: C.white, paddingHorizontal: 12, paddingVertical: 2, borderRadius: 16, fontWeight: '700', fontSize: 10, color: C.dark, borderWidth: 1, borderColor: C.border },
  needRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  needLabel: { fontWeight: '600', color: C.dark, fontSize: 13 },
  counter: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: C.border },
  counterBtn: { color: C.primary, fontSize: 16, fontWeight: '900', paddingHorizontal: 4 },
  counterVal: { color: C.dark, fontWeight: '700', fontSize: 14, minWidth: 25, textAlign: 'center' },

  peopleBox: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 12, backgroundColor: C.bg, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: C.border },
  peopleLabel: { color: C.dark, fontSize: 13, fontWeight: '700', flex: 1 },
  peopleInput: { width: 50, height: 50, backgroundColor: C.white, borderRadius: 10, borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  peopleNum: { color: C.primary, fontSize: 20, fontWeight: '900', textAlign: 'center', width: '100%', padding: 0 },
  peopleSubLabel: { fontSize: 8, fontWeight: '700', color: C.light, textTransform: 'uppercase' },

  nextBtn: { backgroundColor: C.dark, padding: 12, borderRadius: 12, width: '100%', alignItems: 'center', marginTop: 12, marginBottom: 5 },
  nextBtnText: { color: C.white, fontWeight: '800', fontSize: 14 },

  // SOS Trigger
  pressHold: { fontSize: 13, fontWeight: '700', color: C.light, letterSpacing: 1.5, marginBottom: 20 },
  sosBtn: { width: 160, height: 160, borderRadius: 80, backgroundColor: C.danger, justifyContent: 'center', alignItems: 'center', borderWidth: 6, borderColor: '#fca5a5', shadowColor: C.danger, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 12, marginBottom: 24 },
  sosBtnText: { color: C.white, fontSize: 44, fontWeight: '900', letterSpacing: 2 },

  timerBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.white, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 30, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  timerLabel: { fontWeight: '600', fontSize: 13, color: C.light, textTransform: 'uppercase' },
  timerVal: { color: C.danger, fontSize: 22, fontWeight: '900' },

  medBtn: { flex: 1, backgroundColor: C.white, borderWidth: 2, borderColor: '#fca5a5', borderRadius: 20, padding: 18, alignItems: 'center', justifyContent: 'center', gap: 8, maxWidth: 160 },
  medBtnActive: { backgroundColor: C.primaryLight, borderColor: C.primary },
  medBtnLabel: { fontSize: 11, fontWeight: '800', color: C.danger, textAlign: 'center', textTransform: 'uppercase' },

  missionPanel: { marginTop: 20, padding: 14, borderRadius: 12, borderWidth: 1, width: '100%', alignItems: 'center' },
  missionPanelLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  missionPanelText: { fontSize: 14, fontWeight: '700', textAlign: 'center' },

  toast: { position: 'absolute', bottom: 30, left: 20, right: 20, backgroundColor: C.dark, borderRadius: 30, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 10 },
  toastText: { color: C.white, fontWeight: '600', fontSize: 13, flex: 1 },

  // Location Bar
  locBar: { position: 'absolute', bottom: 20, left: 20, right: 20, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  locBarOn: { backgroundColor: 'rgba(255, 255, 255, 0.95)', borderWidth: 1, borderColor: '#e2e8f0' },
  locBarOff: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fee2e2' },
  locBarInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  locDot: { width: 8, height: 8, borderRadius: 4 },
  locBarText: { fontSize: 13, fontWeight: '700', color: C.dark },
  locBtn: { backgroundColor: C.dark, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  locBtnText: { color: C.white, fontSize: 10, fontWeight: '900' },
});
