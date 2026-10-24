import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { hasRole, ROLE_LABEL } from '../../shared/permissions';
import { ThemeSwitch } from '../../src/ui/ThemeSwitch';
import { logout, removeAvatar, toggleCommunity, updateProfile, uploadAvatar } from '../../src/store/actions';
import {
  followersCount,
  followingCount,
  institutionName,
  isVerified,
  latestApplication,
  ratingAggregate,
} from '../../shared/selectors';
import { useDb } from '../../src/store/store';
import { setGuest } from '../../src/store/ui';
import {
  Avatar,
  Banner,
  Button,
  Card,
  Chip,
  Input,
  ListItem,
  Row,
  Screen,
  SectionHeader,
  Stars,
  Stat,
  T,
} from '../../src/ui/components';
import { attempt, confirm, useSession } from '../../src/ui/session';
import { pickImage } from '../../src/ui/media';
import { colors, useTheme } from '../../src/ui/theme';
import { APPLICATION_STATUS_LABEL } from '../../shared/types';

export default function MyProfileScreen() {
  useTheme();
  const db = useDb();
  const { user } = useSession();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [semester, setSemester] = useState(String(user?.semester ?? 1));
  const [degreeId, setDegreeId] = useState(user?.degreeId ?? '');
  const [uploading, setUploading] = useState(false);

  const changePhoto = async () => {
    setUploading(true);
    await attempt(async () => {
      const file = await pickImage(true);
      if (file) await uploadAvatar(file);
    });
    setUploading(false);
  };

  if (!user) {
    return (
      <Screen>
        <T variant="h1">Perfil</T>
        <ThemeSwitch />
        <Button title="Iniciar sesión" icon="log-in-outline" onPress={() => setGuest(false)} />
      </Screen>
    );
  }

  const aggregate = ratingAggregate(db, user.id);
  const application = latestApplication(db, user.id);
  const isCreator = hasRole(user, 'CREATOR');
  const degrees = db.degrees.filter((d) => d.institutionId === user.institutionId);
  const joinable = db.communities.filter((c) => c.id !== user.communityIds[0]);

  return (
    <Screen>
      <Card style={{ alignItems: 'center', gap: 8 }}>
        <Avatar name={user.name} uri={user.avatarUrl} size={84} verified={isVerified(db, user.id)} />
        <T variant="h1">{user.name}</T>
        <T variant="bodySm" color={colors.muted}>@{user.handle} · {user.email}</T>
        {user.degreeId ? (
          <T variant="body" color={colors.charcoal} style={{ textAlign: 'center' }}>
            {db.degrees.find((d) => d.id === user.degreeId)?.name} · Semestre {user.semester}
          </T>
        ) : null}
        {user.institutionId ? <T variant="bodySm" color={colors.muted}>{institutionName(db, user.institutionId)}</T> : null}
        <Row gap={6} style={{ flexWrap: 'wrap', justifyContent: 'center' }}>
          {user.roles.map((r) => (
            <Chip key={r} label={ROLE_LABEL[r]} tone={r === 'ADMIN' ? 'violet' : 'brand'} />
          ))}
          {isVerified(db, user.id) ? <Chip label="Verificado" tone="violet" icon="checkmark-circle" /> : null}
          {user.status !== 'ACTIVE' ? <Chip label={user.status} tone="danger" /> : null}
        </Row>
        {user.bio ? <T variant="bodySm" color={colors.charcoal} style={{ textAlign: 'center' }}>{user.bio}</T> : null}
        <Row gap={8} style={{ alignSelf: 'stretch' }}>
          <Button
            style={{ flex: 1 }}
            variant="outline"
            icon="camera-outline"
            title={user.avatarUrl ? 'Cambiar foto' : 'Agregar foto'}
            loading={uploading}
            onPress={changePhoto}
          />
          {user.avatarUrl ? (
            <Button variant="ghost" icon="trash-outline" title="Quitar" disabled={uploading} onPress={() => attempt(removeAvatar)} />
          ) : null}
        </Row>
        <Row gap={8} style={{ alignSelf: 'stretch' }}>
          <Button style={{ flex: 1 }} variant="soft" icon="pencil" title={editing ? 'Cerrar edición' : 'Editar perfil'} onPress={() => setEditing((v) => !v)} />
          <Button variant="outline" icon="eye-outline" title="Perfil público" onPress={() => router.push(`/profile/${user.handle}`)} />
        </Row>
      </Card>

      {user.status !== 'ACTIVE' ? (
        <Banner tone="danger" text={`Tu cuenta está ${user.status}${user.statusReason ? `: ${user.statusReason}` : ''}. Solo tienes acceso de lectura.`} />
      ) : null}

      {editing ? (
        <Card style={{ gap: 12 }}>
          <Input label="Nombre" value={name} onChangeText={setName} />
          <Input label="Biografía" value={bio} onChangeText={setBio} multiline />
          {user.institutionId ? (
          <View style={{ gap: 6 }}>
            <T variant="labelSm" color={colors.charcoal}>Carrera</T>
            <Row gap={8} style={{ flexWrap: 'wrap' }}>
              {degrees.map((d) => (
                <Chip key={d.id} label={d.name} selected={d.id === degreeId} onPress={() => setDegreeId(d.id)} />
              ))}
            </Row>
          </View>
          ) : null}
          {user.institutionId ? (
            <Input label="Semestre" value={semester} onChangeText={setSemester} keyboardType="number-pad" />
          ) : null}
          <Button
            title="Guardar cambios"
            onPress={() =>
              attempt(
                () => updateProfile({ name, bio, semester: parseInt(semester, 10), degreeId }),
                () => setEditing(false),
              )
            }
          />
        </Card>
      ) : null}

      <Row gap={8}>
        <Stat value={followersCount(db, user.id)} label="Seguidores" />
        <Stat value={followingCount(db, user.id)} label="Siguiendo" />
        {isCreator ? (
          <Stat value={aggregate.count ? `${aggregate.average.toFixed(1)}★` : '—'} label="Calificación" />
        ) : (
          <Stat value={db.saved.filter((s) => s.userId === user.id).length} label="Guardados" />
        )}
      </Row>
      {isCreator && aggregate.count > 0 ? (
        <Row gap={8}>
          <Stars value={aggregate.average} />
          <T variant="caption" color={colors.muted}>{aggregate.count} calificaciones</T>
        </Row>
      ) : null}

      <SectionHeader title="Gestión" />
      <ListItem icon="people-outline" title="Seguidores y seguidos" onPress={() => router.push(`/follows/${user.handle}`)} />
      <ListItem icon="bookmark-outline" title="Guardados" onPress={() => router.push('/saved')} />
      <ListItem icon="notifications-outline" title="Notificaciones" onPress={() => router.push('/notifications')} />
      {isCreator ? (
        <ListItem
          icon="videocam-outline"
          title="Mis contenidos"
          onPress={() => router.push('/creator/my-content')}
        />
      ) : null}
      <ListItem
        icon="ribbon-outline"
        title={isCreator ? 'Estado de creator' : 'Solicitar ser creator'}
        subtitle={application ? `Solicitud: ${APPLICATION_STATUS_LABEL[application.status]}` : undefined}
        onPress={() => router.push('/creator/apply')}
      />

      {user.institutionId ? (
        <>
        <SectionHeader title="Comunidades" />
        <Row gap={8} style={{ flexWrap: 'wrap' }}>
          {user.communityIds.map((id, i) => {
            const c = db.communities.find((x) => x.id === id);
            return c ? <Chip key={id} label={`${i === 0 ? '★ ' : ''}${c.name}`} selected={i === 0} onPress={i === 0 ? undefined : () => attempt(() => toggleCommunity(id))} /> : null;
          })}
          {joinable
            .filter((c) => !user.communityIds.includes(c.id))
            .map((c) => (
              <Chip key={c.id} label={`+ ${c.name}`} tone="neutral" onPress={() => attempt(() => toggleCommunity(c.id))} />
            ))}
        </Row>
        </>
      ) : null}

      <ThemeSwitch />

      <Button
        title="Cerrar sesión"
        variant="danger"
        icon="log-out-outline"
        onPress={() =>
          confirm('Cerrar sesión', '¿Seguro que quieres salir?', () => {
            setGuest(false);
            logout();
          })
        }
      />
    </Screen>
  );
}
