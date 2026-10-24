import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { View } from 'react-native';
import {
  CONTENT_STATUS_LABEL,
  CONTENT_TYPE_LABEL,
  VISIBILITY_LABEL,
} from '../../shared/types';
import {
  archiveOwnContent,
  moderateContent,
  publishContent,
  recordView,
  submitForReview,
  toggleSave,
} from '../../src/store/actions';
import { contentAccess, degreeName, isVerified, subjectName, userById } from '../../shared/selectors';
import { useDb } from '../../src/store/store';
import {
  Avatar,
  Banner,
  Button,
  Card,
  Chip,
  ReasonActions,
  Row,
  Screen,
  SectionHeader,
  T,
} from '../../src/ui/components';
import { attempt, requireLogin, useSession } from '../../src/ui/session';
import { VideoPlayer } from '../../src/ui/VideoPlayer';
import { colors, radius, useTheme } from '../../src/ui/theme';

export default function ContentDetailScreen() {
  useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDb();
  const { user, can } = useSession();
  const content = db.contents.find((c) => c.id === id);

  useEffect(() => {
    if (id) recordView(id);
    // Se registra una sola vez al abrir el detalle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!content) {
    return (
      <Screen>
        <Banner tone="danger" text="Contenido no encontrado." />
      </Screen>
    );
  }

  const access = contentAccess(db, content, user);
  const creator = userById(db, content.creatorId);
  const isOwner = user?.id === content.creatorId;
  const saved = !!user && db.saved.some((s) => s.userId === user.id && s.contentId === content.id);
  const canModerate = can('moderation:content') && !isOwner;
  const statusTone =
    content.status === 'PUBLISHED' || content.status === 'APPROVED'
      ? 'success'
      : content.status === 'REJECTED' || content.status === 'REMOVED'
        ? 'danger'
        : 'warning';

  return (
    <Screen>
      <Stack.Screen options={{ title: CONTENT_TYPE_LABEL[content.type] }} />

      {/* Reproductor del video subido (Supabase Storage); si no hay video, un recuadro según el estado */}
      {access.ok && content.hasVideo ? (
        <VideoPlayer contentId={content.id} thumbnailUrl={content.thumbnailUrl} />
      ) : (
        <View
          style={{
            height: 190,
            borderRadius: radius.xl,
            backgroundColor: access.ok ? colors.primaryDeep : colors.charcoal,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <Ionicons
            name={!access.ok ? 'lock-closed' : content.type === 'VIDEO' ? 'play-circle' : 'document-text'}
            size={64}
            color={colors.white}
          />
          {!access.ok ? (
            <T variant="labelSm" color={colors.white}>Contenido bloqueado</T>
          ) : null}
        </View>
      )}

      <View style={{ gap: 6 }}>
        <T variant="h1">{content.title}</T>
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          <Chip label={CONTENT_TYPE_LABEL[content.type]} />
          <Chip label={VISIBILITY_LABEL[content.visibility]} tone="violet" />
          <Chip label={CONTENT_STATUS_LABEL[content.status]} tone={statusTone} />
        </Row>
      </View>

      {!access.ok ? <Banner tone="warning" text={access.reason ?? 'Sin acceso.'} icon="lock-closed-outline" /> : null}

      {access.ok ? <T color={colors.charcoal}>{content.description}</T> : null}

      <Card style={{ gap: 4 }}>
        <T variant="labelSm" color={colors.muted}>UBICACIÓN ACADÉMICA</T>
        <T variant="label">{degreeName(db, content.degreeId)}</T>
        <T variant="bodySm" color={colors.charcoal} onPress={() => router.push(`/subject/${content.subjectId}`)}>
          Semestre {content.semester} · {subjectName(db, content.subjectId)}
        </T>
        {content.tags.length ? (
          <Row gap={6} style={{ flexWrap: 'wrap', marginTop: 6 }}>
            {content.tags.map((t) => (
              <Chip key={t} label={`#${t}`} tone="neutral" />
            ))}
          </Row>
        ) : null}
        {content.visibility === 'PAID' ? (
          <T variant="caption" color={colors.warningText}>
            {content.priceLabel ?? 'Precio por definir'} · Los pagos aún no están disponibles
          </T>
        ) : null}
      </Card>

      {creator ? (
        <Card onPress={() => router.push(`/profile/${creator.handle}`)}>
          <Row gap={12}>
            <Avatar name={creator.name} uri={creator.avatarUrl} verified={isVerified(db, creator.id)} />
            <View style={{ flex: 1 }}>
              <T variant="label">{creator.name}</T>
              <T variant="caption" color={colors.muted}>@{creator.handle} · ver perfil</T>
            </View>
          </Row>
        </Card>
      ) : null}

      <Row gap={16}>
        <T variant="caption" color={colors.muted}>{content.views} vistas</T>
        <T variant="caption" color={colors.muted}>{content.saves} guardados</T>
        <T variant="caption" color={colors.muted}>{content.reportsCount} reportes</T>
      </Row>

      {/* Acciones del viewer */}
      {!isOwner ? (
        <Row gap={8}>
          <Button
            style={{ flex: 1 }}
            variant={saved ? 'soft' : 'outline'}
            icon={saved ? 'bookmark' : 'bookmark-outline'}
            title={saved ? 'Guardado' : 'Guardar'}
            onPress={() => requireLogin(user) && attempt(() => toggleSave(content.id))}
          />
          <Button
            style={{ flex: 1 }}
            variant="outline"
            icon="flag-outline"
            title="Reportar"
            onPress={() =>
              requireLogin(user) && router.push({ pathname: '/report', params: { type: 'CONTENT', id: content.id } })
            }
          />
        </Row>
      ) : null}

      {/* Estado y observaciones de moderación (creator / moderación) */}
      {isOwner || canModerate ? (
        <>
          <SectionHeader title="Estado de moderación" />
          <Card style={{ gap: 10 }}>
            <Row gap={8}>
              <Chip label={CONTENT_STATUS_LABEL[content.status]} tone={statusTone} />
            </Row>
            {content.rejectionReason ? (
              <Banner tone="danger" text={`Observaciones: ${content.rejectionReason}`} />
            ) : null}
            {content.status === 'APPROVED' ? (
              <T variant="bodySm" color={colors.successText}>Aprobado por moderación. Ya puedes publicarlo.</T>
            ) : null}
          </Card>
        </>
      ) : null}

      {isOwner ? (
        <View style={{ gap: 8 }}>
          {content.status === 'DRAFT' || content.status === 'REJECTED' ? (
            <>
              <Button title="Editar" variant="outline" icon="create-outline" onPress={() => router.push({ pathname: '/content/edit', params: { id: content.id } })} />
              <Button title="Enviar a revisión" icon="send-outline" onPress={() => attempt(() => submitForReview(content.id))} />
            </>
          ) : null}
          {content.status === 'APPROVED' ? (
            <Button title="Publicar" icon="rocket-outline" onPress={() => attempt(() => publishContent(content.id))} />
          ) : null}
          {content.status === 'PUBLISHED' || content.status === 'APPROVED' ? (
            <Button title="Archivar" variant="ghost" onPress={() => attempt(() => archiveOwnContent(content.id))} />
          ) : null}
        </View>
      ) : null}

      {canModerate ? (
        <>
          <SectionHeader title="Moderación" />
          <ReasonActions
            actions={[
              ...(content.status === 'PENDING_REVIEW'
                ? [
                    { title: 'Aprobar', icon: 'checkmark' as const, run: () => attempt(() => moderateContent(content.id, 'APPROVED')) },
                    { title: 'Rechazar', variant: 'danger' as const, run: (r: string) => attempt(() => moderateContent(content.id, 'REJECTED', r)) },
                  ]
                : []),
              { title: 'Archivar', run: (r: string) => attempt(() => moderateContent(content.id, 'ARCHIVED', r)) },
              { title: 'Retirar', variant: 'danger' as const, run: (r: string) => attempt(() => moderateContent(content.id, 'REMOVED', r)) },
            ]}
          />
        </>
      ) : null}
    </Screen>
  );
}
