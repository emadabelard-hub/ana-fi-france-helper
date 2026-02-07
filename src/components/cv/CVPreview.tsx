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
  if (data.drivingLicense) headerInfoItems.push(`Permis ${data.drivingLicense}`);

  // Section Title Component - Bold text only
  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h2 
      className="text-sm font-bold uppercase tracking-wide mb-3"
      style={{ color: '#1e3a5f' }}
    >
      {children}
    </h2>
  );

  return (
    <div
      ref={ref}
      dir="ltr"
      lang="fr"
      className="bg-white text-slate-800 w-full max-w-[210mm] mx-auto shadow-lg"
      style={{
        fontFamily: "'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif",
        minHeight: '297mm',
        padding: '28px',
        boxSizing: 'border-box',
        overflowWrap: 'break-word',
        wordBreak: 'break-word',
      }}
    >
      {/* ========== HEADER - Perfectly Centered ========== */}
      <div className="text-center mb-4">
        {/* Line 1: Prénom NOM */}
        <h1 
          className="font-bold"
          style={{ 
            color: '#1e3a5f',
            fontSize: 'clamp(1.5rem, 6vw, 2rem)',
            lineHeight: '1.2',
            marginBottom: '4px',
          }}
        >
          {formattedName}
        </h1>
        
        {/* Line 2: Métier */}
        <p 
          className="font-medium"
          style={{ 
            color: '#475569',
            fontSize: 'clamp(0.95rem, 3.5vw, 1.125rem)',
            marginBottom: '6px',
          }}
        >
          {data.profession || 'Votre Métier'}
        </p>
        
        {/* Line 3: Age | Situation familiale | Permis */}
        {headerInfoItems.length > 0 && (
          <p 
            className="text-sm text-slate-500"
            style={{ fontSize: '0.875rem' }}
          >
            {headerInfoItems.join(' • ')}
          </p>
        )}
      </div>

      {/* ========== CONTACT BLOCK - Right Aligned ========== */}
      <div 
        className="flex justify-end mb-5 pb-4"
        style={{ borderBottom: '1px solid #e2e8f0' }}
      >
        <div className="text-right text-sm text-slate-600 space-y-1">
          {data.phone && (
            <p style={{ overflowWrap: 'break-word' }}>📞 {data.phone}</p>
          )}
          {data.email && (
            <p style={{ overflowWrap: 'break-word', wordBreak: 'break-all' }}>✉️ {data.email}</p>
          )}
          {data.address && (
            <p style={{ overflowWrap: 'break-word', maxWidth: '280px', marginLeft: 'auto' }}>📍 {data.address}</p>
          )}
        </div>
      </div>

      {/* ========== MAIN CONTENT RECTANGLE ========== */}
      <div 
        className="border rounded-md p-5"
        style={{ 
          borderColor: '#cbd5e1',
          backgroundColor: '#ffffff',
          minHeight: 'fit-content',
        }}
      >
        {/* Profile / Summary */}
        {data.summary && (
          <div className="mb-5">
            <SectionTitle>Profil</SectionTitle>
            <p 
              className="text-sm text-slate-600 leading-relaxed"
              style={{ textAlign: 'justify', textJustify: 'inter-word' }}
            >
              {data.summary}
            </p>
          </div>
        )}

        {/* Formation */}
        {data.education.length > 0 && (
          <div className="mb-5">
            <SectionTitle>Formation</SectionTitle>
            <div className="space-y-3">
              {data.education.map((edu, index) => (
                <div key={edu.id} className={index > 0 ? 'pt-2 border-t border-gray-100' : ''}>
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-sm text-slate-800">{edu.degree}</p>
                      <p className="text-sm text-slate-600">{edu.institution}</p>
                      {edu.field && <p className="text-xs text-slate-500">{edu.field}</p>}
                    </div>
                    <span className="text-xs text-slate-500 shrink-0 ml-2">
                      {edu.startDate} - {edu.endDate}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expériences Professionnelles */}
        {data.experiences.length > 0 && (
          <div className="mb-5">
            <SectionTitle>Expériences Professionnelles</SectionTitle>
            <div className="space-y-4">
              {data.experiences.map((exp, index) => (
                <div key={exp.id} className={index > 0 ? 'pt-3 border-t border-gray-100' : ''}>
                  <div className="flex justify-between items-start mb-1">
                    <p className="font-semibold text-sm text-slate-800">{exp.position}</p>
                    <span className="text-xs text-slate-500 shrink-0 ml-2">
                      {exp.startDate} - {exp.endDate || 'Présent'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mb-1">{exp.company}</p>
                  {exp.description && (
                    <p 
                      className="text-xs text-slate-500 leading-relaxed"
                      style={{ textAlign: 'justify', textJustify: 'inter-word' }}
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
          <div className="mb-5">
            <SectionTitle>Compétences</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {data.skills.map((skill, index) => (
                <span 
                  key={index} 
                  className="px-3 py-1 text-xs rounded-full border border-slate-300 text-slate-700 bg-slate-50"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Langues */}
        {data.languages.length > 0 && (
          <div className="mb-5">
            <SectionTitle>Langues</SectionTitle>
            <div className="space-y-1">
              {data.languages.map((lang) => (
                <div key={lang.id} className="flex justify-between text-sm">
                  <span className="font-medium text-slate-700">{lang.name}</span>
                  <span className="text-slate-500 text-xs">
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
            <div className="flex flex-wrap gap-2">
              {data.interests.map((interest, index) => (
                <span 
                  key={index} 
                  className="px-3 py-1 text-xs rounded-full border border-amber-300 text-amber-700 bg-amber-50"
                >
                  {interest}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
});

CVPreview.displayName = 'CVPreview';

export default CVPreview;
