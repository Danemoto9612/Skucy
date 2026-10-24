import { router } from 'expo-router';
import { useState } from 'react';
import { hasRole } from '../shared/permissions';
import { APPLICATION_STATUS_LABEL } from '../shared/types';
import {
  moderateContent,
  reactivateCreator,
  resolveReport,
  reviewCreatorApplication,
  reviewInstitutionRequest,
  suspendCreator,
} from '../src/store/actions';
import { isCreatorSuspended, latestApplication, subjectName, timeAgo, userById } from '../shared/selectors';
import { useDb } from '../src/store/store';
import { Banner, Card, Chip, EmptyState, ReasonActions, Row, Screen, Segmented, T } from '../src/ui/components';
import { attempt, useSession } from '../src/ui/session';
import { colors, useTheme } from '../src/ui/theme';

type Tab = 'content' | 'creators' | 'reports' | 'institutions';

export default function ModerationScreen() {
  useTheme();
  const db = useDb();
  const { can } = useSession();
  const [tab, setTab] = useState<Tab>('content');

  if (!can('moderation:content')) {
    return (
      <Screen>
        <Banner tone="danger" text="No tienes permisos de moderación." />
      </Screen>
    );
  }

  const pendingContent = db.contents.filter((c) => c.status === 'PENDING_REVIEW');
  const applications = db.applications.filter((a) => a.status === 'SUBMITTED' || a.status === 'UNDER_REVIEW');
  const activeCreators = db.users.filter((u) => !u.deletedAt && hasRole(u, 'CREATOR') && !hasRole(u, 'ADMIN'));
  const openReports = db.reports.filter((r) => r.status === 'OPEN');
  const requests = db.institutionRequests.filter((r) => r.status === 'PENDING');

  return (
    <Screen>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'content', label: `Contenido ${pendingContent.length}` },
          { value: 'creators', label: `Creators ${applications.length}` },
          { value: 'reports', label: `Reportes ${openReports.length}` },
          { value: 'institutions', label: `Inst. ${requests.length}` },
        ]}
      />

      {tab === 'content' ? (
        pendingContent.length === 0 ? (
          <EmptyState icon="checkmark-done-outline" title="Nada pendiente" />
        ) : (
          pendingContent.map((c) => (
            <Card key={c.id} style={{ gap: 8 }}>
              <T variant="h3" onPress={() => router.push(`/content/${c.id}`)}>{c.title}</T>
              <T variant="bodySm" color={colors.muted}>
                {userById(db, c.creatorId)?.name} · {subjectName(db, c.subjectId)}
              </T>
              <T variant="bodySm" color={colors.charcoal}>{c.description}</T>
              <ReasonActions
                actions={[
                  { title: 'Aprobar', icon: 'checkmark', run: () => attempt(() => moderateContent(c.id, 'APPROVED')) },
                  { title: 'Rechazar', variant: 'danger', run: (r) => attempt(() => moderateContent(c.id, 'REJECTED', r)) },
                ]}
              />
            </Card>
          ))
        )
      ) : null}

      {tab === 'creators' ? (
        <>
          <T variant="h3">Solicitudes</T>
          {applications.length === 0 ? (
            <EmptyState icon="people-outline" title="Sin solicitudes pendientes" />
          ) : (
            applications.map((a) => {
              const applicant = userById(db, a.userId);
              return (
                <Card key={a.id} style={{ gap: 8 }}>
                  <Row gap={8}>
                    <T variant="h3" style={{ flex: 1 }} onPress={() => applicant && router.push(`/profile/${applicant.handle}`)}>
                      {applicant?.name}
                    </T>
                    <Chip label={APPLICATION_STATUS_LABEL[a.status]} tone="warning" />
                  </Row>
                  <T variant="bodySm" color={colors.charcoal}>Materias: {a.subjectsText}</T>
                  <T variant="bodySm" color={colors.charcoal}>Experiencia: {a.experience}</T>
                  {a.links ? <T variant="caption" color={colors.muted}>Enlaces: {a.links}</T> : null}
                  <T variant="caption" color={colors.muted}>Enviada {timeAgo(a.createdAt)}</T>
                  <ReasonActions
                    actions={[
                      { title: 'En revisión', run: () => attempt(() => reviewCreatorApplication(a.id, 'UNDER_REVIEW')) },
                      { title: 'Aprobar', icon: 'checkmark', run: (r) => attempt(() => reviewCreatorApplication(a.id, 'APPROVED', r)) },
                      { title: 'Rechazar', variant: 'danger', run: (r) => attempt(() => reviewCreatorApplication(a.id, 'REJECTED', r)) },
                    ]}
                  />
                </Card>
              );
            })
          )}

          <T variant="h3">Creators activos</T>
          {activeCreators.map((u) => {
            const suspended = isCreatorSuspended(db, u.id);
            const app = latestApplication(db, u.id);
            return (
              <Card key={u.id} style={{ gap: 8 }}>
                <Row gap={8}>
                  <T variant="label" style={{ flex: 1 }}>{u.name}</T>
                  <Chip label={suspended ? 'Suspendido' : 'Activo'} tone={suspended ? 'danger' : 'success'} />
                </Row>
                {app?.history.slice(-1).map((h, i) => (
                  <T key={i} variant="caption" color={colors.muted}>
                    Último evento: {APPLICATION_STATUS_LABEL[h.status]}{h.reason ? ` — ${h.reason}` : ''}
                  </T>
                ))}
                <ReasonActions
                  actions={[
                    suspended
                      ? { title: 'Reactivar', run: (r: string) => attempt(() => reactivateCreator(u.id, r)) }
                      : { title: 'Suspender', variant: 'danger' as const, run: (r: string) => attempt(() => suspendCreator(u.id, r)) },
                  ]}
                />
              </Card>
            );
          })}
        </>
      ) : null}

      {tab === 'reports' ? (
        openReports.length === 0 ? (
          <EmptyState icon="flag-outline" title="Sin reportes abiertos" />
        ) : (
          openReports.map((r) => {
            const content = r.targetType === 'CONTENT' ? db.contents.find((c) => c.id === r.targetId) : undefined;
            const target = r.targetType === 'USER' ? userById(db, r.targetId) : undefined;
            return (
              <Card key={r.id} style={{ gap: 8 }}>
                <Row gap={8}>
                  <Chip label={r.targetType === 'USER' ? 'Usuario' : 'Contenido'} tone="danger" />
                  <T variant="caption" color={colors.muted}>{timeAgo(r.createdAt)} · por {userById(db, r.reporterId)?.name}</T>
                </Row>
                <T
                  variant="label"
                  onPress={() => (content ? router.push(`/content/${content.id}`) : target && router.push(`/profile/${target.handle}`))}
                >
                  {content?.title ?? target?.name ?? 'Elemento eliminado'}
                </T>
                <T variant="bodySm" color={colors.charcoal}>{r.reason}</T>
                <ReasonActions
                  actions={[
                    { title: 'Resolver', icon: 'checkmark', run: (x) => attempt(() => resolveReport(r.id, 'RESOLVED', x)) },
                    { title: 'Descartar', variant: 'outline', run: (x) => attempt(() => resolveReport(r.id, 'DISMISSED', x)) },
                  ]}
                />
              </Card>
            );
          })
        )
      ) : null}

      {tab === 'institutions' ? (
        requests.length === 0 ? (
          <EmptyState icon="business-outline" title="Sin solicitudes de institución" />
        ) : (
          requests.map((r) => (
            <Card key={r.id} style={{ gap: 6 }}>
              <T variant="h3">{r.name}</T>
              <T variant="bodySm" color={colors.charcoal}>
                {r.domain} · {r.city}, {r.country}
              </T>
              <T variant="caption" color={colors.muted}>
                Solicita {r.requesterName} ({r.requesterEmail}) · {timeAgo(r.createdAt)}
              </T>
              <T variant="bodySm" color={colors.charcoal}>Evidencia: {r.evidence}</T>
              <ReasonActions
                actions={[
                  { title: 'Aprobar', icon: 'checkmark', run: (x) => attempt(() => reviewInstitutionRequest(r.id, true, x)) },
                  { title: 'Rechazar', variant: 'danger', run: (x) => attempt(() => reviewInstitutionRequest(r.id, false, x)) },
                ]}
              />
            </Card>
          ))
        )
      ) : null}
    </Screen>
  );
}
