import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, SafeAreaView, StatusBar, Alert, ActivityIndicator,
  Animated, Dimensions, Image
} from 'react-native';
import { WebView } from 'react-native-webview';
// Simple persistent storage using global state + JSON
const Store = {
  _data: {},
  async setItem(key, val) { this._data[key] = val; },
  async getItem(key) { return this._data[key] || null; },
  async removeItem(key) { delete this._data[key]; },
};
const AsyncStorage = Store;

import { Platform } from 'react-native';
const API_URL = 'http://192.168.1.8:3001/api';
const { width } = Dimensions.get('window');

// ─── Color Palette ────────────────────────────────────────────────────────────
const C = {
  primary: '#0ea5e9', // Cyber Blue
  primaryLight: '#e0f2fe',
  secondary: '#10b981', // Emerald
  danger: '#f43f5e', // Rose
  warning: '#f59e0b', // Amber
  bg: '#020617', // Midnight
  surface: '#0f172a', // Slate 900
  surfaceLight: '#1e293b', // Slate 800
  text: '#f8fafc', // Ghost White
  light: '#94a3b8', // Slate 400
  border: '#334155', // Slate 700
  white: '#ffffff',
};

// ─── Dynamic Styles ───────────────────────────────────────────────────────────
const dynamicStyles = {
  filterBtnActive: (type) => ({
    backgroundColor: type === 'sos' ? C.danger + '33' : type === 'medical' ? C.secondary + '33' : C.warning + '33',
    borderColor: type === 'sos' ? C.danger : type === 'medical' ? C.secondary : C.warning
  }),
  filterBtnTextActive: (type) => ({
    color: type === 'sos' ? C.danger : type === 'medical' ? C.secondary : C.warning
  }),
  typeBadge: (type) => ({
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.bg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 6
  }),
  priorityBadge: (urgency) => ({
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: urgency === 'critical' ? C.danger : C.surfaceLight
  }),
};

// ─── Utility ──────────────────────────────────────────────────────────────────
const getDistance = (lat1, lng1, lat2, lng2) => {
  const d = (Math.abs(lat1 - lat2) + Math.abs(lng1 - lng2)) * 111;
  return d.toFixed(1);
};

const taskIcon = (type) =>
  type === 'sos' ? '🚨' : type === 'medical' ? '🏥' : type === 'pregnancy' ? '🚑' : '🍱';

const taskColor = (type) =>
  type === 'sos' ? C.danger : type === 'food' ? C.warning : C.secondary;

const urgencyBg = (u) =>
  ({ critical: '#fee2e2', high: '#ffedd5', medium: '#fef3c7', low: '#e0f2fe' }[u] || C.bg);
const urgencyText = (u) =>
  ({ critical: C.danger, high: '#ea580c', medium: C.warning, low: '#0284c7' }[u] || C.light);




