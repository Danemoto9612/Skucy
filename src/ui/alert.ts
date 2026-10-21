// Alertas que funcionan en iOS, Android y web (en web `Alert.alert` de React Native no hace nada).
import { Alert, Platform, type AlertButton } from 'react-native';

export function showAlert(title: string, message?: string, buttons?: AlertButton[]) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }
  const win = (globalThis as any).window;
  const text = message ? `${title}\n\n${message}` : title;
  const actions = buttons ?? [];
  const cancel = actions.find((b) => b.style === 'cancel');
  const others = actions.filter((b) => b !== cancel);
  if (cancel && others.length) {
    if (win.confirm(text)) others[0].onPress?.();
    else cancel.onPress?.();
    return;
  }
  win.alert(text);
  (others[0] ?? actions[0])?.onPress?.();
}
