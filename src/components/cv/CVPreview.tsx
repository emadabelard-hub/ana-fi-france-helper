import { forwardRef } from 'react';
import { formatFullName } from '@/lib/nameFormatter';
import type { CVData } from '@/pages/CVGeneratorPage';

interface CVPreviewProps {
  data: CVData;
}

/**
 * Calculate age from birth date string (DD/MM/YYYY format)
 */
function calculateAge(birthDate: string): string {
  if (!birthDate) return '';
  
  // Try to parse DD/MM/YYYY format
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

const CVPreview = forwardRef<HTMLDivElement, CVPreviewProps>(({ data }, ref) => {
  const languageLevelMap: Record<string, string> = {
    debutant: 'Débutant',
    intermediaire: 'Intermédiaire',
    avance: 'Avancé',
    bilingue: 'Bilingue',
    natif: 'Langue maternelle',
  };

  const formattedName = formatFullName(data.fullName) || 'Votre Nom';
  const age = calculateAge(data.birthDate);

  // Build the third header line items
  const headerInfoItems: string[] = [];
  if (age) headerInfoItems.push(age);
  if (data.maritalStatus) headerInfoItems.push(data.maritalStatus);
  if (data.drivingLicense) headerInfoItems.push(data.drivingLicense);

  // Section Title Component - Prestige style: Bold uppercase navy blue with fine underline
  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <div className="mb-2">
      <h2 
        className="text-xs font-bold uppercase tracking-wider mb-1"
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
        padding: '24px 28px',
        boxSizing: 'border-box',
        overflowWrap: 'break-word',
        wordBreak: 'break-word',
        backgroundColor: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ========== HEADER - Perfectly Centered ========== */}
      <div className="text-center mb-4">
        {/* Line 1: Prénom NOM */}
        <h1 
          className="font-semibold"
          style={{ 
            color: '#1a365d',
            fontSize: 'clamp(1.4rem, 5vw, 1.75rem)',
            lineHeight: '1.2',
            marginBottom: '4px',
            letterSpacing: '0.04em',
          }}
        >
          {formattedName}
        </h1>
        
        {/* Line 2: Métier */}
        <p 
          className="font-medium"
          style={{ 
            color: '#1a365d',
            fontSize: 'clamp(0.85rem, 3.5vw, 1rem)',
            marginBottom: '4px',
            fontStyle: 'italic',
            letterSpacing: '0.02em',
          }}
        >
          {data.profession || 'Votre Métier'}
        </p>
        
        {/* Line 3: Age • Situation familiale • Permis */}
        {headerInfoItems.length > 0 && (
          <p 
            style={{ 
              fontSize: '0.75rem',
              color: '#1a365d',
              letterSpacing: '0.03em',
            }}
          >
            {headerInfoItems.join('  •  ')}
          </p>
        )}
      </div>

      {/* ========== CONTACT BLOCK - Left Aligned ========== */}
      <div 
        className="flex justify-start mb-4 pb-3"
        style={{ borderBottom: '1px solid #1a365d' }}
      >
        <div className="text-left space-y-1" style={{ color: '#1a365d' }}>
          {data.phone && (
            <div className="flex items-center gap-2" style={{ fontSize: '0.8rem' }}>
              <span style={{ fontSize: '0.7rem' }}>✆</span>
              <span>{data.phone}</span>
            </div>
          )}
          {data.email && (
            <div className="flex items-center gap-2" style={{ fontSize: '0.8rem' }}>
              <span style={{ fontSize: '0.7rem' }}>✉</span>
              <span style={{ wordBreak: 'break-all' }}>{data.email}</span>
            </div>
          )}
          {data.address && (
            <div className="flex items-start gap-2" style={{ fontSize: '0.8rem' }}>
              <span style={{ fontSize: '0.7rem', marginTop: '1px' }}>⌂</span>
              <span style={{ maxWidth: '280px' }}>{data.address}</span>
            </div>
          )}
        </div>
      </div>

      {/* ========== MAIN CONTENT RECTANGLE - Navy Border ========== */}
      <div 
        style={{ 
          border: '1.5px solid #1a365d',
          backgroundColor: '#ffffff',
          minHeight: 'fit-content',
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
                lineHeight: '1.5',
                color: '#1a365d',
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
                <div key={edu.id} className={index > 0 ? 'pt-2 border-t' : ''} style={{ borderColor: '#1a365d20' }}>
                  <div className="flex justify-between items-start gap-3">
                    <div style={{ flex: 1 }}>
                      <p className="font-semibold" style={{ fontSize: '0.8rem', color: '#1a365d' }}>{edu.degree}</p>
                      <p style={{ fontSize: '0.75rem', color: '#1a365d' }}>{edu.institution}</p>
                      {edu.field && <p className="italic" style={{ fontSize: '0.7rem', color: '#1a365d' }}>{edu.field}</p>}
                    </div>
                    <span className="shrink-0" style={{ fontSize: '0.7rem', color: '#1a365d' }}>
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
                <div key={exp.id} className={index > 0 ? 'pt-2 border-t' : ''} style={{ borderColor: '#1a365d20' }}>
                  <div className="flex justify-between items-start gap-3 mb-0.5">
                    <p className="font-semibold" style={{ fontSize: '0.8rem', color: '#1a365d' }}>{exp.position}</p>
                    <span className="shrink-0" style={{ fontSize: '0.7rem', color: '#1a365d' }}>
                      {exp.startDate} — {exp.endDate || 'Présent'}
                    </span>
                  </div>
                  <p className="mb-1" style={{ fontSize: '0.75rem', fontStyle: 'italic', color: '#1a365d' }}>{exp.company}</p>
                  {exp.description && (
                    <p 
                      style={{ 
                        textAlign: 'justify', 
                        textJustify: 'inter-word',
                        fontSize: '0.75rem',
                        lineHeight: '1.45',
                        color: '#1a365d',
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

        {/* Compétences - Simple list, no bubbles */}
        {data.skills.length > 0 && (
          <div className="mb-4">
            <SectionTitle>Compétences</SectionTitle>
            <p 
              style={{
                fontSize: '0.8rem',
                color: '#1a365d',
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
                  <span className="font-medium" style={{ fontSize: '0.8rem', color: '#1a365d' }}>{lang.name}</span>
                  <span style={{ fontSize: '0.7rem', fontStyle: 'italic', color: '#1a365d' }}>
                    {languageLevelMap[lang.level] || lang.level}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Centres d'intérêt - Simple list, no bubbles */}
        {data.interests && data.interests.length > 0 && (
          <div>
            <SectionTitle>Centres d'intérêt</SectionTitle>
            <p 
              style={{
                fontSize: '0.8rem',
                color: '#1a365d',
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
          color: '#1a365d',
          opacity: 0.6,
          letterSpacing: '0.05em',
        }}
      >
        Document réalisé avec Ana Fi Paris
      </div>
    </div>
  );
});

CVPreview.displayName = 'CVPreview';

export default CVPreview;
