import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { CONTENT_TYPE_LABEL, type ContentType } from '../../shared/types';
import { institutionName, PAGE_SIZE, publicContents } from '../../shared/selectors';
import { useDb } from '../../src/store/store';
import { Banner, Card, Chip, EmptyState, Pager, Row, Screen, SectionHeader, T } from '../../src/ui/components';
import { ContentCard } from '../../src/ui/ContentCard';
import { colors } from '../../src/ui/theme';

export default function SubjectScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDb();
  const subject = db.subjects.find((s) => s.id === id);
  const [type, setType] = useState<ContentType | 'ALL'>('ALL');
  const [page, setPage] = useState(1);

  if (!subject) {
    return (
      <Screen>
        <Banner tone="danger" text="Materia no encontrada." />
      </Screen>
    );
  }
  const degree = db.degrees.find((d) => d.id === subject.degreeId);
  const all = publicContents(db).filter((c) => c.subjectId === subject.id);
  const filtered = type === 'ALL' ? all : all.filter((c) => c.type === type);
  const visible = filtered.slice(0, page * PAGE_SIZE);

  return (
    <Screen>
      <Stack.Screen options={{ title: subject.code }} />
      <T variant="h1">{subject.name}</T>
      <Card onPress={() => degree && router.push(`/degree/${degree.id}`)} style={{ gap: 2 }}>
        <T variant="label">{degree?.name}</T>
        <T variant="bodySm" color={colors.muted}>
          {degree ? institutionName(db, degree.institutionId) : ''} · Semestre {subject.semester} · {subject.credits ?? '-'} créditos
        </T>
      </Card>
      <T color={colors.charcoal}>{subject.description}</T>

      <Row gap={6} style={{ flexWrap: 'wrap' }}>
        <Chip label="Todos" selected={type === 'ALL'} onPress={() => { setType('ALL'); setPage(1); }} />
        {(Object.keys(CONTENT_TYPE_LABEL) as ContentType[]).map((t) => (
          <Chip key={t} label={CONTENT_TYPE_LABEL[t]} selected={type === t} onPress={() => { setType(t); setPage(1); }} />
        ))}
      </Row>

      <SectionHeader title="Contenido" count={filtered.length} />
      {visible.length === 0 ? (
        <EmptyState icon="film-outline" title="Sin contenido todavía" />
      ) : (
        visible.map((c) => <ContentCard key={c.id} content={c} />)
      )}
      <Pager shown={visible.length} total={filtered.length} onMore={() => setPage((p) => p + 1)} />
    </Screen>
  );
}
