import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { hasRole } from '../../shared/permissions';
import { APPLICATION_STATUS_LABEL } from '../../shared/types';
import { submitCreatorApplication } from '../../src/store/actions';
import { isCreatorSuspended, latestApplication, userById } from '../../shared/selectors';
import { useDb } from '../../src/store/store';
import { Banner, Button, Card, Chip, Input, Row, Screen, SectionHeader, T } from '../../src/ui/components';
import { attempt, requireLogin, useSession } from '../../src/ui/session';
import { colors, useTheme } from '../../src/ui/theme';

export default function CreatorApplyScreen() {
  useTheme();
  const db = useDb();
  const { user } = useSession();
  const [communityIds, setCommunityIds] = useState<string[]>(user ? [user.communityIds[0]] : []);
  const [subjectsText, setSubjectsText] = useState('');
  const [experience, setExperience] = useState('');
  const [links, setLinks] = useState('');
  const [accepted, setAccepted] = useState(false);

  if (!user) {
    return (
      <Screen>
        <Banner tone="brand" text="Inicia sesión para solicitar ser creator." />
        <Button title="Iniciar sesión" onPress={() => requireLogin(user)} />
      </Screen>
    );
  }

  const application = latestApplication(db, user.id);
  const isCreator = hasRole(user, 'CREATOR');
  const pending = application && (application.status === 'SUBMITTED' || application.status === 'UNDER_REVIEW');
  const canApply = !isCreator && !pending;
  const suspended = isCreatorSuspended(db, user.id);

  const toggle = (id: string) =>
    setCommunityIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <Screen>
      {suspended ? <Banner tone="danger" text="Tu cuenta de creator está suspendida." /> : null}
      {isCreator ? <Button title="Ir a mis contenidos" icon="videocam-outline" onPress={() => router.push('/creator/my-content')} /> : null}

      {application ? (
        <>
          <SectionHeader title="Estado de tu solicitud" />
          <Card style={{ gap: 8 }}>
            <Chip
              label={APPLICATION_STATUS_LABEL[application.status]}
              tone={
                application.status === 'APPROVED'
                  ? 'success'
                  : application.status === 'REJECTED' || application.status === 'SUSPENDED'
                    ? 'danger'
                    : 'warning'
              }
            />
            {application.history.map((h, i) => (
              <View key={`${h.at}-${i}`} style={{ gap: 2 }}>
                <T variant="labelSm">
                  {APPLICATION_STATUS_LABEL[h.status]} · {new Date(h.at).toLocaleDateString()}
                </T>
                <T variant="caption" color={colors.muted}>
                  Por {userById(db, h.actorId)?.name ?? 'sistema'}
                  {h.reason ? ` — ${h.reason}` : ''}
                </T>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {canApply ? (
        <>
          <SectionHeader title="Nueva solicitud" />
          <View style={{ gap: 6 }}>
            <T variant="labelSm" color={colors.charcoal}>Comunidades donde quieres publicar</T>
            <Row gap={6} style={{ flexWrap: 'wrap' }}>
              {db.communities.map((c) => (
                <Chip key={c.id} label={c.name} selected={communityIds.includes(c.id)} onPress={() => toggle(c.id)} />
              ))}
            </Row>
          </View>
          <Input label="Materias o áreas que cubrirás" value={subjectsText} onChangeText={setSubjectsText} />
          <Input label="Breve descripción de tu experiencia" value={experience} onChangeText={setExperience} multiline />
          <Input label="Enlaces de muestra (opcional)" value={links} onChangeText={setLinks} autoCapitalize="none" />
          <Chip
            label={accepted ? '✓ Acepto los términos de publicación' : 'Acepto los términos de publicación'}
            tone={accepted ? 'success' : 'neutral'}
            onPress={() => setAccepted((v) => !v)}
          />
          <Button
            title="Enviar solicitud"
            icon="paper-plane-outline"
            onPress={() =>
              attempt(() => submitCreatorApplication({ communityIds, subjectsText, experience, links, acceptedTerms: accepted }))
            }
          />
        </>
      ) : null}
    </Screen>
  );
}
