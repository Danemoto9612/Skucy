// Reproductor del video subido por el creator. El video está en un bucket privado de Supabase Storage:
// al pulsar play se pide al backend una URL firmada (válida 1 hora) y solo si el usuario tiene acceso.
import { Ionicons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';
import { getPlaybackUrl } from '../store/actions';
import { T } from './components';
import { colors, radius } from './theme';

function Playing({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => {
    p.play();
  });
  return (
    <VideoView
      player={player}
      style={{ width: '100%', height: '100%' }}
      nativeControls
      allowsFullscreen
      contentFit="contain"
    />
  );
}

export function VideoPlayer({ contentId, thumbnailUrl }: { contentId: string; thumbnailUrl?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Si cambia el contenido, se descarta la URL anterior.
  useEffect(() => {
    setUrl(null);
    setError(null);
  }, [contentId]);

  const start = async () => {
    setLoading(true);
    setError(null);
    try {
      setUrl(await getPlaybackUrl(contentId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el video.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ height: 210, borderRadius: radius.xl, overflow: 'hidden', backgroundColor: colors.charcoal }}>
      {url ? (
        <Playing url={url} />
      ) : (
        <Pressable onPress={start} disabled={loading} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          {thumbnailUrl ? (
            <Image source={{ uri: thumbnailUrl }} style={{ position: 'absolute', width: '100%', height: '100%' }} resizeMode="cover" />
          ) : null}
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: 'rgba(0,0,0,0.55)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {loading ? <ActivityIndicator color={colors.white} /> : <Ionicons name="play" size={34} color={colors.white} />}
          </View>
          {error ? (
            <T variant="caption" color={colors.white} style={{ position: 'absolute', bottom: 10, paddingHorizontal: 12 }}>
              {error}
            </T>
          ) : null}
        </Pressable>
      )}
    </View>
  );
}