// ─── Login Screen ─────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [phone, setPhone] = useState('');
  const [pass, setPass] = useState('');
  const [loading, setLoading] = useState(false);
  const shake = useRef(new Animated.Value(0)).current;

  const triggerShake = () => {
    Animated.sequence([
      Animated.timing(shake, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const doLogin = async () => {
    if (!phone.trim()) { triggerShake(); return; }
    setLoading(true);
    let user;
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idOrPhone: phone.trim(), pin: pass, deviceId: 'MEM-MOB' }),
      });
      if (res.ok) {
        const data = await res.json();
        user = data.user;
      } else {
        const err = await res.json();
        Alert.alert('Login Failed', err.error || 'Invalid PIN');
        setLoading(false);
        return;
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Network Error', 'Could not connect to the server. Please check your connection.');
      setLoading(false);
      return;
    }
    await AsyncStorage.setItem('rescueUser', JSON.stringify(user));
    setLoading(false);
    onLogin(user);
  };

  return (
    <SafeAreaView style={s.loginContainer}>
      <StatusBar barStyle="dark-content" backgroundColor={C.primaryLight} />
      <Animated.View style={[s.loginCard, { transform: [{ translateX: shake }] }]}>
        <View style={{ width: 90, height: 90, borderRadius: 24, overflow: 'hidden', marginBottom: 20, shadowColor: C.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 5 }}>
          <Image
            source={require('./assets/official_rescuer_icon.png')}
            style={{ width: '100%', height: '100%', resizeMode: 'cover' }}
          />
        </View>
        <Text style={s.loginTitle}>Rescuer Ops</Text>
        <Text style={s.loginSub}>EMERGENCY FIELD OPERATIONS</Text>

        <TextInput
          style={s.input}
          placeholder="Mobile Number"
          placeholderTextColor={C.light}
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
        <TextInput
          style={s.input}
          placeholder="Password"
          placeholderTextColor={C.light}
          secureTextEntry
          value={pass}
          onChangeText={setPass}
        />
        <TouchableOpacity style={s.loginBtn} onPress={doLogin} disabled={loading} activeOpacity={0.85}>
          {loading
            ? <ActivityIndicator color={C.white} />
            : <Text style={s.loginBtnText}>LOGIN</Text>}
        </TouchableOpacity>
      </Animated.View>
    </SafeAreaView>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({ task, onAccept, onDecline, onComplete, isActive }) {
  const isCritical = task.urgency === 'critical';
  const dist = 1.2; // Mock distance

  return (
    <View style={[
      s.taskCard,
      isCritical && s.taskCardCritical,
      isActive && s.taskCardActive
    ]}>
      <View style={s.taskHeader}>
        <View style={dynamicStyles.typeBadge(task.type)}>
          <Text style={s.typeIcon}>{taskIcon(task.type)}</Text>
          <Text style={s.typeText}>{(task.type || 'TASK').toUpperCase()}</Text>
        </View>
        <View style={dynamicStyles.priorityBadge(task.urgency)}>
          <Text style={s.priorityText}>{task.urgency?.toUpperCase()}</Text>
        </View>
      </View>

      <View style={s.taskBody}>
        <Text style={s.taskLocation}>📍 {task.sector || 'Coordinate Point'}</Text>
        {task.message && (
          <Text style={s.taskMessage}>"{task.message}"</Text>
        )}
        <View style={s.taskMetaRow}>
          <Text style={s.metaText}>⏱️ {dist} KM</Text>
          <Text style={s.metaText}>🆔 {task.id.split('_')[1]}</Text>
        </View>
      </View>

      <View style={s.taskActions}>
        {isCritical && !isActive ? (
          <>
            <TouchableOpacity style={s.btnDeclineSec} onPress={() => onDecline(task.id)}>
              <Text style={s.btnDeclineText}>IGNORE</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.btnAcceptPri} onPress={() => onAccept(task.id)}>
              <Text style={s.btnAcceptText}>RESPOND</Text>
            </TouchableOpacity>
          </>
        ) : !isCritical && !isActive ? (
          <TouchableOpacity style={s.btnCompletePri} onPress={() => onComplete(task.id)}>
            <Text style={s.btnCompleteText}>MARK COMPLETED</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={s.btnActiveMission} onPress={() => onComplete(task.id)}>
            <View style={s.pulseContainer}>
              <View style={s.pulseDot} />
              <Text style={s.btnCompleteText}>COMPLETE MISSION</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Dashboard Screen ─────────────────────────────────────────────────────────
function DashboardScreen({ user, onLogout }) {
  const [tasks, setTasks] = useState([]);
  const [activeTask, setActiveTask] = useState(null);
  const [filters, setFilters] = useState({ sos: true, medical: true, food: true });
  const [notif, setNotif] = useState('Monitoring All Zones...');
  const [notifAlert, setNotifAlert] = useState(false);
  const [tab, setTab] = useState('tasks');
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [criticalAlert, setCriticalAlert] = useState(null); // { id, message, cmdId }
  const [interruptedTask, setInterruptedTask] = useState(null);
  const notifAnim = useRef(new Animated.Value(0)).current;
  const mapRef = useRef(null);
  const [region, setRegion] = useState({
    latitude: 13.0700,
    longitude: 80.2600,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(doSync, 30000);
    doSync();
    return () => clearInterval(interval);
  }, []);

  const showNotif = (msg, isAlert = false) => {
    setNotif(msg);
    setNotifAlert(isAlert);
    Animated.sequence([
      Animated.timing(notifAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
    ]).start();
    if (!isAlert) setTimeout(() => setNotifAlert(false), 4000);
  };

  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API_URL}/users/${user.id}/combined-history`);
      if (!res.ok) return;
      const historyData = await res.json();

      // Sort: Latest on top
      historyData.sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at));

      // Filter: All active statuses
      const activeData = historyData.filter(t =>
        ['assigned', 'pending', 'accepted', 'ongoing', 'in_progress', 'acknowledged'].includes((t.status || '').toLowerCase())
      );

      const merged = activeData.map(t => {
        // Parse details for messaging / custom properties
        let msg = t.details;
        let isGroup = false;
        let subMissions = [];
        let customPolygon = null;

        if (t.details && typeof t.details === 'string' && t.details.startsWith('{')) {
          try {
            const parsed = JSON.parse(t.details);
            if (parsed.isGroup) {
              isGroup = true;
              subMissions = parsed.missions || [];
              customPolygon = parsed.custom_polygon || null;
              msg = `Group Mission with ${subMissions.length} tasks`;
            } else {
              msg = parsed.message || parsed.comments || t.details;
            }
          } catch (e) {}
        }

        // Normalize type for UI filters, icons and colors
        let rawType = (t.type || 'sos').toLowerCase();
        let uiType = 'sos';
        if (['medical', 'pregnancy', 'medical_delivery'].includes(rawType)) {
          uiType = rawType === 'pregnancy' ? 'pregnancy' : 'medical';
        } else if (['food', 'delivery', 'supplies'].includes(rawType)) {
          uiType = 'food';
        }

        return {
          id: t.source === 'command' ? `cmd_${t.id}` : `req_${t.id}`,
          type: uiType,
          lat: t.lat ? parseFloat(t.lat) : 13.0700,
          lng: t.lng ? parseFloat(t.lng) : 80.2600,
          sector: t.sector || 'Assigned Target',
          urgency: t.priority === 'critical' ? 'critical' : (t.urgency || 'high'),
          dbId: t.id,
          source: t.source === 'request' ? 'rescue_requests' : 'command',
          message: msg,
          status: t.status,
          isGroup,
          subMissions,
          customPolygon
        };
      });

      setTasks(merged);
    } catch (e) {
      console.error("Error fetching rescuer tasks:", e);
    }
  };

  const doSync = async () => {
    try {
      const res = await fetch(`${API_URL}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: user.phone,
          deviceId: user.phone,
          location: { lat: 13.0700, lng: 80.2600, name: user.name },
        }),
      });
      const data = await res.json();
      if (data.notifications?.length > 0) {
        const firstNotif = data.notifications[0];
        showNotif(`📢 HQ: ${firstNotif.message}`, firstNotif.action_required === 1);
      }

      // Restore interrupted task if backend has it and we don't have an active task
      if (data.user?.interrupted_task_id && !activeTask && !interruptedTask) {
        const restored = tasks.find(t => t.id === data.user.interrupted_task_id);
        if (restored) {
          setActiveTask(restored);
          showNotif("Restoring interrupted normal task...", false);
        } else {
          await fetchTasks();
        }
      }

      // Handle incoming commands — detect critical ones for popup
      if (data.commands?.length > 0) {
        const critCmd = data.commands.find(c => c.command_type === 'critical' && c.status === 'pending');
        if (critCmd) {
          const payload = typeof critCmd.command_payload === 'string' ? JSON.parse(critCmd.command_payload) : critCmd.command_payload;
          setCriticalAlert({ cmdId: critCmd.id, message: payload?.message || 'Critical response required.' });
        }
      }

      await fetchTasks();
    } catch { /* silent */ }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch(`${API_URL}/users/${user.id}/history`);
      const data = await res.json();
      setHistory(data);
    } catch {
      setHistory([]);
    }
    setLoadingHistory(false);
  };

  const acceptTask = async (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    if (task.source === 'rescue_requests') {
      try {
        await fetch(`${API_URL}/rescue-requests/${task.dbId}/accept`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assigned_user_id: user.id, assigned_phone: user.phone }),
        });
      } catch { }
    } else if (task.source === 'command') {
      try {
        await fetch(`${API_URL}/commands/${task.dbId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'accepted', rescuer_phone: user.phone }),
        });
      } catch { }
    }
    setActiveTask(task);
    showNotif(`Navigating to ${(task.type || 'command').toUpperCase()} task`, false);

    // If this is a critical task and we had a normal task active, mark it as interrupted
    if (task.urgency === 'critical' && activeTask && activeTask.urgency !== 'critical') {
      setInterruptedTask(activeTask);
      try {
        await fetch(`${API_URL}/users/${user.id}/interrupted-task`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ task_id: activeTask.id }),
        });
      } catch { }
    }

    // Focus Map
    if (mapRef.current && task.lat && task.lng) {
      mapRef.current.animateToRegion({
        latitude: task.lat,
        longitude: task.lng,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      }, 1000);
    }
  };

  const declineTask = async (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (task?.source === 'rescue_requests') {
      try { await fetch(`${API_URL}/rescue-requests/${task.dbId}/decline`, { method: 'PUT' }); } catch { }
    } else if (task?.source === 'command') {
      try {
        await fetch(`${API_URL}/commands/${task.dbId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'declined', rescuer_phone: user.phone }),
        });
      } catch { }
    }
    setTasks(prev => prev.filter(t => t.id !== taskId));
    showNotif('Task declined — returned to command queue.', false);
  };

  const completeTask = async (taskId) => {
    const task = activeTask || tasks.find(t => t.id === taskId);
    if (!task) return;
    if (task.source === 'rescue_requests') {
      try {
        await fetch(`${API_URL}/rescue-requests/${task.dbId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'completed', rescuer_phone: user.phone }),
        });
      } catch { }
    } else if (task.source === 'command') {
      try {
        await fetch(`${API_URL}/commands/${task.dbId}/status`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'completed', rescuer_phone: user.phone }),
        });
      } catch { }
    }
    
    const isCriticalCompletion = task.urgency === 'critical';

    if (activeTask?.id === taskId) setActiveTask(null);
    setTasks(prev => prev.filter(t => t.id !== taskId));
    showNotif('✅ Mission Completed successfully', false);

    // If we just completed a critical mission and have an interrupted task, reopen it
    if (isCriticalCompletion && interruptedTask) {
      setTimeout(() => {
        setActiveTask(interruptedTask);
        setInterruptedTask(null);
        showNotif("Reopening previous normal task...", true);
        
        // Clear interrupted task in backend
        fetch(`${API_URL}/users/${user.id}/interrupted-task`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ task_id: null }),
        }).catch(() => {});

        if (mapRef.current && interruptedTask.lat && interruptedTask.lng) {
          mapRef.current.animateToRegion({
            latitude: interruptedTask.lat,
            longitude: interruptedTask.lng,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
          }, 1000);
        }
      }, 2000);
      return;
    }

    // Reset Map View
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: 13.0700,
        longitude: 80.2600,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }, 1000);
    }
  };

  const toggleFilter = (type) => {
    setFilters(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const visibleTasks = activeTask
    ? [activeTask]
    : tasks.filter(t =>
      (t.type === 'sos' && filters.sos) ||
      ((t.type === 'medical' || t.type === 'pregnancy') && filters.medical) ||
      (t.type === 'food' && filters.food)
    );

  const handleTabChange = (newTab) => {
    setTab(newTab);
    if (newTab === 'history') fetchHistory();
  };

  const SettingsScreen = ({ user, onLogout }) => {
    const [syncInterval, setSyncInterval] = useState('FETCHING...');
    const [isOnline, setIsOnline] = useState(true);

    useEffect(() => {
      const fetchSync = async () => {
        try {
          const res = await fetch(`${API_URL.replace('/api', '')}/api/settings`);
          setIsOnline(true);
          const settings = await res.json();
          if (settings.retry_intervals) {
            setSyncInterval(settings.retry_intervals.split(',')[0] + 's (Admin Set)');
          }
        } catch (e) {
          setIsOnline(false);
          console.error(e);
        }
      };
      fetchSync();
      const interval = setInterval(fetchSync, 10000);
      return () => clearInterval(interval);
    }, []);

    return (
      <ScrollView contentContainerStyle={{ padding: 24, flexGrow: 1, justifyContent: 'space-between' }}>
        <View>
          <View style={[s.loginCard, { marginBottom: 30, padding: 30, width: '100%' }]}>
            <View style={s.logoCircle}>
              <Text style={{ fontSize: 40 }}>🚁</Text>
            </View>
            <Text style={s.loginTitle}>{user?.name}</Text>
            <Text style={s.loginSub}>RESCUE OPERATIVE</Text>
            <View style={{ width: '100%', height: 1, backgroundColor: C.border, marginVertical: 20 }} />
            <Text style={[s.notifLabel, { marginBottom: 4 }]}>IDENTIFICATION</Text>
            <Text style={{ fontSize: 18, fontWeight: '800', color: C.text, marginBottom: 15 }}>{user?.phone}</Text>
          </View>

          <Text style={s.countText}>SYSTEM CONFIGURATION</Text>
          <View style={[s.historyCard, { borderColor: C.secondary, borderLeftWidth: 4, marginBottom: 12, marginTop: 10 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[s.statusDot, { backgroundColor: C.secondary }]} />
                <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>Dispatch Alerts</Text>
              </View>
              <Text style={{ fontSize: 13, fontWeight: '900', color: C.secondary }}>ACTIVE</Text>
            </View>
          </View>

          <View style={[s.historyCard, { borderColor: isOnline ? C.primary : C.danger, borderLeftWidth: 4, backgroundColor: (isOnline ? C.primary : C.danger) + '15' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={[s.statusDot, { backgroundColor: isOnline ? C.primary : C.danger }]} />
                <Text style={{ fontSize: 15, fontWeight: '800', color: C.text }}>Network Sync</Text>
              </View>
              <Text style={{ fontSize: 13, fontWeight: '900', color: isOnline ? C.primary : C.danger }}>
                {isOnline ? syncInterval : `RECONNECTING: ${syncInterval.split(' ')[0]}`}
              </Text>
            </View>
            <Text style={{ fontSize: 11, fontWeight: '700', color: C.light, marginTop: 6 }}>
              {isOnline ? 'Automated reconnect timing managed by Admin' : 'Device disconnected. Retrying based on Admin timing.'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[s.loginBtn, { backgroundColor: '#fee2e2', shadowColor: C.danger, marginTop: 40 }]}
          onPress={onLogout}
        >
          <Text style={{ color: C.danger, fontWeight: '900', fontSize: 16 }}>SECURE LOGOUT</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: C.dark }}>
      <StatusBar barStyle="light-content" backgroundColor={notifAlert ? C.danger : C.dark} />

      {/* 🚨 Critical Alert Overlay */}
      {criticalAlert && (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999, justifyContent: 'center', alignItems: 'center', padding: 24 }}>
          <Animated.View style={{ backgroundColor: '#fff', borderRadius: 16, padding: 28, width: '100%', borderTopWidth: 6, borderTopColor: C.danger, shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 20, elevation: 20 }}>
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 48, marginBottom: 8 }}>🚨</Text>
              <Text style={{ fontSize: 20, fontWeight: '900', color: C.danger, textAlign: 'center', letterSpacing: 1 }}>CRITICAL RESPONSE</Text>
              <Text style={{ fontSize: 13, color: '#64748b', marginTop: 4, textAlign: 'center', fontWeight: '600' }}>IMMEDIATE ACTION REQUIRED FROM HQ</Text>
            </View>
            <View style={{ backgroundColor: '#fff1f2', borderRadius: 10, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#fecaca' }}>
              <Text style={{ fontSize: 15, color: '#1e293b', lineHeight: 22, fontWeight: '500', textAlign: 'center' }}>{criticalAlert.message}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: '#fee2e2', borderRadius: 10, paddingVertical: 14, alignItems: 'center', borderWidth: 2, borderColor: C.danger }}
                onPress={async () => {
                  try {
                    await fetch(`${API_URL}/commands/${criticalAlert.cmdId}/status`, {
                      method: 'PUT', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ status: 'declined', rescuer_phone: user.phone }),
                    });
                  } catch { }
                  setCriticalAlert(null);
                  showNotif('Critical task declined — returned to command queue.', false);
                }}>
                <Text style={{ color: C.danger, fontWeight: '900', fontSize: 16 }}>✗ DECLINE</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{ flex: 1, backgroundColor: C.danger, borderRadius: 10, paddingVertical: 14, alignItems: 'center' }}
                onPress={async () => {
                  try {
                    await fetch(`${API_URL}/commands/${criticalAlert.cmdId}/status`, {
                      method: 'PUT', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ status: 'accepted', rescuer_phone: user.phone }),
                    });
                  } catch { }
                  setCriticalAlert(null);
                  showNotif('🚨 Critical task accepted — proceed immediately!', true);
                  // Trigger acceptance logic (focus map etc)
                  acceptTask(`cmd_${criticalAlert.cmdId}`);
                }}>
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 16 }}>✓ ACCEPT</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </View>
      )}

      {/* Notification Bar */}
      <View style={[s.notifBar, notifAlert && s.notifBarAlert]}>
        <View>
          <Text style={s.notifLabel}>SYSTEM STATUS</Text>
          <Text style={s.notifText}>{notif}</Text>
        </View>
        <TouchableOpacity onPress={onLogout}>
          <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        {tab === 'tasks' ? (
          <>
            {/* Filter Row */}
            <View style={s.filterRow}>
              {['sos', 'medical', 'food'].map(type => (
                <TouchableOpacity
                  key={type}
                  style={[s.filterBtn, filters[type] && dynamicStyles.filterBtnActive(type)]}
                  onPress={() => toggleFilter(type)}
                >
                  <Text style={[s.filterBtnText, filters[type] && dynamicStyles.filterBtnTextActive(type)]}>
                    {type === 'sos' ? '🚨 SOS' : type === 'medical' ? '🏥 Medical' : '🍱 Food'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 📍 Map View Integration */}
            <View style={s.mapContainer}>
              <WebView
                source={{ html: `
                  <!DOCTYPE html>
                  <html>
                  <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
                    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
                    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
                    <style>
                      body, html { margin: 0; padding: 0; height: 100%; }
                      #map { height: 100%; width: 100%; }
                      .leaflet-div-icon { background: transparent; border: none; }
                      .marker-badge { text-align: center; font-size: 20px; line-height: 24px; background: white; border-radius: 20px; padding: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.3); border: 2px solid; }
                    </style>
                  </head>
                  <body>
                    <div id="map"></div>
                    <script>
                      var map = L.map('map', { zoomControl: false }).setView([13.0700, 80.2600], 12);
                      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);
                      L.marker([13.0700, 80.2600], {
                        icon: L.divIcon({ className: 'leaflet-div-icon', html: '<div class="marker-badge" style="border-color: #0ea5e9;">🚁</div>', iconSize: [40, 40] })
                      }).addTo(map);
                      
                      var markers = ${JSON.stringify(
                        (!activeTask ? tasks.filter(t =>
                          (t.type === 'sos' && filters.sos) ||
                          ((t.type === 'medical' || t.type === 'pregnancy') && filters.medical) ||
                          (t.type === 'food' && filters.food)
                        ) : [activeTask]).map(t => ({
                          id: t.id, lat: t.lat, lng: t.lng, type: t.type,
                          icon: taskIcon(t.type), color: taskColor(t.type)
                        }))
                      )};

                      markers.forEach(function(m) {
                        L.marker([m.lat, m.lng], {
                          icon: L.divIcon({ className: 'leaflet-div-icon', html: '<div class="marker-badge" style="border-color: '+m.color+';">' + m.icon + '</div>', iconSize: [40, 40] })
                        }).addTo(map);
                      });

                      ${activeTask ? `
                        var latlngs = [ [13.0700, 80.2600], [${activeTask.lat}, ${activeTask.lng}] ];
                        L.polyline(latlngs, { color: '#0ea5e9', weight: 4, dashArray: '10, 10' }).addTo(map);
                        map.fitBounds(L.polyline(latlngs).getBounds(), { padding: [50, 50] });
                      ` : ''}
                    </script>
                  </body>
                  </html>
                ` }}
                style={s.map}
                originWhitelist={['*']}
                scrollEnabled={false}
              />

              {/* Map Controls / Labels */}
              <View style={s.mapOverlay}>
                <View style={s.mapStatusBadge}>
                  <View style={[s.statusDot, { backgroundColor: activeTask ? C.danger : C.secondary }]} />
                  <Text style={s.mapStatusText}>{activeTask ? 'NAVIGATING TO MISSION' : 'FIELD MONITORING ACTIVE'}</Text>
                </View>
              </View>
            </View>

            {/* Task Count Banner */}
            <View style={s.countBanner}>
              <Text style={s.countText}>
                {activeTask ? '📍 Active Mission' : `${visibleTasks.length} Task${visibleTasks.length !== 1 ? 's' : ''} Available`}
              </Text>
              {!activeTask && (
                <TouchableOpacity onPress={fetchTasks}>
                  <Text style={{ color: C.primary, fontSize: 13, fontWeight: '700' }}>↻ Refresh</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Task List */}
            <ScrollView contentContainerStyle={{ padding: 15, paddingBottom: 80 }}>
              {visibleTasks.length === 0 ? (
                <View style={s.emptyState}>
                  <Text style={{ fontSize: 40 }}>✅</Text>
                  <Text style={s.emptyText}>No tasks match filters</Text>
                </View>
              ) : (
                visibleTasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isActive={activeTask?.id === task.id}
                    onAccept={acceptTask}
                    onDecline={declineTask}
                    onComplete={completeTask}
                  />
                ))
              )}
            </ScrollView>
          </>
        ) : tab === 'history' ? (
          /* History Tab */
          <ScrollView contentContainerStyle={{ padding: 15 }}>
            <Text style={s.historyTitle}>Mission Log</Text>
            {loadingHistory ? (
              <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
            ) : history.length === 0 ? (
              <View style={s.emptyState}>
                <Text style={{ fontSize: 40 }}>📋</Text>
                <Text style={s.emptyText}>No missions logged yet</Text>
              </View>
            ) : (
              history.map((h, i) => (
                <View key={i} style={s.historyCard}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                    <Text style={{ fontWeight: '800', color: C.dark, fontSize: 13 }}>
                      {(h.type || 'Task').toUpperCase()} RESCUE
                    </Text>
                    <View style={[s.statusBadge, { backgroundColor: h.status === 'completed' ? '#d1fae5' : '#f1f5f9' }]}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: h.status === 'completed' ? C.secondary : C.light }}>
                        {h.status?.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={s.historyMeta}>📍 {h.sector}</Text>
                    <Text style={s.historyMeta}>
                      {h.updated_at ? new Date(h.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>
        ) : (
        /* Settings Tab */
        <SettingsScreen user={user} onLogout={onLogout} />
        )}
      </View>

      {/* Bottom Navigation */}
      <View style={s.bottomNav}>
        <TouchableOpacity style={s.navItem} onPress={() => handleTabChange('tasks')}>
          <Text style={[s.navIcon, tab === 'tasks' && { color: C.primary }]}>📍</Text>
          <Text style={[s.navLabel, tab === 'tasks' && { color: C.primary }]}>TASKS</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.navItem} onPress={() => handleTabChange('history')}>
          <Text style={[s.navIcon, tab === 'history' && { color: C.primary }]}>📋</Text>
          <Text style={[s.navLabel, tab === 'history' && { color: C.primary }]}>HISTORY</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.navItem} onPress={() => handleTabChange('settings')}>
          <Text style={[s.navIcon, tab === 'settings' && { color: C.primary }]}>⚙️</Text>
          <Text style={[s.navLabel, tab === 'settings' && { color: C.primary }]}>SETTINGS</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('rescueUser').then(saved => {
      if (saved) setUser(JSON.parse(saved));
      setChecking(false);
    });
  }, []);

  const handleLogout = async () => {
    await AsyncStorage.removeItem('rescueUser');
    setUser(null);
  };

  if (checking) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: C.primaryLight }}>
        <ActivityIndicator size="large" color={C.primary} />
      </View>
    );
  }

  return user
    ? <DashboardScreen user={user} onLogout={handleLogout} />
    : <LoginScreen onLogin={setUser} />;
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // Login
  loginContainer: { flex: 1, backgroundColor: C.bg, padding: 30, justifyContent: 'center' },
  loginCard: { width: width - 48, backgroundColor: C.surface, borderRadius: 24, padding: 30, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
  logoCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: C.white, borderWidth: 3, borderColor: C.primary, justifyContent: 'center', alignItems: 'center', marginBottom: 20, shadowColor: C.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 5 },
  loginTitle: { fontSize: 28, fontWeight: '900', color: C.text, marginBottom: 4 },
  loginSub: { fontSize: 12, fontWeight: '700', color: C.primary, letterSpacing: 1.5, marginBottom: 30 },
  input: { width: '100%', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: C.border, marginBottom: 14, fontWeight: '600', fontSize: 15, color: C.text, backgroundColor: C.surface },
  loginBtn: { backgroundColor: C.primary, paddingVertical: 16, borderRadius: 12, width: '100%', alignItems: 'center', shadowColor: C.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 5 },
  loginBtnText: { color: C.white, fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },

  // Header / Notif
  notifBar: { height: 70, backgroundColor: C.surface, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: C.border },
  notifBarAlert: { backgroundColor: C.danger },
  notifLabel: { color: C.light, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  notifText: { color: C.text, fontSize: 15, fontWeight: '800' },

  // Tabs / Filters
  filterRow: { flexDirection: 'row', padding: 15, gap: 10, backgroundColor: C.bg },
  filterBtn: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, backgroundColor: C.surface, borderWidth: 1, borderColor: C.border },
  filterBtnText: { color: C.light, fontSize: 12, fontWeight: '800' },

  // Map
  mapContainer: { height: 260, margin: 15, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 15, elevation: 10 },
  map: { ...StyleSheet.absoluteFillObject },
  markerContainer: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 2, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, elevation: 5 },
  selfMarker: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: C.primary, shadowColor: C.primary, shadowOpacity: 0.5, shadowRadius: 10, elevation: 10 },
  mapOverlay: { position: 'absolute', top: 12, left: 12 },
  mapStatusBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.85)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, gap: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  mapStatusText: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },

  // Task Cards
  countBanner: { paddingHorizontal: 20, marginBottom: 5 },
  countText: { color: C.light, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  taskCard: { backgroundColor: C.surface, borderRadius: 20, padding: 20, marginHorizontal: 15, marginBottom: 15, borderWidth: 1, borderColor: C.border, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 3 },
  taskCardCritical: { borderColor: C.danger, borderWidth: 2, backgroundColor: C.surfaceLight },
  taskCardActive: { borderColor: C.primary, borderWidth: 2 },
  taskHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  typeIcon: { fontSize: 14 },
  typeText: { color: C.text, fontSize: 11, fontWeight: '900' },
  priorityText: { color: C.text, fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },
  taskBody: { marginBottom: 20 },
  taskLocation: { color: C.text, fontSize: 16, fontWeight: '800', marginBottom: 8 },
  taskMessage: { color: C.light, fontSize: 13, fontStyle: 'italic', marginBottom: 12, lineHeight: 18 },
  taskMetaRow: { flexDirection: 'row', gap: 15 },
  metaText: { color: C.primary, fontSize: 11, fontWeight: '900' },
  taskActions: { flexDirection: 'row', gap: 10 },
  btnDeclineSec: { flex: 1, padding: 14, borderRadius: 12, backgroundColor: C.surfaceLight, alignItems: 'center' },
  btnAcceptPri: { flex: 2, padding: 14, borderRadius: 12, backgroundColor: C.primary, alignItems: 'center' },
  btnCompletePri: { width: '100%', padding: 14, borderRadius: 12, backgroundColor: C.secondary, alignItems: 'center' },
  btnActiveMission: { width: '100%', padding: 14, borderRadius: 12, backgroundColor: C.danger, alignItems: 'center' },
  btnDeclineText: { color: C.light, fontSize: 13, fontWeight: '900' },
  btnAcceptText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  btnCompleteText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  pulseContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pulseDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },

  // Bottom Nav
  bottomNav: { height: 80, backgroundColor: C.surface, flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.border, paddingBottom: 10 },
  navItem: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  navIcon: { fontSize: 24, color: C.light },
  navLabel: { fontSize: 10, fontWeight: '900', color: C.light, marginTop: 4, letterSpacing: 0.5 },
  navItemActive: { color: C.primary },

  // Alert Overlay (Critical)
  alertOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(2, 6, 23, 0.95)', justifyContent: 'center', alignItems: 'center', padding: 25, zIndex: 1000 },
  alertBox: { width: '100%', backgroundColor: C.surface, borderRadius: 32, padding: 30, alignItems: 'center', borderWidth: 2, borderColor: C.danger, shadowColor: C.danger, shadowOpacity: 0.5, shadowRadius: 30, elevation: 20 },
  alertHeader: { alignItems: 'center', marginBottom: 25 },
  alertPulseRing: { width: 80, height: 80, borderRadius: 40, backgroundColor: C.danger + '22', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.danger, marginBottom: 15 },
  alertEmoji: { fontSize: 40 },
  alertTitle: { color: C.danger, fontSize: 24, fontWeight: '900', letterSpacing: 1 },
  alertSubtitle: { color: C.light, fontSize: 12, fontWeight: '800', marginTop: 4 },
  alertBody: { width: '100%', marginBottom: 30, alignItems: 'center' },
  alertMessage: { color: C.text, fontSize: 18, fontWeight: '700', textAlign: 'center', lineHeight: 26, marginBottom: 20 },
  alertInfoRow: { flexDirection: 'row', backgroundColor: C.surfaceLight, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 12, gap: 10 },
  alertInfoLabel: { color: C.light, fontSize: 12, fontWeight: '900' },
  alertInfoValue: { color: C.text, fontSize: 12, fontWeight: '900' },
  alertActions: { flexDirection: 'row', gap: 15, width: '100%' },
  btnCritDecline: { flex: 1, padding: 18, borderRadius: 16, backgroundColor: C.surfaceLight, alignItems: 'center' },
  btnCritAccept: { flex: 2, padding: 18, borderRadius: 16, backgroundColor: C.danger, alignItems: 'center', shadowColor: C.danger, shadowOpacity: 0.4, shadowRadius: 10 },
  btnCritDeclineText: { color: C.light, fontSize: 14, fontWeight: '900' },
  btnCritAcceptText: { color: '#fff', fontSize: 14, fontWeight: '900' },

  // Empty
  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: C.light, fontSize: 14, fontWeight: '600', marginTop: 12 },
  historyTitle: { fontSize: 20, fontWeight: '900', color: C.text, marginBottom: 16, paddingHorizontal: 5 },
  historyCard: { backgroundColor: C.surface, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  historyMeta: { fontSize: 12, color: C.light, fontWeight: '600' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
});
