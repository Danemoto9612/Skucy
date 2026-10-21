// Administración del catálogo académico: instituciones → facultades → carreras → materias.
// Al comenzar vacío, el administrador crea aquí lo que los estudiantes verán al registrarse.
import { useState } from 'react';
import { View } from 'react-native';
import {
  createDegree,
  createFaculty,
  createInstitution,
  createSubject,
  deleteCatalogItem,
} from '../store/actions';
import { useDb } from '../store/store';
import { Button, Card, Chip, EmptyState, Input, Row, SectionHeader, T } from './components';
import { attempt } from './session';
import { colors } from './theme';

export function CatalogManager() {
  const db = useDb();
  const [institutionId, setInstitutionId] = useState('');
  const [facultyId, setFacultyId] = useState('');
  const [degreeId, setDegreeId] = useState('');

  const [iName, setIName] = useState('');
  const [iCity, setICity] = useState('');
  const [iCountry, setICountry] = useState('');
  const [iDomains, setIDomains] = useState('');
  const [fName, setFName] = useState('');
  const [dName, setDName] = useState('');
  const [dDescription, setDDescription] = useState('');
  const [dSemesters, setDSemesters] = useState('');
  const [sSemester, setSSemester] = useState('');
  const [sCode, setSCode] = useState('');
  const [sName, setSName] = useState('');
  const [sDescription, setSDescription] = useState('');
  const [sCredits, setSCredits] = useState('');

  const institution = db.institutions.find((i) => i.id === institutionId);
  const faculties = db.faculties.filter((f) => f.institutionId === institutionId);
  const faculty = faculties.find((f) => f.id === facultyId);
  const degrees = db.degrees.filter((d) => d.facultyId === facultyId);
  const degree = degrees.find((d) => d.id === degreeId);
  const subjects = db.subjects.filter((s) => s.degreeId === degreeId).sort((a, b) => a.semester - b.semester);

  const remove = (kind: 'institution' | 'faculty' | 'degree' | 'subject', id: string, after?: () => void) =>
    attempt(() => deleteCatalogItem(kind, id), after);

  return (
    <View style={{ gap: 14 }}>
      <SectionHeader title="Instituciones" count={db.institutions.length} />
      {db.institutions.length === 0 ? <EmptyState icon="business-outline" title="Sin instituciones" /> : null}
      <Row gap={6} style={{ flexWrap: 'wrap' }}>
        {db.institutions.map((i) => (
          <Chip
            key={i.id}
            label={i.name}
            selected={i.id === institutionId}
            onPress={() => {
              setInstitutionId(i.id);
              setFacultyId('');
              setDegreeId('');
            }}
          />
        ))}
      </Row>
      {institution ? (
        <Card style={{ gap: 4 }}>
          <T variant="label">{institution.name}</T>
          <T variant="caption" color={colors.muted}>
            {institution.city}, {institution.country} · {institution.domains.join(', ')}
          </T>
          <Button
            title="Eliminar institución"
            variant="ghost"
            icon="trash-outline"
            onPress={() => remove('institution', institution.id, () => setInstitutionId(''))}
          />
        </Card>
      ) : null}
      <Card style={{ gap: 10 }}>
        <T variant="h3">Nueva institución</T>
        <Input label="Nombre" value={iName} onChangeText={setIName} />
        <Input label="Ciudad" value={iCity} onChangeText={setICity} />
        <Input label="País" value={iCountry} onChangeText={setICountry} />
        <Input
          label="Dominios de correo (separados por coma)"
          value={iDomains}
          onChangeText={setIDomains}
          autoCapitalize="none"
        />
        <Button
          title="Crear institución"
          icon="add"
          onPress={() =>
            attempt(
              () => createInstitution({ name: iName, city: iCity, country: iCountry, domains: iDomains.split(',') }),
              (newId) => {
                setInstitutionId(newId);
                setFacultyId('');
                setDegreeId('');
                setIName('');
                setICity('');
                setICountry('');
                setIDomains('');
              },
            )
          }
        />
      </Card>

      {institution ? (
        <>
          <SectionHeader title="Facultades" count={faculties.length} />
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            {faculties.map((f) => (
              <Chip
                key={f.id}
                label={f.name}
                selected={f.id === facultyId}
                onPress={() => {
                  setFacultyId(f.id);
                  setDegreeId('');
                }}
              />
            ))}
          </Row>
          {faculty ? (
            <Button
              title={`Eliminar facultad: ${faculty.name}`}
              variant="ghost"
              icon="trash-outline"
              onPress={() => remove('faculty', faculty.id, () => setFacultyId(''))}
            />
          ) : null}
          <Card style={{ gap: 10 }}>
            <Input label="Nueva facultad" value={fName} onChangeText={setFName} />
            <Button
              title="Crear facultad"
              icon="add"
              onPress={() =>
                attempt(
                  () => createFaculty({ institutionId: institution.id, name: fName }),
                  (newId) => {
                    setFacultyId(newId);
                    setDegreeId('');
                    setFName('');
                  },
                )
              }
            />
          </Card>
        </>
      ) : null}

      {faculty ? (
        <>
          <SectionHeader title="Carreras" count={degrees.length} />
          <Row gap={6} style={{ flexWrap: 'wrap' }}>
            {degrees.map((d) => (
              <Chip key={d.id} label={d.name} selected={d.id === degreeId} onPress={() => setDegreeId(d.id)} />
            ))}
          </Row>
          {degree ? (
            <Button
              title={`Eliminar carrera: ${degree.name}`}
              variant="ghost"
              icon="trash-outline"
              onPress={() => remove('degree', degree.id, () => setDegreeId(''))}
            />
          ) : null}
          <Card style={{ gap: 10 }}>
            <Input label="Nombre de la carrera" value={dName} onChangeText={setDName} />
            <Input label="Descripción" value={dDescription} onChangeText={setDDescription} multiline />
            <Input label="Número de semestres" value={dSemesters} onChangeText={setDSemesters} keyboardType="number-pad" />
            <Button
              title="Crear carrera"
              icon="add"
              onPress={() =>
                attempt(
                  () =>
                    createDegree({
                      facultyId: faculty.id,
                      name: dName,
                      description: dDescription,
                      semesters: parseInt(dSemesters, 10),
                    }),
                  (newId) => {
                    setDegreeId(newId);
                    setDName('');
                    setDDescription('');
                    setDSemesters('');
                  },
                )
              }
            />
          </Card>
        </>
      ) : null}

      {degree ? (
        <>
          <SectionHeader title="Materias" count={subjects.length} />
          {subjects.map((s) => (
            <Card key={s.id} style={{ gap: 2 }}>
              <T variant="label">
                S{s.semester} · {s.code} · {s.name}
              </T>
              <Button
                title="Eliminar"
                variant="ghost"
                icon="trash-outline"
                onPress={() => remove('subject', s.id)}
              />
            </Card>
          ))}
          <Card style={{ gap: 10 }}>
            <Input label="Semestre" value={sSemester} onChangeText={setSSemester} keyboardType="number-pad" />
            <Input label="Código" value={sCode} onChangeText={setSCode} autoCapitalize="characters" />
            <Input label="Nombre de la materia" value={sName} onChangeText={setSName} />
            <Input label="Descripción" value={sDescription} onChangeText={setSDescription} multiline />
            <Input label="Créditos" value={sCredits} onChangeText={setSCredits} keyboardType="number-pad" />
            <Button
              title="Crear materia"
              icon="add"
              onPress={() =>
                attempt(
                  () =>
                    createSubject({
                      degreeId: degree.id,
                      semester: parseInt(sSemester, 10),
                      code: sCode,
                      name: sName,
                      description: sDescription,
                      credits: sCredits.trim() ? parseInt(sCredits, 10) : undefined,
                    }),
                  () => {
                    setSCode('');
                    setSName('');
                    setSDescription('');
                    setSCredits('');
                  },
                )
              }
            />
          </Card>
        </>
      ) : null}
    </View>
  );
}
