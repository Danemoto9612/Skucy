import { router } from 'expo-router';
import { canPublish, isCreatorSuspended } from '../../shared/selectors';
import { useDb } from '../../src/store/store';
import { Banner, Button, EmptyState, Screen } from '../../src/ui/components';
import { ContentCard } from '../../src/ui/ContentCard';
import { useSession } from '../../src/ui/session';

export default function MyContentScreen() {
  const db = useDb();
  const { user } = useSession();
  if (!user) return null;
  const mine = db.contents
    .filter((c) => c.creatorId === user.id)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const allowed = canPublish(db, user);

  return (
    <Screen>
      {isCreatorSuspended(db, user.id) ? (
        <Banner tone="danger" text="Tu cuenta de creator está suspendida: no puedes crear ni enviar contenido." />
      ) : null}
      <Button title="Nuevo contenido" icon="add" disabled={!allowed} onPress={() => router.push('/content/edit')} />
      {mine.length === 0 ? (
        <EmptyState icon="videocam-outline" title="Aún no tienes contenido" />
      ) : (
        mine.map((c) => <ContentCard key={c.id} content={c} showStatus />)
      )}
    </Screen>
  );
}
