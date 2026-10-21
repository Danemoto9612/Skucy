import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { colors, fonts, radius, shadow1, space, typography, type TextVariant } from './theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

// ───────────── Texto ─────────────
export function T({
  variant = 'body',
  color = colors.ink,
  style,
  children,
  numberOfLines,
  onPress,
}: {
  variant?: TextVariant;
  color?: string;
  style?: StyleProp<TextStyle>;
  children?: ReactNode;
  numberOfLines?: number;
  onPress?: () => void;
}) {
  return (
    <Text numberOfLines={numberOfLines} onPress={onPress} style={[typography[variant], { color }, style]}>
      {children}
    </Text>
  );
}

// ───────────── Pantalla ─────────────
export function Screen({
  children,
  scroll = true,
  padded = true,
  style,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const content = [padded && { padding: space.md }, { gap: space.md, paddingBottom: space.xl }, style];
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: colors.canvas }, ...content]}>{children}</View>;
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.canvas }}
      contentContainerStyle={content}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

// ───────────── Tarjeta ─────────────
export function Card({
  children,
  onPress,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const base = [styles.card, style];
  if (!onPress) return <View style={base}>{children}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [...base, pressed && { opacity: 0.85 }]}>
      {children}
    </Pressable>
  );
}

// ───────────── Botón ─────────────
export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'danger' | 'soft';

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  small,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const palette: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: colors.primary, fg: colors.white },
    outline: { bg: 'transparent', fg: colors.charcoal, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.primary },
    soft: { bg: colors.wash, fg: colors.primaryDeep },
    danger: { bg: colors.errorBg, fg: colors.error },
  };
  const p = palette[variant];
  const off = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        styles.button,
        small && { paddingVertical: 8, paddingHorizontal: 14 },
        { backgroundColor: p.bg, borderColor: p.border ?? 'transparent', borderWidth: p.border ? 1.5 : 0 },
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.92 },
        off && { opacity: 0.5 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={small ? 15 : 18} color={p.fg} /> : null}
          <Text style={[small ? typography.labelSm : typography.label, { color: p.fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

// ───────────── Campo de texto ─────────────
export function Input({
  label,
  error,
  icon,
  hint,
  ...rest
}: TextInputProps & { label?: string; error?: string; icon?: IconName; hint?: string }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {label ? <T variant="labelSm" color={colors.charcoal}>{label}</T> : null}
      <View
        style={[
          styles.inputBox,
          focused && { borderColor: colors.primary, borderWidth: 1.5 },
          !!error && { borderColor: colors.error },
        ]}
      >
        {icon ? <Ionicons name={icon} size={18} color={colors.primary} /> : null}
        <TextInput
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          placeholderTextColor={colors.muted}
          style={[
            { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.ink, paddingVertical: 12 },
            rest.multiline && { minHeight: 84, textAlignVertical: 'top' },
          ]}
        />
      </View>
      {error ? <T variant="caption" color={colors.error}>{error}</T> : hint ? <T variant="caption" color={colors.muted}>{hint}</T> : null}
    </View>
  );
}

// ───────────── Chip / Badge ─────────────
type Tone = 'brand' | 'success' | 'warning' | 'danger' | 'neutral' | 'violet';

export function Chip({
  label,
  tone = 'brand',
  icon,
  onPress,
  selected,
}: {
  label: string;
  tone?: Tone;
  icon?: IconName;
  onPress?: () => void;
  selected?: boolean;
}) {
  const tones: Record<Tone, { bg: string; fg: string }> = {
    brand: { bg: colors.wash, fg: colors.primaryDeep },
    success: { bg: colors.successBg, fg: colors.successText },
    warning: { bg: colors.warningBg, fg: colors.warningText },
    danger: { bg: colors.errorBg, fg: colors.error },
    neutral: { bg: colors.tint, fg: colors.charcoal },
    violet: { bg: '#ede9fe', fg: colors.violet },
  };
  const t = selected ? { bg: colors.primary, fg: colors.white } : tones[tone];
  const body = (
    <View style={[styles.chip, { backgroundColor: t.bg }]}>
      {icon ? <Ionicons name={icon} size={13} color={t.fg} /> : null}
      <Text style={[typography.caption, { color: t.fg, fontFamily: fonts.semibold }]}>{label}</Text>
    </View>
  );
  return onPress ? <Pressable onPress={onPress}>{body}</Pressable> : body;
}

// ───────────── Avatar ─────────────
export function Avatar({
  name,
  size = 44,
  verified,
  uri,
}: {
  name: string;
  size?: number;
  verified?: boolean;
  uri?: string;
}) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return (
    <View>
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.wash,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 2,
          borderColor: colors.white,
          overflow: 'hidden',
        }}
      >
        {uri && !failed ? (
          <Image source={{ uri }} style={{ width: size, height: size }} onError={() => setFailed(true)} />
        ) : (
          <Text style={{ fontFamily: fonts.bold, color: colors.primaryDeep, fontSize: size * 0.36 }}>{initials}</Text>
        )}
      </View>
      {verified ? (
        <View style={{ position: 'absolute', right: -2, bottom: -2, backgroundColor: colors.white, borderRadius: 99 }}>
          <Ionicons name="checkmark-circle" size={Math.max(14, size * 0.3)} color={colors.violet} />
        </View>
      ) : null}
    </View>
  );
}

