import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { ROLE_LABEL } from '../../shared/permissions';
import { feedFor, followersCount, followingCount, PAGE_SIZE } from '../../shared/selectors';
import { useDb } from '../../src/store/store';
import { setGuest } from '../../src/store/ui';
import { Button, Chip, EmptyState, Pager, Row, Screen, SectionHeader, Stat, T } from '../../src/ui/components';
import { ContentCard } from '../../src/ui/ContentCard';
import { useSession } from '../../src/ui/session';

export default function HomeScreen() {
  const db = useDb();
  const { user } = useSession();
  const [page, setPage] = useState(1);
  const feed = feedFor(db, user);
  const visible = feed.slice(0, page * PAGE_SIZE);

  return (
    <Screen>
      {user ? (
        <>
          <View style={{ gap: 6 }}>
            <T variant="display">¡Hola, {user.name.split(' ')[0]}! 👋</T>
            <Row gap={6} style={{ flexWrap: 'wrap' }}>
              {user.roles.map((r) => (
                <Chip key={r} label={ROLE_LABEL[r]} tone={r === 'ADMIN' ? 'violet' : 'brand'} />
              ))}
            </Row>
          </View>
          <Row gap={8}>
            <Stat value={followingCount(db, user.id)} label="Siguiendo" />
            <Stat value={followersCount(db, user.id)} label="Seguidores" />
            <Stat value={db.saved.filter((s) => s.userId === user.id).length} label="Guardados" />
          </Row>
        </>
      ) : (
        <>
          <T variant="display">Explora Skucy</T>
          <Button title="Iniciar sesión" icon="log-in-outline" onPress={() => setGuest(false)} />
        </>
      )}

      <SectionHeader
        title={user ? 'Tu feed' : 'Contenido reciente'}
        count={feed.length}
        action="Explorar carreras"
        onAction={() => router.push('/explore')}
      />

      {visible.length === 0 ? (
        <EmptyState icon="film-outline" title="Aún no hay contenido" />
      ) : (
        visible.map((c) => <ContentCard key={c.id} content={c} />)
      )}
      <Pager shown={visible.length} total={feed.length} onMore={() => setPage((p) => p + 1)} />
    </Screen>
  );
}
