import { useDb } from '../src/store/store';
import { EmptyState, Screen } from '../src/ui/components';
import { ContentCard } from '../src/ui/ContentCard';
import { useSession } from '../src/ui/session';

export default function SavedScreen() {
  const db = useDb();
  const { user } = useSession();
  if (!user) return null;
  const ids = new Set(db.saved.filter((s) => s.userId === user.id).map((s) => s.contentId));
  const items = db.contents.filter((c) => ids.has(c.id));

  return (
    <Screen>
      {items.length === 0 ? (
        <EmptyState icon="bookmark-outline" title="Nada guardado" />
      ) : (
        items.map((c) => <ContentCard key={c.id} content={c} />)
      )}
    </Screen>
  );
}
