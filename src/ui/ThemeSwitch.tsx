import { View } from 'react-native';
import { Segmented, T } from './components';
import { setThemeMode, useTheme, type ThemeMode } from './theme';
import { colors } from './theme';

/** Selector de apariencia: sigue al dispositivo, o fuerza claro u oscuro (se recuerda entre sesiones). */
export function ThemeSwitch() {
  const { mode } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <T variant="labelSm" color={colors.charcoal}>Apariencia</T>
      <Segmented<ThemeMode>
        value={mode}
        onChange={setThemeMode}
        options={[
          { value: 'system', label: 'Automático' },
          { value: 'light', label: 'Claro' },
          { value: 'dark', label: 'Oscuro' },
        ]}
      />
    </View>
  );
}
