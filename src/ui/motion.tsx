// Animaciones y estados de carga. Solo usa la API `Animated` de React Native (sin dependencias nuevas) y
// respeta la opción "Reducir movimiento" del sistema.
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  Platform,
  Pressable,
  View,
  type ImageResizeMode,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, radius, space, useTheme } from './theme';

const native = Platform.OS !== 'web'; // el driver nativo no existe en web

// ───────────── Reducir movimiento ─────────────
let reduceMotion = false;
try {
  AccessibilityInfo.isReduceMotionEnabled?.().then((v) => (reduceMotion = !!v)).catch(() => undefined);
  AccessibilityInfo.addEventListener?.('reduceMotionChanged', (v: boolean) => (reduceMotion = v));
} catch {
  // sin soporte: se anima normalmente
}
export const motionReduced = () => reduceMotion;

// ───────────── Aparecer suave (entrada de pantallas y bloques) ─────────────
export function FadeIn({
  children,
  delay = 0,
  distance = 10,
  duration = 280,
  style,
}: {
  children: ReactNode;
  delay?: number;
  distance?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const v = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    Animated.timing(v, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: native,
    }).start();
  }, [v, delay, duration]);
  return (
    <Animated.View
      style={[
        style,
        { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

// ───────────── Pulsación con efecto de resorte ─────────────
const APressable = Animated.createAnimatedComponent(Pressable);

type PressableScaleProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  /** Opacidad en reposo (p. ej. 0.5 cuando está deshabilitado). */
  restOpacity?: number;
};

export function PressableScale({ style, scaleTo = 0.97, restOpacity = 1, onPressIn, onPressOut, ...rest }: PressableScaleProps) {
  const v = useRef(new Animated.Value(0)).current;
  const to = (value: number) => {
    if (reduceMotion) return;
    Animated.spring(v, { toValue: value, speed: 40, bounciness: value ? 0 : 6, useNativeDriver: native }).start();
  };
  return (
    <APressable
      {...rest}
      onPressIn={(e) => {
        to(1);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        to(0);
        onPressOut?.(e);
      }}
      style={[
        style,
        {
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [restOpacity, restOpacity * 0.9] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, scaleTo] }) }],
        },
      ]}
    />
  );
}

// ───────────── Esqueletos (skeletons) ─────────────
// Un único pulso compartido: todas las piezas "respiran" al mismo tiempo y solo corre mientras haya alguna en pantalla.
const pulse = new Animated.Value(0);
let pulseUsers = 0;
let pulseLoop: ReturnType<typeof Animated.loop> | null = null;

function usePulse() {
  useEffect(() => {
    pulseUsers++;
    if (pulseUsers === 1 && !reduceMotion) {
      pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
          Animated.timing(pulse, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
        ]),
      );
      pulseLoop.start();
    }
    return () => {
      pulseUsers--;
      if (pulseUsers === 0) {
        pulseLoop?.stop();
        pulseLoop = null;
      }
    };
  }, []);
  return pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });
}

export function Skeleton({
  width = '100%',
  height = 14,
  round = radius.md,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  round?: number;
  style?: StyleProp<ViewStyle>;
}) {
  useTheme();
  const opacity = usePulse();
  return <Animated.View style={[{ width, height, borderRadius: round, backgroundColor: colors.border, opacity }, style]} />;
}

/** Esqueleto que rellena todo su contenedor (marcador de posición de una imagen). */
function SkeletonFill() {
  useTheme();
  const opacity = usePulse();
  return (
    <Animated.View
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.border, opacity }}
    />
  );
}

/** Silueta de una tarjeta de contenido (portada + autor + título). */
export function SkeletonCard() {
  useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: space.md,
        gap: 10,
      }}
    >
      <Skeleton height={150} round={radius.md} />
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Skeleton width={44} height={44} round={22} />
        <View style={{ flex: 1, gap: 8 }}>
          <Skeleton width="80%" height={14} />
          <Skeleton width="45%" height={12} />
        </View>
      </View>
    </View>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <View style={{ gap: space.md }}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

/** Pantalla de arranque mientras se cargan fuentes y sesión. */
export function SplashSkeleton() {
  useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas, padding: space.md, paddingTop: 56, gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Skeleton width={36} height={36} round={12} />
        <Skeleton width={110} height={20} />
      </View>
      <SkeletonList count={3} />
    </View>
  );
}

// ───────────── Imagen con carga progresiva ─────────────
export function FadeImage({
  uri,
  style,
  resizeMode = 'cover',
  onError,
}: {
  uri: string;
  style?: StyleProp<ViewStyle>;
  resizeMode?: ImageResizeMode;
  onError?: () => void;
}) {
  useTheme();
  const [loaded, setLoaded] = useState(false);
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    setLoaded(false);
    v.setValue(0);
  }, [uri, v]);
  return (
    <View style={[{ backgroundColor: colors.tint, overflow: 'hidden' }, style]}>
      {!loaded ? <SkeletonFill /> : null}
      <Animated.View style={{ flex: 1, opacity: v }}>
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          resizeMode={resizeMode}
          onLoad={() => {
            setLoaded(true);
            if (reduceMotion) v.setValue(1);
            else Animated.timing(v, { toValue: 1, duration: 260, useNativeDriver: native }).start();
          }}
          onError={() => {
            setLoaded(true);
            onError?.();
          }}
        />
      </Animated.View>
    </View>
  );
}

// ───────────── Barra de progreso global (peticiones en curso) ─────────────
let inflight = 0;
const netListeners = new Set<() => void>();
export function networkStart() {
  inflight++;
  netListeners.forEach((l) => l());
}
export function networkEnd() {
  inflight = Math.max(0, inflight - 1);
  netListeners.forEach((l) => l());
}

/** Línea fina arriba de la pantalla: aparece si una petición tarda más de ~250 ms. */
export function NetworkBar() {
  useTheme();
  const [busy, setBusy] = useState(false);
  const x = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const check = () => {
      if (inflight > 0) {
        if (!timer) timer = setTimeout(() => setBusy(true), 250);
      } else {
        if (timer) clearTimeout(timer);
        timer = null;
        setBusy(false);
      }
    };
    netListeners.add(check);
    return () => {
      netListeners.delete(check);
      if (timer) clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!busy) return;
    x.setValue(0);
    const loop = Animated.loop(
      Animated.timing(x, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.cubic), useNativeDriver: native }),
    );
    loop.start();
    return () => loop.stop();
  }, [busy, x]);

  if (!busy) return null;
  const bar = Math.max(width * 0.35, 80);
  return (
    <View
      pointerEvents="none"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, zIndex: 1000, overflow: 'hidden' }}
    >
      <Animated.View
        style={{
          width: bar,
          height: 3,
          borderRadius: 2,
          backgroundColor: colors.primary,
          transform: [{ translateX: x.interpolate({ inputRange: [0, 1], outputRange: [-bar, width] }) }],
        }}
      />
    </View>
  );
}
