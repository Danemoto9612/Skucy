import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { hasRole, ROLE_LABEL } from '../../shared/permissions';
import type { SubRatings } from '../../shared/types';
import {
  deleteMyRating,
  followUser,
  setRatingHidden,
  unfollowUser,
  upsertRating,
} from '../../src/store/actions';
import {
  followersCount,
  followingCount,
  institutionName,
  isCreatorSuspended,
  isFollowing,
  isVerified,
  myRating,
  ratingAggregate,
  ratingEligibility,
  timeAgo,
  userByHandle,
  userById,
} from '../../shared/selectors';
import { useDb } from '../../src/store/store';
import {
  Avatar,
  Banner,
  Button,
  Card,
  Chip,
  EmptyState,
  Input,
  ReasonActions,
  Row,
  Screen,
  SectionHeader,
  Stars,
  Stat,
  T,
} from '../../src/ui/components';
import { ContentCard } from '../../src/ui/ContentCard';
import { attempt, confirm, requireLogin, useSession } from '../../src/ui/session';
import { colors, radius, useTheme } from '../../src/ui/theme';

const SUB_LABELS: { key: keyof SubRatings; label: string }[] = [
  { key: 'video', label: 'Calidad de video' },
  { key: 'clarity', label: 'Claridad de explicación' },
  { key: 'activities', label: 'Actividades' },
  { key: 'resources', label: 'Recursos' },
];

