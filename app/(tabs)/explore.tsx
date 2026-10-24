import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { useDb } from '../../src/store/store';
import { Card, ListItem, Row, Screen, T } from '../../src/ui/components';
import { colors, useTheme } from '../../src/ui/theme';

export default function ExploreScreen() {
  useTheme();
  const db = useDb();
  const [open, setOpen] = useState<string | null>(db.institutions[0]?.id ?? null);

  return (
    <Screen>
      <T color={colors.charcoal}>
        Recorre institución → facultad → carrera → semestre → materia. El contenido de cualquier creator es visible desde
        cualquier carrera.
      </T>
      {db.institutions.map((inst) => {
        const expanded = open === inst.id;
        const faculties = db.faculties.filter((f) => f.institutionId === inst.id);
        return (
          <Card key={inst.id} style={{ gap: 12 }} onPress={() => setOpen(expanded ? null : inst.id)}>
            <Row gap={12}>
              <View style={{ flex: 1 }}>
                <T variant="h3">{inst.name}</T>
                <T variant="bodySm" color={colors.muted}>
                  {inst.city}, {inst.country} · {inst.domains.join(', ')}
                </T>
              </View>
              <T variant="label" color={colors.primary}>{expanded ? '−' : '+'}</T>
            </Row>
            {expanded
              ? faculties.map((f) => (
                  <View key={f.id} style={{ gap: 8 }}>
                    <T variant="labelSm" color={colors.primaryDeep}>{f.name.toUpperCase()}</T>
                    {db.degrees
                      .filter((d) => d.facultyId === f.id)
                      .map((d) => (
                        <ListItem
                          key={d.id}
                          icon="school-outline"
                          title={d.name}
                          subtitle={`${d.semesters} semestres · ${db.subjects.filter((s) => s.degreeId === d.id).length} materias`}
                          onPress={() => router.push(`/degree/${d.id}`)}
                        />
                      ))}
                  </View>
                ))
              : null}
          </Card>
        );
      })}
    </Screen>
  );
}
