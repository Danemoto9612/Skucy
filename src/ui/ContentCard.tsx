import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image, View } from 'react-native';
import {
  CONTENT_STATUS_LABEL,
  CONTENT_TYPE_LABEL,
  VISIBILITY_LABEL,
  type Content,
} from '../../shared/types';
import { isVerified, subjectName, userById } from '../../shared/selectors';
import { useDb } from '../store/store';
import { Avatar, Card, Chip, Row, T } from './components';
import { colors, radius } from './theme';

const TYPE_ICON = {
  VIDEO: 'play-circle',
  ACTIVITY: 'flask',
  GUIDED_TASK: 'list',
  RESOURCE: 'document-text',
  TUTORING: 'chatbubbles',
} as const;

export function ContentCard({ content, showStatus }: { content: Content; showStatus?: boolean }) {
  const db = useDb();
  const creator = userById(db, content.creatorId);
  const statusTone =
    content.status === 'PUBLISHED' || content.status === 'APPROVED'
      ? 'success'
      : content.status === 'REJECTED' || content.status === 'REMOVED'
        ? 'danger'
        : 'warning';
  return (
    <Card onPress={() => router.push(`/content/${content.id}`)} style={{ gap: 10 }}>
      {content.thumbnailUrl ? (
        <View style={{ height: 150, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.tint }}>
          <Image source={{ uri: content.thumbnailUrl }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        </View>
      ) : null}
      <Row gap={12} style={{ alignItems: 'flex-start' }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: colors.wash,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={TYPE_ICON[content.type]} size={22} color={colors.primary} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T variant="h3" numberOfLines={2}>{content.title}</T>
          <T variant="bodySm" color={colors.muted} numberOfLines={1}>
            {subjectName(db, content.subjectId)} · Semestre {content.semester}
          </T>
        </View>
      </Row>
      <Row gap={6} style={{ flexWrap: 'wrap' }}>
        <Chip label={CONTENT_TYPE_LABEL[content.type]} />
        {content.visibility !== 'PUBLIC' ? (
          <Chip
            label={VISIBILITY_LABEL[content.visibility]}
            tone="violet"
            icon={content.visibility === 'PAID' ? 'lock-closed' : 'people'}
          />
        ) : null}
        {showStatus ? <Chip label={CONTENT_STATUS_LABEL[content.status]} tone={statusTone} /> : null}
      </Row>
      {creator ? (
        <Row gap={8}>
          <Avatar name={creator.name} uri={creator.avatarUrl} size={24} verified={isVerified(db, creator.id)} />
          <T variant="caption" color={colors.charcoal}>{creator.name}</T>
          <T variant="caption" color={colors.muted}>· {content.views} vistas</T>
        </Row>
      ) : null}
    </Card>
  );
}
