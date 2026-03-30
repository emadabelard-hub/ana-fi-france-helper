import { forwardRef } from 'react';
import type { CVData } from '@/pages/CVGeneratorPage';

const ACCENT = '#3b4f6b'; // Bleu-gris anthracite discret

function calculateAge(birthDate: string): string {
  if (!birthDate) return '';
  const parts = birthDate.split('/');
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      const birthDateObj = new Date(year, month, day);
      const today = new Date();
      let age = today.getFullYear() - birthDateObj.getFullYear();
      const monthDiff = today.getMonth() - birthDateObj.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDateObj.getDate())) {
        age--;
      }
      return age > 0 ? `${age} ans` : '';
    }
  }
  return '';
}

function formatNameParts(fullName: string): { firstName: string; lastName: string } {
  if (!fullName || !fullName.trim()) return { firstName: '', lastName: '' };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: '', lastName: parts[0].toUpperCase() };
  }
  const lastName = parts[parts.length - 1].toUpperCase();
  const firstName = parts.slice(0, -1).map(p =>
    p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
  ).join(' ');
  return { firstName, lastName };
}

interface CVPreviewProps {
  data: CVData;
}

const CVPreview = forwardRef<HTMLDivElement, CVPreviewProps>(({ data }, ref) => {
  const languageLevelMap: Record<string, string> = {
    debutant: 'Débutant',
    intermediaire: 'Intermédiaire',
    avance: 'Avancé',
    bilingue: 'Bilingue',
    natif: 'Langue maternelle',
  };

  const { firstName, lastName } = formatNameParts(data.fullName);
  const age = calculateAge(data.birthDate);

  const personalInfoItems: string[] = [];
  if (age) personalInfoItems.push(age);
  if (data.maritalStatus) personalInfoItems.push(data.maritalStatus);
  if (data.drivingLicense) personalInfoItems.push(`Permis ${data.drivingLicense}`);

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <div className="mb-1" style={{ marginTop: '10px' }}>
      <h2
        style={{
          fontSize: '0.6rem',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: '0.18em',
          color: ACCENT,
          marginBottom: '3px',
        }}
      >
        {children}
      </h2>
      <div style={{ height: '1px', backgroundColor: ACCENT, width: '30px' }} />
    </div>
  );

  return (
    <div
      ref={ref}
      dir="ltr"
      lang="fr"
      className="bg-white text-gray-800 w-full max-w-[210mm] mx-auto"
      style={{
        fontFamily: "'Urbanist', 'Inter', 'Segoe UI', sans-serif",
        minHeight: '297mm',
        boxSizing: 'border-box',
        overflowWrap: 'break-word',
        wordBreak: 'break-word',
        backgroundColor: '#ffffff',
        border: '1px solid #e5e7eb',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      }}
    >
      <div
        style={{
          padding: '22px 22px',
          border: '1px solid #d1d5db',
          margin: '12px',
          minHeight: 'calc(297mm - 24px)',
          backgroundColor: '#ffffff',
        }}
      >
        {/* ========== HEADER ========== */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
          {/* Left: Name & profession */}
          <div style={{ flex: 1, textAlign: 'center', paddingRight: data.photoUrl ? '12px' : '0' }}>
            <h1
              style={{
                fontSize: '1.3rem',
                lineHeight: '1.15',
                marginBottom: '2px',
                color: '#1f2937',
              }}
            >
              <span style={{ fontWeight: '400' }}>{firstName || 'Prénom'}</span>
              {(firstName && lastName) && ' '}
              <span style={{ fontWeight: '700', letterSpacing: '0.04em' }}>{lastName || 'NOM'}</span>
            </h1>

            <div style={{ height: '1.5px', backgroundColor: ACCENT, width: '40px', margin: '5px auto' }} />

            <p
              style={{
                color: ACCENT,
                fontSize: '0.8rem',
                fontWeight: '600',
                marginBottom: '3px',
                letterSpacing: '0.03em',
              }}
            >
              {data.profession || 'Votre Métier'}
            </p>

            {personalInfoItems.length > 0 && (
              <p
                style={{
                  fontSize: '0.68rem',
                  color: '#6b7280',
                  letterSpacing: '0.03em',
                }}
              >
                {personalInfoItems.join('  •  ')}
              </p>
            )}
          </div>

          {/* Right: Photo (optional) */}
          {data.photoUrl && (
            <div style={{ flexShrink: 0 }}>
              <img
                src={data.photoUrl}
                alt="Photo"
                style={{
                  width: '58px',
                  height: '58px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  border: `1.5px solid ${ACCENT}`,
                }}
              />
            </div>
          )}
        </div>

        {/* ========== CONTACT INFO ========== */}
        <div
          className="text-center pb-2 mb-2"
          style={{ borderBottom: `1px solid #e5e7eb` }}
        >
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-0.5" style={{ color: '#4b5563' }}>
            {data.phone && (
              <span style={{ fontSize: '0.68rem' }}>📞 {data.phone}</span>
            )}
            {data.email && (
              <span style={{ fontSize: '0.68rem' }}>✉️ {data.email}</span>
            )}
            {data.address && (
              <span style={{ fontSize: '0.68rem' }}>📍 {data.address}</span>
            )}
          </div>
        </div>

        {/* ========== PROFIL ========== */}
        {data.summary && (
          <div>
            <SectionTitle>Profil</SectionTitle>
            <p
              style={{
                textAlign: 'justify',
                textJustify: 'inter-word',
                fontSize: '0.72rem',
                lineHeight: '1.4',
                color: '#374151',
              }}
            >
              {data.summary}
            </p>
          </div>
        )}

        {/* ========== FORMATION ========== */}
        {data.education.length > 0 && (
          <div>
            <SectionTitle>Formation</SectionTitle>
            <div className="space-y-1">
              {data.education.map((edu, index) => (
                <div key={edu.id} className={index > 0 ? 'pt-1 border-t border-gray-100' : ''}>
                  <div className="flex justify-between items-start gap-2">
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '0.72rem', fontWeight: '600', color: '#1f2937' }}>{edu.degree}</p>
                      <p style={{ fontSize: '0.68rem', color: '#6b7280' }}>{edu.institution}</p>
                      {edu.field && <p style={{ fontSize: '0.63rem', color: '#9ca3af', fontStyle: 'italic' }}>{edu.field}</p>}
                    </div>
                    <span style={{ fontSize: '0.63rem', color: ACCENT, fontWeight: '500', whiteSpace: 'nowrap' }}>
                      {edu.startDate} — {edu.endDate}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========== EXPÉRIENCES ========== */}
        {data.experiences.length > 0 && (
          <div>
            <SectionTitle>Expériences Professionnelles</SectionTitle>
            <div className="space-y-1.5">
              {data.experiences.map((exp, index) => (
                <div key={exp.id} className={index > 0 ? 'pt-1 border-t border-gray-100' : ''}>
                  <div className="flex justify-between items-start gap-2 mb-0">
                    <p style={{ fontSize: '0.72rem', fontWeight: '600', color: '#1f2937' }}>{exp.position}</p>
                    <span style={{ fontSize: '0.63rem', color: ACCENT, fontWeight: '500', whiteSpace: 'nowrap' }}>
                      {exp.startDate} — {exp.endDate || 'Présent'}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.68rem', fontStyle: 'italic', color: '#6b7280', marginBottom: '1px' }}>{exp.company}</p>
                  {exp.description && (
                    <p
                      style={{
                        textAlign: 'justify',
                        textJustify: 'inter-word',
                        fontSize: '0.68rem',
                        lineHeight: '1.4',
                        color: '#4b5563',
                      }}
                    >
                      {exp.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========== COMPÉTENCES ========== */}
        {data.skills.length > 0 && (
          <div>
            <SectionTitle>Compétences</SectionTitle>
            <p
              style={{
                fontSize: '0.72rem',
                color: '#374151',
                lineHeight: '1.4',
                textAlign: 'justify',
              }}
            >
              {data.skills.join('  •  ')}
            </p>
          </div>
        )}

        {/* ========== LANGUES ========== */}
        {data.languages.length > 0 && (
          <div>
            <SectionTitle>Langues</SectionTitle>
            <div className="space-y-0.5">
              {data.languages.map((lang) => (
                <div key={lang.id} className="flex justify-between items-center">
                  <span style={{ fontSize: '0.72rem', fontWeight: '500', color: '#374151' }}>{lang.name}</span>
                  <span style={{ fontSize: '0.63rem', fontStyle: 'italic', color: ACCENT }}>
                    {languageLevelMap[lang.level] || lang.level}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========== PERMIS ========== */}
        {data.drivingLicense && (
          <div>
            <SectionTitle>Permis de Conduire</SectionTitle>
            <p style={{ fontSize: '0.72rem', color: '#374151' }}>
              Permis {data.drivingLicense}
            </p>
          </div>
        )}

        {/* ========== CENTRES D'INTÉRÊT ========== */}
        {data.interests && data.interests.length > 0 && (
          <div>
            <SectionTitle>Centres d'Intérêt</SectionTitle>
            <p
              style={{
                fontSize: '0.72rem',
                color: '#374151',
                lineHeight: '1.4',
                textAlign: 'justify',
              }}
            >
              {data.interests.join('  •  ')}
            </p>
          </div>
        )}

        {/* ========== FOOTER SPACER ========== */}
        <div className="mt-3" />
      </div>
    </div>
  );
});

CVPreview.displayName = 'CVPreview';

export default CVPreview;
