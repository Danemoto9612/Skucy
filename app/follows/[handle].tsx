import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { institutionName, isVerified, userByHandle, userById } from '../../shared/selectors';
import { useDb } from '../../src/store/store';
import { Avatar, Banner, EmptyState, ListItem, Screen, Segmented } from '../../src/ui/components';

export default function FollowsScreen() {
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const db = useDb();
  const profile = userByHandle(db, handle ?? '');
  const [tab, setTab] = useState<'followers' | 'following'>('followers');

  if (!profile) {
    return (
      <Screen>
        <Banner tone="danger" text="Perfil no encontrado." />
      </Screen>
    );
  }

  const ids =
    tab === 'followers'
      ? db.follows.filter((f) => f.followingId === profile.id).map((f) => f.followerId)
      : db.follows.filter((f) => f.followerId === profile.id).map((f) => f.followingId);
  const people = ids.map((id) => userById(db, id)).filter((u): u is NonNullable<typeof u> => !!u);

  return (
    <Screen>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'followers', label: 'Seguidores' },
          { value: 'following', label: 'Siguiendo' },
        ]}
      />
      {people.length === 0 ? (
        <EmptyState icon="people-outline" title="Nadie por aquí todavía" />
      ) : (
        people.map((u) => (
          <ListItem
            key={u.id}
            title={u.name}
            subtitle={`@${u.handle} · ${institutionName(db, u.institutionId)}`}
            right={<Avatar name={u.name} uri={u.avatarUrl} size={36} verified={isVerified(db, u.id)} />}
            onPress={() => router.push(`/profile/${u.handle}`)}
          />
        ))
      )}
    </Screen>
  );
}
