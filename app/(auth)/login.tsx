import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MicrosoftCancelled } from '../../src/api/microsoft';
import { loginWithMicrosoft, loginWithPassword, type LoginResult } from '../../src/store/actions';
import { setGuest } from '../../src/store/ui';
import { Button, Input, Row, T } from '../../src/ui/components';
import { attempt } from '../../src/ui/session';
import { colors } from '../../src/ui/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const handle = (result: LoginResult) => {
    if (result.kind === 'register') {
      router.push({
        pathname: '/register',
        params: { email: result.email, institutionId: result.institutionId, registrationToken: result.registrationToken, method: result.method, name: result.name ?? '' },
      });
    } else if (result.kind === 'institution_request') {
      router.push({ pathname: '/institution-request', params: { email: result.email, domain: result.domain } });
    }
    // kind === 'ok': el guard de rutas cambia automáticamente a la app.
  };

  const run = async (fn: () => Promise<LoginResult>) => {
    setBusy(true);
    await attempt(async () => {
      try {
        return await fn();
      } catch (e) {
        if (e instanceof MicrosoftCancelled) return null; // el usuario cerró la ventana de Microsoft
        throw e;
      }
    }, (result) => result && handle(result));
    setBusy(false);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 18 }} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', gap: 6, marginTop: 16 }}>
            <View
              style={{
                width: 84,
                height: 84,
                borderRadius: 24,
                backgroundColor: colors.wash,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="school" size={42} color={colors.primary} />
            </View>
            <Row gap={6}>
              <T variant="display">Skucy</T>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary }} />
            </Row>
            <T variant="caption" color={colors.primary} style={{ letterSpacing: 1 }}>
              SCHOOL + SOCIETY
            </T>
          </View>

          <View style={{ alignItems: 'center', gap: 4 }}>
            <T variant="h1">Bienvenido</T>
            <T variant="body" color={colors.charcoal} style={{ textAlign: 'center' }}>
              Ingresa con tu cuenta institucional de Microsoft 365
            </T>
          </View>

          <Button
            title="Continuar con Microsoft 365"
            icon="logo-microsoft"
            onPress={() => run(loginWithMicrosoft)}
            disabled={busy}
          />

          <Row gap={10} style={{ alignItems: 'center' }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            <T variant="caption" color={colors.charcoal}>o con tu correo y contraseña</T>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </Row>

          <Input
            label="Correo institucional"
            icon="at"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
          <Input
            label="Contraseña"
            icon="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            onSubmitEditing={() => email.trim() && password && run(() => loginWithPassword(email, password))}
          />
          <Button
            title="Iniciar sesión"
            variant="outline"
            onPress={() => run(() => loginWithPassword(email, password))}
            disabled={busy || !email.trim() || !password}
          />
          <Button
            title="Crear cuenta con mi correo institucional"
            variant="ghost"
            onPress={() => router.push('/register')}
          />

          <View style={{ height: 1, backgroundColor: colors.border, marginVertical: 4 }} />

          <Button title="Explorar sin cuenta" variant="outline" icon="compass-outline" onPress={() => setGuest(true)} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
