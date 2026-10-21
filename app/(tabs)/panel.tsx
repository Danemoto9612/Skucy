import { router } from 'expo-router';
import { useDb } from '../../src/store/store';
import { Banner, Chip, ListItem, Row, Screen, T } from '../../src/ui/components';
import { useSession } from '../../src/ui/session';

export default function PanelScreen() {
  const db = useDb();
  const { can } = useSession();
  const pendingContent = db.contents.filter((c) => c.status === 'PENDING_REVIEW').length;
  const pendingCreators = db.applications.filter((a) => a.status === 'SUBMITTED' || a.status === 'UNDER_REVIEW').length;
  const openReports = db.reports.filter((r) => r.status === 'OPEN').length;
  const pendingInstitutions = db.institutionRequests.filter((r) => r.status === 'PENDING').length;

  if (!can('moderation:content') && !can('admin:users')) {
    return (
      <Screen>
        <Banner tone="danger" text="No tienes permisos para ver este panel." />
      </Screen>
    );
  }

  return (
    <Screen>
      <T variant="h1">Panel</T>
      {can('moderation:content') ? (
        <>
          <ListItem
            icon="shield-checkmark-outline"
            title="Panel de moderación"
            subtitle="Contenido, solicitudes de creator, reportes e instituciones"
            onPress={() => router.push('/moderation')}
          />
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            <Chip label={`${pendingContent} contenidos`} tone={pendingContent ? 'warning' : 'neutral'} />
            <Chip label={`${pendingCreators} creators`} tone={pendingCreators ? 'warning' : 'neutral'} />
            <Chip label={`${openReports} reportes`} tone={openReports ? 'danger' : 'neutral'} />
            <Chip label={`${pendingInstitutions} instituciones`} tone={pendingInstitutions ? 'warning' : 'neutral'} />
          </Row>
        </>
      ) : null}
      {can('admin:users') ? (
        <ListItem
          icon="settings-outline"
          title="Administración"
          subtitle="Usuarios, roles, verificación, umbrales y auditoría"
          onPress={() => router.push('/admin')}
        />
      ) : null}
    </Screen>
  );
}
