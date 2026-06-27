import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Feather } from '@expo/vector-icons';

import { Screen } from '../../src/components/Screen';
import { Button } from '../../src/components/Button';
import { useAuth } from '../../src/auth/AuthContext';
import { broker } from '../../src/api/client';
import { colors, font, spacing, typography } from '../../src/theme';

export default function ScanScreen() {
  const router = useRouter();
  const { connectWithBroker } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [busy, setBusy] = useState(false);
  const handled = useRef(false);

  const onScanned = async ({ data }: { data: string }) => {
    if (handled.current) return;
    handled.current = true;
    setBusy(true);
    try {
      const parsed = JSON.parse(data) as { broker?: string; code?: string };
      if (!parsed.broker || !parsed.code) throw new Error('Not a CloudBox pairing code');

      const { token: brokerToken, device } = await broker.claim(parsed.broker, parsed.code);
      let email = '';
      try {
        email = (await broker.me(parsed.broker, brokerToken)).email;
      } catch {
        /* email is display-only */
      }
      await connectWithBroker(parsed.broker, brokerToken, device, email);
      // On success the root guard redirects into the app.
    } catch (e) {
      setBusy(false);
      Alert.alert('Pairing failed', e instanceof Error ? e.message : 'Invalid QR code', [
        { text: 'Try again', onPress: () => (handled.current = false) },
        { text: 'Cancel', style: 'cancel', onPress: () => router.back() },
      ]);
    }
  };

  if (!permission) {
    return (
      <Screen>
        <View style={styles.center}>
          <Text style={styles.muted}>Checking camera…</Text>
        </View>
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen>
        <View style={styles.center}>
          <View style={styles.permIcon}>
            <Feather name="camera" size={28} color={colors.primary} />
          </View>
          <Text style={styles.title}>Camera access</Text>
          <Text style={styles.muted}>
            CloudBox needs your camera to scan the pairing QR code on your laptop.
          </Text>
          <View style={{ height: spacing(4) }} />
          <View style={{ alignSelf: 'stretch' }}>
            <Button label="Allow camera" onPress={requestPermission} />
          </View>
          <Pressable onPress={() => router.back()} style={{ marginTop: spacing(3) }}>
            <Text style={styles.link}>Cancel</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <View style={styles.fill}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={busy ? undefined : onScanned}
      />
      <View style={styles.overlay}>
        <View style={styles.frame} />
        <Text style={styles.hint}>
          {busy ? 'Connecting…' : 'Point at the QR code shown on your laptop'}
        </Text>
        <Pressable onPress={() => router.back()} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing(6) },
  permIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing(4),
  },
  title: { ...typography.headline, color: colors.text, marginBottom: spacing(1) },
  muted: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  link: { fontFamily: font.semibold, fontSize: 15, color: colors.primary },

  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frame: {
    width: 240,
    height: 240,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    backgroundColor: 'transparent',
  },
  hint: {
    color: '#FFFFFF',
    fontFamily: font.semibold,
    fontSize: 16,
    marginTop: spacing(5),
    textAlign: 'center',
    paddingHorizontal: spacing(6),
  },
  cancelBtn: {
    position: 'absolute',
    bottom: spacing(10),
    paddingHorizontal: spacing(6),
    paddingVertical: spacing(2),
  },
  cancelText: { color: '#FFFFFF', fontFamily: font.semibold, fontSize: 16 },
});
