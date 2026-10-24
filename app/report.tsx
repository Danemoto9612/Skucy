import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { showAlert } from '../src/ui/alert';
import type { ReportTarget } from '../shared/types';
import { createReport } from '../src/store/actions';
import { Button, Input, Screen, T } from '../src/ui/components';
import { attempt } from '../src/ui/session';

export default function ReportScreen() {
  const { type, id } = useLocalSearchParams<{ type: ReportTarget; id: string }>();
  const [reason, setReason] = useState('');

  return (
    <Screen>
      <T variant="h2">Reportar {type === 'USER' ? 'usuario' : 'contenido'}</T>
      <Input label="Motivo" value={reason} onChangeText={setReason} multiline />
      <Button
        title="Enviar reporte"
        icon="flag"
        onPress={() =>
          attempt(
            () => createReport(type ?? 'CONTENT', id ?? '', reason),
            () =>
              showAlert('Reporte enviado', 'Gracias por ayudar a mantener Skucy seguro.', [
                { text: 'Cerrar', onPress: () => router.back() },
              ]),
          )
        }
      />
    </Screen>
  );
}
