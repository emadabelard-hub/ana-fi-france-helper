import { forwardRef } from 'react';
import type { CVData } from '@/pages/CVGeneratorPage';
import { Settings } from 'lucide-react';

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
 * Format name as: Prénom (normal) + NOM (bold)
 */
function formatNameParts(fullName: string): { firstName: string; lastName: string } {
  if (!fullName || !fullName.trim()) return { firstName: '', lastName: '' };
  
  const parts = fullName.trim().split(/\s+/);
  
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
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

  // Build the personal info line
  const personalInfoItems: string[] = [];
  if (age) personalInfoItems.push(age);
  if (data.maritalStatus) personalInfoItems.push(data.maritalStatus);
  if (data.drivingLicense) personalInfoItems.push(data.drivingLicense);

  // Section Title Component
  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <div className="mb-2">
      <h2 
        className="text-xs font-bold uppercase tracking-wider"
        style={{ 
          color: '#1a365d',
          letterSpacing: '0.1em',
        }}
      >
        {children}
      </h2>
      <div 
        style={{ 
          height: '1px', 
          backgroundColor: '#1a365d',
          width: '100%',
          marginTop: '4px',
        }} 
      />
    </div>
  );

  return (
    <div
      ref={ref}
      dir="ltr"
      lang="fr"
      className="bg-white text-slate-800 w-full max-w-[210mm] mx-auto shadow-lg"
      style={{
        fontFamily: "'Urbanist', 'Inter', 'Segoe UI', sans-serif",
        minHeight: '297mm',
        boxSizing: 'border-box',
        overflowWrap: 'break-word',
        wordBreak: 'break-word',
        backgroundColor: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ========== TOP BAR - Dark Blue ========== */}
      <div 
        style={{ 
          backgroundColor: '#0f172a',
          padding: '10px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span 
          style={{ 
            color: '#ffffff',
            fontWeight: '600',
            fontSize: '0.85rem',
            letterSpacing: '0.15em',
          }}
        >
          ANA FI PARIS
        </span>
        <Settings 
          size={18} 
          color="#ffffff" 
          strokeWidth={1.5}
        />
      </div>

      {/* ========== MAIN CONTENT AREA ========== */}
      <div style={{ padding: '24px 28px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        
        {/* ========== HEADER - Perfectly Centered ========== */}
        <div className="text-center mb-4">
          {/* Name: Prénom NOM */}
          <h1 
            style={{ 
              fontSize: 'clamp(1.6rem, 5vw, 2rem)',
              lineHeight: '1.2',
              marginBottom: '8px',
              color: '#1a365d',
            }}
          >
            <span style={{ fontWeight: '300' }}>{firstName || 'Prénom'}</span>
            {' '}
            <span style={{ fontWeight: '700' }}>{lastName || 'NOM'}</span>
          </h1>
          
          {/* Blue horizontal line */}
          <div 
            style={{ 
              height: '2px', 
              backgroundColor: '#1a365d',
              width: '60px',
              margin: '0 auto 12px auto',
            }} 
          />
          
          {/* Profession */}
          <p 
            style={{ 
              color: '#1a365d',
              fontSize: '1rem',
              fontWeight: '500',
              marginBottom: '6px',
              letterSpacing: '0.02em',
            }}
          >
            {data.profession || 'Votre Métier'}
          </p>
          
          {/* Age • Marital Status • Driving License */}
          {personalInfoItems.length > 0 && (
            <p 
              style={{ 
                fontSize: '0.8rem',
                color: '#475569',
                letterSpacing: '0.03em',
              }}
            >
              {personalInfoItems.join('  •  ')}
            </p>
          )}
        </div>

        {/* ========== CONTACT INFO - Centered ========== */}
        <div 
          className="text-center mb-5 pb-4"
          style={{ borderBottom: '1px solid #e2e8f0' }}
        >
          <div className="flex flex-col items-center gap-1" style={{ color: '#334155' }}>
            {data.phone && (
              <div className="flex items-center gap-2" style={{ fontSize: '0.8rem' }}>
                <span style={{ fontSize: '0.7rem' }}>✆</span>
                <span>{data.phone}</span>
              </div>
            )}
            {data.email && (
              <div className="flex items-center gap-2" style={{ fontSize: '0.8rem' }}>
                <span style={{ fontSize: '0.7rem' }}>✉</span>
                <span>{data.email}</span>
              </div>
            )}
            {data.address && (
              <div className="flex items-center gap-2" style={{ fontSize: '0.8rem' }}>
                <span style={{ fontSize: '0.7rem' }}>⌂</span>
                <span>{data.address}</span>
              </div>
            )}
          </div>
        </div>

        {/* ========== MAIN CONTENT RECTANGLE - Navy Border ========== */}
        <div 
          style={{ 
            border: '1.5px solid #1a365d',
            backgroundColor: '#ffffff',
            padding: '20px 24px',
            flex: 1,
          }}
        >
          {/* Profile / Summary */}
          {data.summary && (
            <div className="mb-4">
              <SectionTitle>Profil</SectionTitle>
              <p 
                style={{ 
                  textAlign: 'justify', 
                  textJustify: 'inter-word',
                  fontSize: '0.8rem',
                  lineHeight: '1.55',
                  color: '#1e293b',
                }}
              >
                {data.summary}
              </p>
            </div>
          )}

          {/* Formation */}
          {data.education.length > 0 && (
            <div className="mb-4">
              <SectionTitle>Formation</SectionTitle>
              <div className="space-y-2">
                {data.education.map((edu, index) => (
                  <div key={edu.id} className={index > 0 ? 'pt-2 border-t border-slate-100' : ''}>
                    <div className="flex justify-between items-start gap-3">
                      <div style={{ flex: 1 }}>
                        <p className="font-semibold" style={{ fontSize: '0.8rem', color: '#1e293b' }}>{edu.degree}</p>
                        <p style={{ fontSize: '0.75rem', color: '#475569' }}>{edu.institution}</p>
                        {edu.field && <p className="italic" style={{ fontSize: '0.7rem', color: '#64748b' }}>{edu.field}</p>}
                      </div>
                      <span className="shrink-0" style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        {edu.startDate} — {edu.endDate}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expériences Professionnelles */}
          {data.experiences.length > 0 && (
            <div className="mb-4">
              <SectionTitle>Expériences Professionnelles</SectionTitle>
              <div className="space-y-3">
                {data.experiences.map((exp, index) => (
                  <div key={exp.id} className={index > 0 ? 'pt-2 border-t border-slate-100' : ''}>
                    <div className="flex justify-between items-start gap-3 mb-0.5">
                      <p className="font-semibold" style={{ fontSize: '0.8rem', color: '#1e293b' }}>{exp.position}</p>
                      <span className="shrink-0" style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        {exp.startDate} — {exp.endDate || 'Présent'}
                      </span>
                    </div>
                    <p className="mb-1" style={{ fontSize: '0.75rem', fontStyle: 'italic', color: '#475569' }}>{exp.company}</p>
                    {exp.description && (
                      <p 
                        style={{ 
                          textAlign: 'justify', 
                          textJustify: 'inter-word',
                          fontSize: '0.75rem',
                          lineHeight: '1.5',
                          color: '#334155',
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

          {/* Compétences */}
          {data.skills.length > 0 && (
            <div className="mb-4">
              <SectionTitle>Compétences</SectionTitle>
              <p 
                style={{
                  fontSize: '0.8rem',
                  color: '#1e293b',
                  lineHeight: '1.6',
                }}
              >
                {data.skills.join('  •  ')}
              </p>
            </div>
          )}

          {/* Langues */}
          {data.languages.length > 0 && (
            <div className="mb-4">
              <SectionTitle>Langues</SectionTitle>
              <div className="space-y-1">
                {data.languages.map((lang) => (
                  <div key={lang.id} className="flex justify-between items-center">
                    <span className="font-medium" style={{ fontSize: '0.8rem', color: '#1e293b' }}>{lang.name}</span>
                    <span style={{ fontSize: '0.7rem', fontStyle: 'italic', color: '#64748b' }}>
                      {languageLevelMap[lang.level] || lang.level}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Centres d'intérêt */}
          {data.interests && data.interests.length > 0 && (
            <div>
              <SectionTitle>Centres d'intérêt</SectionTitle>
              <p 
                style={{
                  fontSize: '0.8rem',
                  color: '#1e293b',
                  lineHeight: '1.6',
                }}
              >
                {data.interests.join('  •  ')}
              </p>
            </div>
          )}
        </div>

        {/* ========== FOOTER ========== */}
        <div 
          className="text-center mt-4 pt-2"
          style={{ 
            fontSize: '0.65rem',
            color: '#94a3b8',
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
