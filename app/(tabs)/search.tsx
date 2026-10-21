import { router } from 'expo-router';
import { useState } from 'react';
import { search, institutionName, isVerified } from '../../shared/selectors';
import { useDb } from '../../src/store/store';
import { Avatar, EmptyState, Input, ListItem, Screen, SectionHeader } from '../../src/ui/components';
import { ContentCard } from '../../src/ui/ContentCard';

export default function SearchScreen() {
  const db = useDb();
  const [q, setQ] = useState('');
  const r = search(db, q);
  const total =
    r.people.length + r.institutions.length + r.degrees.length + r.subjects.length + r.communities.length + r.contents.length;

  return (
    <Screen>
      <Input
        icon="search"
        value={q}
        onChangeText={setQ}
        placeholder="Buscar"
        autoCapitalize="none"
        returnKeyType="search"
      />

      {!q.trim() ? (
        <EmptyState icon="search-outline" title="Busca en Skucy" />
      ) : total === 0 ? (
        <EmptyState icon="sad-outline" title="Sin resultados" />
      ) : (
        <>
          {r.people.length > 0 && <SectionHeader title="Personas" count={r.people.length} />}
          {r.people.map((u) => (
            <ListItem
              key={u.id}
              title={u.name}
              subtitle={`@${u.handle} · ${institutionName(db, u.institutionId)}`}
              right={<Avatar name={u.name} uri={u.avatarUrl} size={36} verified={isVerified(db, u.id)} />}
              onPress={() => router.push(`/profile/${u.handle}`)}
            />
          ))}

          {r.institutions.length > 0 && <SectionHeader title="Instituciones" count={r.institutions.length} />}
          {r.institutions.map((i) => (
            <ListItem key={i.id} icon="business-outline" title={i.name} subtitle={`${i.city}, ${i.country}`} onPress={() => router.push('/explore')} />
          ))}

          {r.degrees.length > 0 && <SectionHeader title="Carreras" count={r.degrees.length} />}
          {r.degrees.map((d) => (
            <ListItem key={d.id} icon="school-outline" title={d.name} subtitle={institutionName(db, d.institutionId)} onPress={() => router.push(`/degree/${d.id}`)} />
          ))}

          {r.communities.length > 0 && <SectionHeader title="Comunidades" count={r.communities.length} />}
          {r.communities.map((c) => (
            <ListItem key={c.id} icon="people-outline" title={c.name} onPress={() => router.push(`/degree/${c.degreeId}`)} />
          ))}

          {r.subjects.length > 0 && <SectionHeader title="Materias" count={r.subjects.length} />}
          {r.subjects.map((s) => (
            <ListItem key={s.id} icon="book-outline" title={s.name} subtitle={`${s.code} · Semestre ${s.semester}`} onPress={() => router.push(`/subject/${s.id}`)} />
          ))}

          {r.contents.length > 0 && <SectionHeader title="Contenido" count={r.contents.length} />}
          {r.contents.map((c) => (
            <ContentCard key={c.id} content={c} />
          ))}
        </>
      )}
    </Screen>
  );
}
