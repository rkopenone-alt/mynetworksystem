import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { htmlString } from './htmlStr';

export default function App() {
  const [hasPermission, setHasPermission] = useState(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  if (hasPermission === null) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a' }}>
        <ActivityIndicator size="large" color="#0ea5e9" />
        <Text style={{ color: '#fff', marginTop: 10 }}>Initializing Rescuer System...</Text>
      </View>
    );
  }

  if (!hasPermission) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f172a', padding: 20 }}>
        <Text style={{ color: '#f43f5e', fontSize: 18, textAlign: 'center' }}>
          Location permissions are strictly required for the Field Rescuer App to function. Please enable them in your device settings.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <WebView 
        source={{ html: htmlString, baseUrl: 'http://192.168.1.5:3001' }} 
        style={{ flex: 1 }}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        geolocationEnabled={true}
        allowFileAccess={true}
        allowUniversalAccessFromFileURLs={true}
        mixedContentMode="always"
      />
    </View>
  );
}
