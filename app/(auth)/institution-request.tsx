import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { showAlert } from '../../src/ui/alert';
import { submitInstitutionRequest } from '../../src/store/actions';
import { Button, Input, Screen, T } from '../../src/ui/components';
import { attempt } from '../../src/ui/session';
import { colors } from '../../src/ui/theme';

export default function InstitutionRequestScreen() {
  const { email, domain } = useLocalSearchParams<{ email: string; domain: string }>();
  const [requesterName, setRequesterName] = useState('');
  const [name, setName] = useState('');
  const [domainValue, setDomainValue] = useState(domain ?? '');
  const [country, setCountry] = useState('Colombia');
  const [city, setCity] = useState('');
  const [evidence, setEvidence] = useState('');

  return (
    <Screen>
      <T variant="h1">Tu institución aún no está en Skucy</T>
      <T color={colors.charcoal}>
        Envía una solicitud. Un moderador la revisará y, cuando se apruebe, podrás registrarte con tu correo {email}.
      </T>

      <Input label="Tu nombre" value={requesterName} onChangeText={setRequesterName} />
      <Input label="Nombre de la institución" value={name} onChangeText={setName} />
      <Input label="Dominio institucional" value={domainValue} onChangeText={setDomainValue} autoCapitalize="none" />
      <Input label="País" value={country} onChangeText={setCountry} />
      <Input label="Ciudad" value={city} onChangeText={setCity} />
      <Input
        label="Evidencia o referencia administrativa"
        value={evidence}
        onChangeText={setEvidence}
        multiline
      />
      <Button
        title="Enviar solicitud"
        icon="paper-plane-outline"
        onPress={() =>
          attempt(
            () =>
              submitInstitutionRequest({
                requesterEmail: email ?? '',
                requesterName,
                name,
                domain: domainValue,
                country,
                city,
                evidence,
              }),
            () =>
              showAlert('Solicitud enviada', 'Te avisaremos cuando sea revisada.', [
                { text: 'Entendido', onPress: () => router.back() },
              ]),
          )
        }
      />
    </Screen>
  );
}
