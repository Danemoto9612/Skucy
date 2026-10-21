import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Image, View } from 'react-native';
import {
  CONTENT_TYPE_LABEL,
  VISIBILITY_LABEL,
  type ContentType,
  type Visibility,
} from '../../shared/types';
import { canPublish, isCreatorSuspended, latestApplication } from '../../shared/selectors';
import { saveContent, submitForReview, uploadThumbnail, uploadVideo } from '../../src/store/actions';
import { useDb } from '../../src/store/store';
import { Banner, Button, Card, Chip, Input, Row, Screen, Segmented, T } from '../../src/ui/components';
import { pickImage, pickVideo, type Picked } from '../../src/ui/media';
import { attempt, useSession } from '../../src/ui/session';
import { colors, radius } from '../../src/ui/theme';

export default function EditContentScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const db = useDb();
  const { user } = useSession();
  const existing = id ? db.contents.find((c) => c.id === id && c.creatorId === user?.id) : undefined;

  const application = user ? latestApplication(db, user.id) : undefined;
  const allowedCommunityIds = Array.from(
    new Set([...(application?.communityIds ?? []), ...(user?.communityIds.slice(0, 1) ?? [])]),
  );
  const communities = db.communities.filter((c) => allowedCommunityIds.includes(c.id));

  const [type, setType] = useState<ContentType>(existing?.type ?? 'VIDEO');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [description, setDescription] = useState(existing?.description ?? '');
  const [communityId, setCommunityId] = useState(existing?.communityId ?? communities[0]?.id ?? '');
  const [subjectId, setSubjectId] = useState(existing?.subjectId ?? '');
  const [tags, setTags] = useState(existing?.tags.join(', ') ?? '');
  const [visibility, setVisibility] = useState<Visibility>(existing?.visibility ?? 'PUBLIC');
  const [priceLabel, setPriceLabel] = useState(existing?.priceLabel ?? '');
  const [video, setVideo] = useState<Picked | null>(null);
  const [cover, setCover] = useState<Picked | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  if (!user || !canPublish(db, user)) {
    return (
      <Screen>
        <Banner
          tone="danger"
          text={
            user && isCreatorSuspended(db, user.id)
              ? 'Tu cuenta de creator está suspendida.'
              : 'Solo los creators aprobados pueden crear contenido.'
          }
        />
      </Screen>
    );
  }

  const degreeId = db.communities.find((c) => c.id === communityId)?.degreeId;
  const subjects = db.subjects.filter((s) => s.degreeId === degreeId).sort((a, b) => a.semester - b.semester);
  const hasVideo = !!video || !!existing?.hasVideo;

  const choose = (picker: () => Promise<Picked | null>, set: (f: Picked | null) => void) =>
    attempt(picker, (file) => {
      if (file) set(file);
    });

  const input = () => ({
    type,
    title,
    description,
    subjectId,
    communityId,
    tags: tags.split(','),
    visibility,
    priceLabel,
  });

  /** Guarda los datos, sube el video y la portada elegidos y devuelve el id del contenido. */
  const persist = async (): Promise<string | null> => {
    let savedId: string | null = null;
    const saved = await attempt(
      () => saveContent(input(), existing?.id),
      (newId) => {
        savedId = newId;
      },
    );
    if (!saved || !savedId) return null;
    const cid: string = savedId;
    if (type === 'VIDEO' && video) {
      setProgress(0);
      const ok = await attempt(() => uploadVideo(cid, video, setProgress));
      setProgress(null);
      if (!ok) return null;
      setVideo(null);
    }
    if (type === 'VIDEO' && cover) {
      if (!(await attempt(() => uploadThumbnail(cid, cover)))) return null;
      setCover(null);
    }
    return cid;
  };

  const saveDraft = async () => {
    setBusy(true);
    const id = await persist();
    setBusy(false);
    if (id) router.back();
  };

  const saveAndSubmit = async () => {
    setBusy(true);
    const id = await persist();
    if (id && (await attempt(() => submitForReview(id)))) {
      setBusy(false);
      router.back();
      return;
    }
    setBusy(false);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: existing ? 'Editar contenido' : 'Nuevo contenido' }} />

      <View style={{ gap: 6 }}>
        <T variant="labelSm" color={colors.charcoal}>Tipo</T>
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          {(Object.keys(CONTENT_TYPE_LABEL) as ContentType[]).map((t) => (
            <Chip
              key={t}
              label={CONTENT_TYPE_LABEL[t]}
              selected={type === t}
              onPress={() => setType(t)}
            />
          ))}
        </Row>
      </View>

      {type === 'VIDEO' ? (
        <Card style={{ gap: 10 }}>
          <T variant="h3">Video</T>
          <Button
            title={hasVideo ? 'Cambiar video' : 'Elegir video de la galería'}
            variant="soft"
            icon="videocam-outline"
            disabled={busy}
            onPress={() => choose(pickVideo, setVideo)}
          />
          {video ? (
            <T variant="caption" color={colors.charcoal}>
              {video.name}
              {video.size ? ` · ${(video.size / (1024 * 1024)).toFixed(1)} MB` : ''}
            </T>
          ) : existing?.hasVideo ? (
            <T variant="caption" color={colors.charcoal}>
              Video cargado{existing.videoSizeBytes ? ` · ${(existing.videoSizeBytes / (1024 * 1024)).toFixed(1)} MB` : ''}
            </T>
          ) : null}

          <Button
            title={cover || existing?.thumbnailUrl ? 'Cambiar portada' : 'Elegir portada'}
            variant="soft"
            icon="image-outline"
            disabled={busy}
            onPress={() => choose(() => pickImage(false), setCover)}
          />
          {cover || existing?.thumbnailUrl ? (
            <Image
              source={{ uri: cover?.uri ?? existing?.thumbnailUrl }}
              style={{ width: '100%', height: 170, borderRadius: radius.md, backgroundColor: colors.tint }}
              resizeMode="cover"
            />
          ) : null}
          {progress !== null ? (
            <View style={{ gap: 4 }}>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.wash, overflow: 'hidden' }}>
                <View style={{ width: `${Math.round(progress * 100)}%`, height: '100%', backgroundColor: colors.primary }} />
              </View>
              <T variant="caption" color={colors.muted}>Subiendo… {Math.round(progress * 100)}%</T>
            </View>
          ) : null}
        </Card>
      ) : null}

      <Input label="Título" value={title} onChangeText={setTitle} />
      <Input label="Descripción" value={description} onChangeText={setDescription} multiline />

      <View style={{ gap: 6 }}>
        <T variant="labelSm" color={colors.charcoal}>Comunidad (solo las autorizadas)</T>
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          {communities.map((c) => (
            <Chip
              key={c.id}
              label={c.name}
              selected={c.id === communityId}
              onPress={() => {
                setCommunityId(c.id);
                setSubjectId('');
              }}
            />
          ))}
        </Row>
      </View>

      <View style={{ gap: 6 }}>
        <T variant="labelSm" color={colors.charcoal}>Materia</T>
        <Row gap={6} style={{ flexWrap: 'wrap' }}>
          {subjects.map((s) => (
            <Chip key={s.id} label={`S${s.semester} · ${s.name}`} selected={s.id === subjectId} onPress={() => setSubjectId(s.id)} />
          ))}
        </Row>
      </View>

      <Input label="Etiquetas (separadas por coma)" value={tags} onChangeText={setTags} autoCapitalize="none" />

      <View style={{ gap: 6 }}>
        <T variant="labelSm" color={colors.charcoal}>Visibilidad</T>
        <Segmented
          value={visibility}
          onChange={setVisibility}
          options={(Object.keys(VISIBILITY_LABEL) as Visibility[]).map((v) => ({ value: v, label: VISIBILITY_LABEL[v] }))}
        />
      </View>
      {visibility === 'PAID' ? (
        <Input label="Precio de referencia" value={priceLabel} onChangeText={setPriceLabel} />
      ) : null}

      <Button title="Guardar borrador" variant="outline" disabled={busy} onPress={saveDraft} />
      <Button title="Guardar y enviar a revisión" icon="send-outline" loading={busy} onPress={saveAndSubmit} />
    </Screen>
  );
}
