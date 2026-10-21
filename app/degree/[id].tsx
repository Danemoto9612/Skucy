import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { toggleCommunity } from '../../src/store/actions';
import { institutionName, publicContents } from '../../shared/selectors';
import { useDb } from '../../src/store/store';
import { Banner, Button, Chip, EmptyState, ListItem, Row, Screen, SectionHeader, T } from '../../src/ui/components';
import { attempt, requireLogin, useSession } from '../../src/ui/session';
import { colors } from '../../src/ui/theme';

export default function DegreeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDb();
  const { user, can } = useSession();
  const degree = db.degrees.find((d) => d.id === id);
  const [semester, setSemester] = useState(1);

  if (!degree) {
    return (
      <Screen>
        <Banner tone="danger" text="Carrera no encontrada." />
      </Screen>
    );
  }

  const community = db.communities.find((c) => c.degreeId === degree.id);
  const joined = !!community && !!user?.communityIds.includes(community.id);
  const faculty = db.faculties.find((f) => f.id === degree.facultyId);
  const semesters = Array.from({ length: degree.semesters }, (_, i) => i + 1);
  const subjects = db.subjects.filter((s) => s.degreeId === degree.id && s.semester === semester && s.active);
  const contentCount = publicContents(db).filter((c) => c.degreeId === degree.id).length;

  return (
    <Screen>
      <Stack.Screen options={{ title: degree.name }} />
      <View style={{ gap: 4 }}>
        <T variant="h1">{degree.name}</T>
        <T variant="bodySm" color={colors.muted}>{institutionName(db, degree.institutionId)} · {faculty?.name}</T>
        <T color={colors.charcoal}>{degree.description}</T>
      </View>
      <Row gap={8}>
        <Chip label={`${degree.semesters} semestres`} />
        <Chip label={`${contentCount} contenidos`} tone="success" />
      </Row>
      {community && can('community:join') && user?.communityIds[0] !== community.id ? (
        <Button
          title={joined ? 'Dejar de seguir comunidad' : 'Seguir comunidad'}
          variant={joined ? 'outline' : 'primary'}
          icon={joined ? 'checkmark' : 'add'}
          onPress={() => attempt(() => toggleCommunity(community.id))}
        />
      ) : community && !user ? (
        <Button title="Inicia sesión para seguir la comunidad" variant="soft" onPress={() => requireLogin(user)} />
      ) : null}

      <SectionHeader title="Semestres" />
      <Row gap={8} style={{ flexWrap: 'wrap' }}>
        {semesters.map((n) => (
          <Chip key={n} label={`S${n}`} selected={n === semester} onPress={() => setSemester(n)} />
        ))}
      </Row>

      <SectionHeader title={`Materias · Semestre ${semester}`} count={subjects.length} />
      {subjects.length === 0 ? (
        <EmptyState icon="book-outline" title="Sin materias" />
      ) : (
        subjects.map((s) => {
          const n = publicContents(db).filter((c) => c.subjectId === s.id).length;
          return (
            <ListItem
              key={s.id}
              icon="book-outline"
              title={s.name}
              subtitle={`${s.code} · ${s.credits ?? '-'} créditos · ${n} contenidos`}
              onPress={() => router.push(`/subject/${s.id}`)}
            />
          );
        })
      )}
    </Screen>
  );
}
