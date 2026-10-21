import { ActivityIndicator, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { T } from '../src/ui/components';
import { colors } from '../src/ui/theme';

// Destino de la redirección de Microsoft (https://tu-app/auth o skucy://auth): entrega el código a la ventana
// que inició el login y se cierra sola.
WebBrowser.maybeCompleteAuthSession();

export default function AuthRedirect() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.canvas }}>
      <ActivityIndicator color={colors.primary} />
      <T variant="body">Completando inicio de sesión…</T>
    </View>
  );
}