// ───────────── Estrellas ─────────────
export function Stars({
  value,
  size = 16,
  onChange,
}: {
  value: number;
  size?: number;
  onChange?: (v: number) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const name: IconName = value >= n ? 'star' : value >= n - 0.5 ? 'star-half' : 'star-outline';
        const icon = <Ionicons key={n} name={name} size={size} color={colors.warning} />;
        return onChange ? (
          <Pressable key={n} onPress={() => onChange(n)} hitSlop={6}>
            {icon}
          </Pressable>
        ) : (
          icon
        );
      })}
    </View>
  );
}

// ───────────── Secciones y listas ─────────────
export function SectionHeader({ title, action, onAction, count }: { title: string; action?: string; onAction?: () => void; count?: number }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <T variant="h2">{title}</T>
        {count !== undefined ? (
          <View style={styles.countBadge}>
            <T variant="caption" color={colors.charcoal}>{count}</T>
          </View>
        ) : null}
      </View>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <T variant="labelSm" color={colors.primaryDeep}>{action}</T>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ListItem({
  icon,
  title,
  subtitle,
  right,
  onPress,
  tone = 'brand',
}: {
  icon?: IconName;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
  tone?: 'brand' | 'neutral';
}) {
  return (
    <Card onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
      {icon ? (
        <View style={[styles.iconBox, tone === 'neutral' && { backgroundColor: colors.tint }]}>
          <Ionicons name={icon} size={20} color={tone === 'neutral' ? colors.charcoal : colors.primary} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <T variant="label" numberOfLines={2}>{title}</T>
        {subtitle ? <T variant="bodySm" color={colors.muted} numberOfLines={2}>{subtitle}</T> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.muted} /> : null)}
    </Card>
  );
}

export function EmptyState({ icon = 'albums-outline', title, message }: { icon?: IconName; title: string; message?: string }) {
  return (
    <View style={{ alignItems: 'center', padding: space.lg, gap: 8 }}>
      <View style={[styles.iconBox, { width: 56, height: 56, borderRadius: 28 }]}>
        <Ionicons name={icon} size={26} color={colors.primary} />
      </View>
      <T variant="h3">{title}</T>
      {message ? <T variant="bodySm" color={colors.muted} style={{ textAlign: 'center' }}>{message}</T> : null}
    </View>
  );
}

export function Banner({ tone = 'warning', text, icon }: { tone?: 'warning' | 'danger' | 'success' | 'brand'; text: string; icon?: IconName }) {
  const map = {
    warning: { bg: colors.warningBg, fg: colors.warningText, icon: 'alert-circle-outline' as IconName },
    danger: { bg: colors.errorBg, fg: colors.error, icon: 'close-circle-outline' as IconName },
    success: { bg: colors.successBg, fg: colors.successText, icon: 'checkmark-circle-outline' as IconName },
    brand: { bg: colors.wash, fg: colors.primaryDeep, icon: 'information-circle-outline' as IconName },
  }[tone];
  return (
    <View style={{ backgroundColor: map.bg, borderRadius: radius.md, padding: 12, flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
      <Ionicons name={icon ?? map.icon} size={18} color={map.fg} />
      <Text style={[typography.bodySm, { color: map.fg, flex: 1 }]}>{text}</Text>
    </View>
  );
}

export function Segmented<V extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: colors.tint, borderRadius: radius.md, padding: 4 }}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: radius.md - 2 }, active && { backgroundColor: colors.white }]}
          >
            <T variant="labelSm" color={active ? colors.primary : colors.charcoal}>{o.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Row({ children, gap = 8, style }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={[styles.card, { flex: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 6 }]}>
      <T variant="h2" color={colors.primaryDark}>{String(value)}</T>
      <T variant="caption" color={colors.muted}>{label}</T>
    </View>
  );
}

/** Campo de motivo + acciones que lo reciben (moderación y administración). */
export function ReasonActions({
  actions,
  placeholder = 'Motivo (obligatorio para rechazar, suspender o retirar)',
}: {
  actions: { title: string; variant?: ButtonVariant; icon?: IconName; run: (reason: string) => void }[];
  placeholder?: string;
}) {
  const [reason, setReason] = useState('');
  return (
    <View style={{ gap: 8 }}>
      <Input value={reason} onChangeText={setReason} placeholder={placeholder} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {actions.map((a) => (
          <Button
            key={a.title}
            small
            title={a.title}
            icon={a.icon}
            variant={a.variant ?? 'soft'}
            onPress={() => {
              a.run(reason);
              setReason('');
            }}
          />
        ))}
      </View>
    </View>
  );
}

export function Pager({ shown, total, onMore }: { shown: number; total: number; onMore: () => void }) {
  if (shown >= total) return null;
  return <Button title={`Cargar más (${total - shown})`} variant="soft" onPress={onMore} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    ...shadow1,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: radius.md,
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.wash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadge: {
    backgroundColor: colors.tint,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
});
