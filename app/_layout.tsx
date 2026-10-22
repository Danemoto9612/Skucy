import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { apiBaseUrl } from '../src/api/config';
import { sessionUser } from '../shared/selectors';
import { hydrate, refresh, useConnection, useDb } from '../src/store/store';
import { useGuest } from '../src/store/ui';
import { Banner, Button, T } from '../src/ui/components';
import { colors, fonts } from '../src/ui/theme';

const header = {
  headerStyle: { backgroundColor: colors.canvas },
  headerTintColor: colors.primary,
  headerTitleStyle: { fontFamily: fonts.semibold, color: colors.ink },
  headerShadowVisible: false,
  headerBackButtonDisplayMode: 'minimal' as const,
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });
  const db = useDb();
  const guest = useGuest();
  const connection = useConnection();

  useEffect(() => {
    hydrate();
  }, []);

  // Splash / sesión
  if (!fontsLoaded || connection.status === 'loading') {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.canvas }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  // Sin conexión con el backend local
  if (connection.status === 'offline') {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.canvas }}>
          <View style={{ padding: 20, gap: 14, marginTop: 40 }}>
            <T variant="h1">No hay conexión con el servidor</T>
            <T color={colors.charcoal}>
              No se pudo conectar con la API de Skucy. Revisa tu internet y que EXPO_PUBLIC_API_URL apunte a tu función de Supabase.
            </T>
            <Banner tone="warning" text={`Intentando conectar a: ${apiBaseUrl() || '(EXPO_PUBLIC_API_URL sin definir)'}`} />
            {connection.error ? <T variant="caption" color={colors.muted}>{connection.error}</T> : null}
            <Button title="Reintentar" icon="refresh" onPress={() => refresh()} />
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  const entered = guest || sessionUser(db) !== null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={header}>
        {/* Flujo de acceso: solo disponible cuando no hay sesión ni modo invitado */}
        <Stack.Protected guard={!entered}>
          <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)/register" options={{ title: 'Completar registro' }} />
          <Stack.Screen name="(auth)/institution-request" options={{ title: 'Solicitar institución' }} />
        </Stack.Protected>

        <Stack.Protected guard={entered}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="degree/[id]" options={{ title: 'Carrera' }} />
          <Stack.Screen name="subject/[id]" options={{ title: 'Materia' }} />
          <Stack.Screen name="content/[id]" options={{ title: 'Contenido' }} />
          <Stack.Screen name="content/edit" options={{ title: 'Contenido' }} />
          <Stack.Screen name="profile/[handle]" options={{ title: 'Perfil' }} />
          <Stack.Screen name="follows/[handle]" options={{ title: 'Seguidores y seguidos' }} />
          <Stack.Screen name="creator/apply" options={{ title: 'Solicitud de creator' }} />
          <Stack.Screen name="creator/my-content" options={{ title: 'Mis contenidos' }} />
          <Stack.Screen name="notifications" options={{ title: 'Notificaciones' }} />
          <Stack.Screen name="saved" options={{ title: 'Guardados' }} />
          <Stack.Screen name="report" options={{ title: 'Reportar', presentation: 'modal' }} />
          <Stack.Screen name="moderation" options={{ title: 'Panel de moderación' }} />
          <Stack.Screen name="admin" options={{ title: 'Administración' }} />
        </Stack.Protected>

        {/* Va al FINAL: la primera pantalla disponible es la que se muestra cuando una ruta no existe o está protegida. */}
        <Stack.Screen name="auth" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
