import { Ionicons } from '@expo/vector-icons';
import { markAllNotificationsRead, markNotificationRead } from '../src/store/actions';
import { timeAgo } from '../shared/selectors';
import { useDb } from '../src/store/store';
import { Button, Card, EmptyState, Row, Screen, T } from '../src/ui/components';
import { attempt, useSession } from '../src/ui/session';
import { colors, useTheme } from '../src/ui/theme';

export default function NotificationsScreen() {
  useTheme();
  const db = useDb();
  const { user } = useSession();
  if (!user) return null;
  const items = db.notifications.filter((n) => n.userId === user.id);

  return (
    <Screen>
      {items.some((n) => !n.read) ? (
        <Button title="Marcar todas como leídas" variant="soft" small onPress={() => attempt(markAllNotificationsRead)} />
      ) : null}
      {items.length === 0 ? (
        <EmptyState icon="notifications-off-outline" title="Sin notificaciones" />
      ) : (
        items.map((n) => (
          <Card
            key={n.id}
            onPress={() => attempt(() => markNotificationRead(n.id))}
            style={{ gap: 4, borderColor: n.read ? colors.border : colors.accent }}
          >
            <Row gap={8}>
              <Ionicons name={n.read ? 'notifications-outline' : 'notifications'} size={18} color={colors.primary} />
              <T variant="label" style={{ flex: 1 }}>{n.title}</T>
              <T variant="caption" color={colors.muted}>{timeAgo(n.createdAt)}</T>
            </Row>
            <T variant="bodySm" color={colors.charcoal}>{n.body}</T>
          </Card>
        ))
      )}
    </Screen>
  );
}