export default function PublicProfileScreen() {
  useTheme();
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const db = useDb();
  const { user, can } = useSession();
  const profile = userByHandle(db, handle ?? '');

  const mine = profile ? myRating(db, user?.id, profile.id) : undefined;
  const [stars, setStars] = useState(mine?.stars ?? 0);
  const [sub, setSub] = useState<SubRatings>(mine?.sub ?? {});
  const [comment, setComment] = useState(mine?.comment ?? '');

  if (!profile) {
    return (
      <Screen>
        <Banner tone="danger" text="Perfil no encontrado." />
      </Screen>
    );
  }

  const isMe = user?.id === profile.id;
  const isCreator = hasRole(profile, 'CREATOR');
  const following = isFollowing(db, user?.id, profile.id);
  const aggregate = ratingAggregate(db, profile.id);
  const eligibility = ratingEligibility(db, user, profile.id);
  const contents = db.contents
    .filter((c) => c.creatorId === profile.id && c.status === 'PUBLISHED')
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''));
  const ratings = db.ratings.filter((r) => r.creatorId === profile.id);
  const visibleRatings = ratings.filter((r) => !r.hidden || can('moderation:hide_rating'));
  const max = Math.max(1, ...Object.values(aggregate.distribution));
  const degree = db.degrees.find((d) => d.id === profile.degreeId);

  return (
    <Screen>
      <Stack.Screen options={{ title: `@${profile.handle}` }} />

      <Card style={{ alignItems: 'center', gap: 6 }}>
        <Avatar name={profile.name} uri={profile.avatarUrl} size={84} verified={isVerified(db, profile.id)} />
        <T variant="h1">{profile.name}</T>
        <Row gap={6} style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
          {profile.roles
            .filter((r) => r !== 'VIEWER')
            .map((r) => (
              <Chip key={r} label={ROLE_LABEL[r]} tone={r === 'ADMIN' ? 'violet' : 'brand'} />
            ))}
          {isVerified(db, profile.id) ? <Chip label="Verificado" tone="violet" icon="checkmark-circle" /> : null}
          {isCreatorSuspended(db, profile.id) ? <Chip label="Creator suspendido" tone="danger" /> : null}
        </Row>
        <T variant="bodySm" color={colors.charcoal} style={{ textAlign: 'center' }}>
          {degree?.name} · Semestre {profile.semester}
        </T>
        <T variant="bodySm" color={colors.muted}>{institutionName(db, profile.institutionId)}</T>
        {profile.bio ? <T variant="body" color={colors.charcoal} style={{ textAlign: 'center' }}>{profile.bio}</T> : null}
      </Card>

      <Row gap={8}>
        <Stat value={followersCount(db, profile.id)} label="Seguidores" />
        <Stat value={followingCount(db, profile.id)} label="Siguiendo" />
        <Stat value={contents.length} label="Contenidos" />
      </Row>

      {isMe ? (
        <Button title="Ir a mi perfil" variant="soft" onPress={() => router.push('/profile')} />
      ) : (
        <Row gap={8}>
          <Button
            style={{ flex: 1 }}
            title={following ? 'Siguiendo' : 'Seguir'}
            variant={following ? 'outline' : 'primary'}
            icon={following ? 'checkmark' : 'person-add-outline'}
            onPress={() =>
              requireLogin(user) &&
              attempt(() => (following ? unfollowUser(profile.id) : followUser(profile.id)))
            }
          />
          <Button
            variant="outline"
            icon="flag-outline"
            title="Reportar"
            onPress={() =>
              requireLogin(user) && router.push({ pathname: '/report', params: { type: 'USER', id: profile.id } })
            }
          />
        </Row>
      )}
      <Button
        title="Ver seguidores y seguidos"
        variant="ghost"
        icon="people-outline"
        onPress={() => router.push(`/follows/${profile.handle}`)}
      />

      {isCreator ? (
        <>
          <SectionHeader title="Calificación" count={aggregate.count} />
          <Card style={{ gap: 10 }}>
            {aggregate.count === 0 ? (
              <T color={colors.muted}>Aún no tiene calificaciones.</T>
            ) : (
              <>
                <Row gap={12}>
                  <T variant="display" color={colors.primaryDark}>{aggregate.average.toFixed(1)}</T>
                  <View style={{ gap: 2 }}>
                    <Stars value={aggregate.average} size={18} />
                    <T variant="caption" color={colors.muted}>{aggregate.count} calificaciones (promedio ponderado)</T>
                  </View>
                </Row>
                {([5, 4, 3, 2, 1] as const).map((n) => (
                  <Row key={n} gap={8}>
                    <T variant="caption" color={colors.charcoal} style={{ width: 14 }}>{n}</T>
                    <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.tint }}>
                      <View
                        style={{
                          width: `${(aggregate.distribution[n] / max) * 100}%`,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: colors.accent,
                        }}
                      />
                    </View>
                    <T variant="caption" color={colors.muted} style={{ width: 20, textAlign: 'right' }}>
                      {aggregate.distribution[n]}
                    </T>
                  </Row>
                ))}
                <Row gap={6} style={{ flexWrap: 'wrap' }}>
                  {SUB_LABELS.filter((s) => aggregate.sub[s.key]).map((s) => (
                    <Chip key={s.key} label={`${s.label}: ${aggregate.sub[s.key]}`} tone="neutral" />
                  ))}
                </Row>
              </>
            )}
          </Card>

          {!isMe ? (
            <Card style={{ gap: 10 }}>
              <T variant="h3">{mine ? 'Tu calificación' : 'Califica a este creator'}</T>
              {!eligibility.ok ? (
                <Banner tone="warning" text={eligibility.reason ?? 'No puedes calificar.'} />
              ) : (
                <>
                  <Stars value={stars} size={30} onChange={setStars} />
                  {SUB_LABELS.map((s) => (
                    <Row key={s.key} gap={8} style={{ justifyContent: 'space-between' }}>
                      <T variant="bodySm" color={colors.charcoal}>{s.label} (opcional)</T>
                      <Stars
                        value={sub[s.key] ?? 0}
                        size={20}
                        onChange={(v) => setSub((prev) => ({ ...prev, [s.key]: v }))}
                      />
                    </Row>
                  ))}
                  <Input value={comment} onChangeText={setComment} multiline />
                  <Row gap={8}>
                    <Button
                      style={{ flex: 1 }}
                      title={mine ? 'Actualizar' : 'Enviar calificación'}
                      onPress={() => attempt(() => upsertRating(profile.id, stars, sub, comment))}
                    />
                    {mine ? (
                      <Button
                        variant="danger"
                        title="Eliminar"
                        onPress={() =>
                          confirm('Eliminar calificación', '¿Quieres eliminar tu calificación?', () => {
                            attempt(() => deleteMyRating(profile.id));
                            setStars(0);
                            setSub({});
                            setComment('');
                          })
                        }
                      />
                    ) : null}
                  </Row>
                </>
              )}
            </Card>
          ) : null}

          {visibleRatings.length > 0 ? <SectionHeader title="Opiniones" /> : null}
          {visibleRatings.map((r) => {
            const author = userById(db, r.viewerId);
            return (
              <Card key={r.id} style={{ gap: 6, opacity: r.hidden ? 0.6 : 1 }}>
                <Row gap={8}>
                  <Avatar name={author?.name ?? '?'} uri={author?.avatarUrl} size={28} />
                  <T variant="label">{author?.name ?? 'Usuario'}</T>
                  <T variant="caption" color={colors.muted}>{timeAgo(r.updatedAt)}</T>
                  {r.hidden ? <Chip label="Oculta" tone="danger" /> : null}
                </Row>
                <Stars value={r.stars} size={14} />
                {r.comment ? <T variant="bodySm" color={colors.charcoal}>{r.comment}</T> : null}
                {can('moderation:hide_rating') ? (
                  <ReasonActions
                    actions={[
                      r.hidden
                        ? { title: 'Restaurar', run: (reason: string) => attempt(() => setRatingHidden(r.id, false, reason)) }
                        : { title: 'Ocultar (fraude)', variant: 'danger' as const, run: (reason: string) => attempt(() => setRatingHidden(r.id, true, reason)) },
                    ]}
                  />
                ) : null}
              </Card>
            );
          })}
        </>
      ) : null}

      <SectionHeader title="Contenido" count={contents.length} />
      {contents.length === 0 ? (
        <EmptyState icon="film-outline" title="Sin contenido publicado" />
      ) : (
        contents.map((c) => <ContentCard key={c.id} content={c} />)
      )}
      <View style={{ borderRadius: radius.md }} />
    </Screen>
  );
}
