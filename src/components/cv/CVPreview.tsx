import { forwardRef } from 'react';
import type { CVData } from '@/pages/CVGeneratorPage';

/**
 * Calculate age from birth date string (DD/MM/YYYY format)
 */
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

/**
 * Format name as: Prénom (normal) + NOM (MAJUSCULES)
 */
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

/**
 * CV Preview - Style "Gribelin"
 * - Thin gray frames on white background
 * - Perfectly centered header with Name (UPPERCASE), First name, Job
 * - Justified text (block alignment)
 * - Includes Permis & Centres d'intérêt sections
 */
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

  // Build the personal info line (Age • Situation • Permis)
  const personalInfoItems: string[] = [];
  if (age) personalInfoItems.push(age);
  if (data.maritalStatus) personalInfoItems.push(data.maritalStatus);
  if (data.drivingLicense) personalInfoItems.push(`Permis ${data.drivingLicense}`);

  // Section Title Component with thin gray underline
  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <div className="mb-3 mt-5">
      <h2 
        style={{ 
          fontSize: '0.75rem',
          fontWeight: '700',
          textTransform: 'uppercase',
          letterSpacing: '0.15em',
          color: '#374151',
          marginBottom: '6px',
        }}
      >
        {children}
      </h2>
      <div 
        style={{ 
          height: '1px', 
          backgroundColor: '#9ca3af',
          width: '100%',
        }} 
      />
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
      {/* ========== MAIN CONTENT - White with thin gray border ========== */}
      <div 
        style={{ 
          padding: '32px 28px',
          border: '1px solid #d1d5db',
          margin: '16px',
          minHeight: 'calc(297mm - 32px)',
          backgroundColor: '#ffffff',
        }}
      >
        
        {/* ========== HEADER - Perfectly Centered ========== */}
        <div className="text-center mb-6">
          {/* Name: Prénom NOM - Centered */}
          <h1 
            style={{ 
              fontSize: '1.75rem',
              lineHeight: '1.2',
              marginBottom: '4px',
              color: '#1f2937',
            }}
          >
            <span style={{ fontWeight: '400' }}>{firstName || 'Prénom'}</span>
            {(firstName && lastName) && ' '}
            <span style={{ fontWeight: '700' }}>{lastName || 'NOM'}</span>
          </h1>
          
          {/* Thin gray horizontal line */}
          <div 
            style={{ 
              height: '1px', 
              backgroundColor: '#9ca3af',
              width: '80px',
              margin: '10px auto',
            }} 
          />
          
          {/* Profession - Centered */}
          <p 
            style={{ 
              color: '#374151',
              fontSize: '1rem',
              fontWeight: '600',
              marginBottom: '8px',
              letterSpacing: '0.02em',
            }}
          >
            {data.profession || 'Votre Métier'}
          </p>
          
          {/* Age • Situation familiale • Permis */}
          {personalInfoItems.length > 0 && (
            <p 
              style={{ 
                fontSize: '0.8rem',
                color: '#6b7280',
                letterSpacing: '0.03em',
              }}
            >
              {personalInfoItems.join('  •  ')}
            </p>
          )}
        </div>

        {/* ========== CONTACT INFO - Centered ========== */}
        <div 
          className="text-center mb-6 pb-4"
          style={{ borderBottom: '1px solid #e5e7eb' }}
        >
          <div className="flex flex-col items-center gap-1" style={{ color: '#4b5563' }}>
            {data.phone && (
              <div className="flex items-center gap-2" style={{ fontSize: '0.8rem' }}>
                <span style={{ fontSize: '0.75rem' }}>📞</span>
                <span>{data.phone}</span>
              </div>
            )}
            {data.email && (
              <div className="flex items-center gap-2" style={{ fontSize: '0.8rem' }}>
                <span style={{ fontSize: '0.75rem' }}>✉️</span>
                <span>{data.email}</span>
              </div>
            )}
            {data.address && (
              <div className="flex items-center gap-2" style={{ fontSize: '0.8rem' }}>
                <span style={{ fontSize: '0.75rem' }}>📍</span>
                <span>{data.address}</span>
              </div>
            )}
          </div>
        </div>

        {/* ========== PROFILE / SUMMARY - Justified ========== */}
        {data.summary && (
          <div>
            <SectionTitle>Profil</SectionTitle>
            <p 
              style={{ 
                textAlign: 'justify', 
                textJustify: 'inter-word',
                fontSize: '0.85rem',
                lineHeight: '1.6',
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
            <div className="space-y-3">
              {data.education.map((edu, index) => (
                <div key={edu.id} className={index > 0 ? 'pt-2 border-t border-gray-100' : ''}>
                  <div className="flex justify-between items-start gap-3">
                    <div style={{ flex: 1 }}>
                      <p className="font-semibold" style={{ fontSize: '0.85rem', color: '#1f2937' }}>{edu.degree}</p>
                      <p style={{ fontSize: '0.8rem', color: '#6b7280' }}>{edu.institution}</p>
                      {edu.field && <p className="italic" style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{edu.field}</p>}
                    </div>
                    <span className="shrink-0" style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                      {edu.startDate} — {edu.endDate}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========== EXPÉRIENCES PROFESSIONNELLES ========== */}
        {data.experiences.length > 0 && (
          <div>
            <SectionTitle>Expériences Professionnelles</SectionTitle>
            <div className="space-y-4">
              {data.experiences.map((exp, index) => (
                <div key={exp.id} className={index > 0 ? 'pt-3 border-t border-gray-100' : ''}>
                  <div className="flex justify-between items-start gap-3 mb-1">
                    <p className="font-semibold" style={{ fontSize: '0.85rem', color: '#1f2937' }}>{exp.position}</p>
                    <span className="shrink-0" style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                      {exp.startDate} — {exp.endDate || 'Présent'}
                    </span>
                  </div>
                  <p className="mb-1" style={{ fontSize: '0.8rem', fontStyle: 'italic', color: '#6b7280' }}>{exp.company}</p>
                  {exp.description && (
                    <p 
                      style={{ 
                        textAlign: 'justify', 
                        textJustify: 'inter-word',
                        fontSize: '0.8rem',
                        lineHeight: '1.55',
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
                fontSize: '0.85rem',
                color: '#374151',
                lineHeight: '1.6',
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
            <div className="space-y-1">
              {data.languages.map((lang) => (
                <div key={lang.id} className="flex justify-between items-center">
                  <span className="font-medium" style={{ fontSize: '0.85rem', color: '#374151' }}>{lang.name}</span>
                  <span style={{ fontSize: '0.75rem', fontStyle: 'italic', color: '#9ca3af' }}>
                    {languageLevelMap[lang.level] || lang.level}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========== PERMIS DE CONDUIRE ========== */}
        {data.drivingLicense && (
          <div>
            <SectionTitle>Permis de Conduire</SectionTitle>
            <p style={{ fontSize: '0.85rem', color: '#374151' }}>
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
                fontSize: '0.85rem',
                color: '#374151',
                lineHeight: '1.6',
                textAlign: 'justify',
              }}
            >
              {data.interests.join('  •  ')}
            </p>
          </div>
        )}

        {/* ========== FOOTER ========== */}
        <div 
          className="text-center mt-8 pt-4"
          style={{ 
            borderTop: '1px solid #e5e7eb',
            fontSize: '0.65rem',
            color: '#9ca3af',
            letterSpacing: '0.05em',
          }}
        >
          Document réalisé avec Ana Fi Paris
        </div>
      </div>
    </div>
  );
});

CVPreview.displayName = 'CVPreview';

export default CVPreview;
