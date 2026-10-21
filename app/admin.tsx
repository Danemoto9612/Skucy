import { useState } from 'react';
import { ROLE_LABEL } from '../shared/permissions';
import {
  setAccountStatus,
  setUserRole,
  setVerification,
  softDeleteUser,
  updateSettings,
} from '../src/store/actions';
import { followersCount, isVerified, userById } from '../shared/selectors';
import { useDb } from '../src/store/store';
import { Banner, Button, Card, Chip, EmptyState, Input, ReasonActions, Row, Screen, Segmented, T } from '../src/ui/components';
import { attempt, useSession } from '../src/ui/session';
import { CatalogManager } from '../src/ui/CatalogManager';
import { colors } from '../src/ui/theme';

type Tab = 'users' | 'catalog' | 'settings' | 'audit';

export default function AdminScreen() {
  const db = useDb();
  const { user, can } = useSession();
  const [tab, setTab] = useState<Tab>('users');
  const [threshold, setThreshold] = useState(String(db.settings.verificationThreshold));
  const [minDays, setMinDays] = useState(String(db.settings.minFollowDaysToRate));

  if (!can('admin:users')) {
    return (
      <Screen>
        <Banner tone="danger" text="Solo los administradores pueden ver esta sección." />
      </Screen>
    );
  }

  const users = db.users.filter((u) => !u.deletedAt);

  return (
    <Screen>
      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { value: 'users', label: 'Usuarios' },
          { value: 'catalog', label: 'Catálogo' },
          { value: 'settings', label: 'Configuración' },
          { value: 'audit', label: 'Auditoría' },
        ]}
      />

      {tab === 'users'
        ? users.map((u) => {
            const isSelf = u.id === user?.id;
            return (
              <Card key={u.id} style={{ gap: 8 }}>
                <Row gap={8}>
                  <T variant="h3" style={{ flex: 1 }}>{u.name}</T>
                  <Chip label={u.status} tone={u.status === 'ACTIVE' ? 'success' : 'danger'} />
                </Row>
                <T variant="caption" color={colors.muted}>{u.email} · {followersCount(db, u.id)} seguidores</T>
                <Row gap={6} style={{ flexWrap: 'wrap' }}>
                  {u.roles.map((r) => (
                    <Chip key={r} label={ROLE_LABEL[r]} />
                  ))}
                  {isVerified(db, u.id) ? (
                    <Chip label={u.verifiedOverride === true ? 'Verificado (manual)' : 'Verificado'} tone="violet" icon="checkmark-circle" />
                  ) : null}
                </Row>
                {isSelf ? null : (
                  <ReasonActions
                    actions={[
                      u.status === 'ACTIVE'
                        ? { title: 'Suspender', variant: 'danger' as const, run: (r: string) => attempt(() => setAccountStatus(u.id, 'SUSPENDED', r)) }
                        : { title: 'Reactivar', run: (r: string) => attempt(() => setAccountStatus(u.id, 'ACTIVE', r)) },
                      { title: 'Banear', variant: 'danger' as const, run: (r: string) => attempt(() => setAccountStatus(u.id, 'BANNED', r)) },
                      { title: 'Dar verificación', run: (r: string) => attempt(() => setVerification(u.id, true, r)) },
                      { title: 'Quitar verificación', run: (r: string) => attempt(() => setVerification(u.id, false, r)) },
                      { title: 'Verificación automática', variant: 'outline' as const, run: (r: string) => attempt(() => setVerification(u.id, null, r)) },
                      u.roles.includes('MODERATOR')
                        ? { title: 'Quitar moderador', variant: 'outline' as const, run: (r: string) => attempt(() => setUserRole(u.id, 'MODERATOR', false, r)) }
                        : { title: 'Hacer moderador', variant: 'outline' as const, run: (r: string) => attempt(() => setUserRole(u.id, 'MODERATOR', true, r)) },
                      { title: 'Eliminar (lógico)', variant: 'danger' as const, run: (r: string) => attempt(() => softDeleteUser(u.id, r)) },
                    ]}
                  />
                )}
              </Card>
            );
          })
        : null}

      {tab === 'catalog' ? <CatalogManager /> : null}

      {tab === 'settings' ? (
        <Card style={{ gap: 12 }}>
          <Input
            label="Umbral de verificación (seguidores)"
            value={threshold}
            onChangeText={setThreshold}
            keyboardType="number-pad"
          />
          <Input
            label="Días mínimos siguiendo a un creator para calificarlo"
            value={minDays}
            onChangeText={setMinDays}
            keyboardType="number-pad"
          />
          <Button
            title="Guardar configuración"
            onPress={() =>
              attempt(() =>
                updateSettings({
                  verificationThreshold: parseInt(threshold, 10),
                  minFollowDaysToRate: parseInt(minDays, 10),
                }),
              )
            }
          />
        </Card>
      ) : null}

      {tab === 'audit' ? (
        db.audit.length === 0 ? (
          <EmptyState icon="list-outline" title="Sin registros" />
        ) : (
          db.audit.slice(0, 60).map((a) => (
            <Card key={a.id} style={{ gap: 3 }}>
              <T variant="label">{a.action}</T>
              <T variant="caption" color={colors.charcoal}>
                {userById(db, a.actorId)?.name ?? a.actorId} · {a.resource} {a.resourceId}
              </T>
              <T variant="caption" color={colors.muted}>
                {a.before} → {a.after} · {new Date(a.at).toLocaleString()}
              </T>
              {a.reason ? <T variant="caption" color={colors.muted}>Motivo: {a.reason}</T> : null}
            </Card>
          ))
        )
      ) : null}
    </Screen>
  );
}
