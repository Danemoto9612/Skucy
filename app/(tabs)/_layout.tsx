import { Ionicons } from '@expo/vector-icons';
import { router, Tabs } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { unreadCount } from '../../shared/selectors';
import { useDb } from '../../src/store/store';
import { useSession } from '../../src/ui/session';
import { colors, fonts } from '../../src/ui/theme';

function Bell() {
  const db = useDb();
  const { user } = useSession();
  const unread = unreadCount(db, user?.id);
  if (!user) return null;
  return (
    <Pressable onPress={() => router.push('/notifications')} style={{ marginRight: 16 }} hitSlop={8}>
      <Ionicons name="notifications-outline" size={24} color={colors.ink} />
      {unread > 0 ? (
        <View
          style={{
            position: 'absolute',
            right: -4,
            top: -4,
            minWidth: 16,
            height: 16,
            borderRadius: 8,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 3,
          }}
        >
          <Text style={{ color: colors.white, fontSize: 10, fontFamily: fonts.bold }}>{unread}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export default function TabsLayout() {
  const { can } = useSession();
  const showPanel = can('moderation:content') || can('admin:users');

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.canvas },
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: fonts.bold, color: colors.ink },
        headerRight: () => <Bell />,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.border },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Inicio',
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explorar',
          tabBarIcon: ({ color, size }) => <Ionicons name="library-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Buscar',
          tabBarIcon: ({ color, size }) => <Ionicons name="search-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="panel"
        options={{
          title: 'Panel',
          href: showPanel ? undefined : null,
          tabBarIcon: ({ color, size }) => <Ionicons name="shield-checkmark-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
