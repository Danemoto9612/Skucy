import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { MicrosoftCancelled } from '../../src/api/microsoft';
import { completeRegistration, loginWithMicrosoft, registerStart, type LoginResult } from '../../src/store/actions';
import { institutionName } from '../../shared/selectors';
import { refresh, useDb } from '../../src/store/store';
import { Banner, Button, Chip, Input, Row, Screen, T } from '../../src/ui/components';
import { attempt } from '../../src/ui/session';
import { colors, useTheme } from '../../src/ui/theme';

export default function RegisterScreen() {
  const params = useLocalSearchParams<{
    email?: string;
    institutionId?: string;
    registrationToken?: string;
    method?: 'microsoft' | 'password';
    name?: string;
  }>();
  // Paso 0 (sin parámetros): elegir cómo registrarse. Paso 1: completar el perfil.
  const [pass, setPass] = useState<null | { email: string; institutionId: string; registrationToken: string; method: 'microsoft' | 'password'; name?: string }>(
    params.registrationToken && params.email && params.institutionId
      ? { email: params.email, institutionId: params.institutionId, registrationToken: params.registrationToken, method: params.method ?? 'microsoft', name: params.name }
      : null,
  );
  if (!pass) return <RegisterStart onPass={setPass} />;
  return <RegisterProfile pass={pass} />;
}

type Pass = { email: string; institutionId: string; registrationToken: string; method: 'microsoft' | 'password'; name?: string };

/** HU-03: registrarse con Microsoft 365 o, en manual, validar el correo institucional. */
function RegisterStart({ onPass }: { onPass: (p: Pass) => void }) {
  useTheme();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const handle = (result: LoginResult) => {
    if (result.kind === 'register') onPass(result);
    else if (result.kind === 'institution_request') {
      router.push({ pathname: '/institution-request', params: { email: result.email, domain: result.domain } });
    }
    // 'ok' = esa cuenta de Microsoft ya existía: el guard de rutas entra a la app.
  };
  const run = async (fn: () => Promise<LoginResult | null>) => {
    setBusy(true);
    await attempt(fn, (r) => r && handle(r));
    setBusy(false);
  };

  return (
    <Screen>
      <T variant="h1">Crear cuenta</T>
      <T variant="body" color={colors.charcoal}>Solo con tu correo institucional de Microsoft 365.</T>
      <Button
        title="Registrarme con Microsoft 365"
        icon="logo-microsoft"
        disabled={busy}
        onPress={() =>
          run(async () => {
            try {
              return await loginWithMicrosoft();
            } catch (e) {
              if (e instanceof MicrosoftCancelled) return null;
              throw e;
            }
          })
        }
      />
      <T variant="caption" color={colors.charcoal} style={{ textAlign: 'center' }}>o regístrate manualmente</T>
      <Input
        label="Correo institucional"
        icon="at"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
      />
      <Button
        title="Continuar con mi correo"
        variant="outline"
        disabled={busy || !email.trim()}
        onPress={() => run(() => registerStart(email))}
      />
      <Button title="Volver" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}

function RegisterProfile({ pass }: { pass: Pass }) {
  useTheme();
  const { email, institutionId, registrationToken, method } = pass;
  const db = useDb();
  // El catálogo pudo cambiar desde que se abrió la app: se vuelve a leer al entrar a esta pantalla.
  useEffect(() => {
    refresh().catch(() => undefined);
  }, []);
  const degrees = db.degrees.filter((d) => d.institutionId === institutionId);
  const [name, setName] = useState(pass.name ?? '');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [bio, setBio] = useState('');
  const [chosenDegreeId, setDegreeId] = useState('');
  const [semester, setSemester] = useState('1');
  // Si no se eligió ninguna, se usa la primera carrera disponible (también cuando el catálogo llega después).
  const degree = degrees.find((d) => d.id === chosenDegreeId) ?? degrees[0];
  const degreeId = degree?.id ?? '';

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <T variant="h1">Crea tu perfil</T>
      </View>

      <Banner tone="success" text={`${email} · ${institutionName(db, institutionId ?? '')}`} icon="checkmark-circle-outline" />

      {method === 'microsoft' ? (
        <Banner tone="success" text="Identidad verificada con Microsoft 365. No necesitas crear contraseña." icon="shield-checkmark-outline" />
      ) : (
        <Banner tone="warning" text="Registro manual: crea una contraseña para Skucy (no uses la de Microsoft). Tu correo queda sin verificar; si luego entras con Microsoft 365, se verifica." icon="information-circle-outline" />
      )}

      <Input label="Nombre completo" icon="person-outline" value={name} onChangeText={setName} />
      {method === 'password' ? (
        <>
          <Input label="Contraseña (mín. 8, con letras y números)" icon="lock-closed-outline" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
          <Input label="Repite la contraseña" icon="lock-closed-outline" value={password2} onChangeText={setPassword2} secureTextEntry autoCapitalize="none" error={password2 && password !== password2 ? 'No coinciden' : undefined} />
        </>
      ) : null}
      <Input label="Biografía (opcional)" value={bio} onChangeText={setBio} multiline />

      <View style={{ gap: 6 }}>
        <T variant="labelSm" color={colors.charcoal}>Carrera</T>
        {degrees.length === 0 ? (
          <Banner tone="warning" text="Esta institución todavía no tiene carreras. Pídele al administrador que las cree y vuelve a intentarlo." />
        ) : (
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {degrees.map((d) => (
              <Chip key={d.id} label={d.name} selected={d.id === degreeId} onPress={() => setDegreeId(d.id)} />
            ))}
          </Row>
        )}
      </View>

      <Input
        label={`Semestre actual (1-${degree?.semesters ?? 10})`}
        icon="calendar-outline"
        value={semester}
        onChangeText={setSemester}
        keyboardType="number-pad"
      />

      <Button
        title="Crear mi cuenta"
        icon="arrow-forward"
        disabled={!degreeId || (method === 'password' && (!password || password !== password2))}
        onPress={() =>
          attempt(() =>
            completeRegistration({
              registrationToken,
              ...(method === 'password' ? { password } : {}),
              name,
              bio,
              degreeId,
              semester: parseInt(semester, 10),
            }),
          )
        }
      />
      <Button title="Cancelar" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
