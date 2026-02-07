import { forwardRef } from 'react';
import { Mail, Phone, MapPin, Calendar, Car } from 'lucide-react';
import { formatFullName } from '@/lib/nameFormatter';
import type { CVData } from '@/pages/CVGeneratorPage';

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

  const formattedName = formatFullName(data.fullName) || 'Votre Nom';

  // Section Title Component - Gribelin style with blue bar on left
  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <div className="flex items-center gap-3 mb-4">
      <div 
        className="w-1 h-6 rounded-full"
        style={{ backgroundColor: '#2563eb' }}
      />
      <h2 
        className="text-base font-bold uppercase tracking-wide"
        style={{ color: '#2563eb' }}
      >
        {children}
      </h2>
    </div>
  );

  // Section Container - Gribelin style with thin gray border, flexible height
  const SectionBox = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div 
      className={`border border-gray-300 rounded-md p-4 ${className}`}
      style={{ 
        backgroundColor: '#ffffff',
        minHeight: 'fit-content',
        height: 'auto',
        overflow: 'visible',
      }}
    >
      {children}
    </div>
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
        padding: '24px',
        boxSizing: 'border-box',
        overflowWrap: 'break-word',
        wordBreak: 'break-word',
      }}
    >
      {/* Header - Perfectly Centered with responsive sizing */}
      <div className="text-center mb-6 pb-4 border-b-2 border-gray-200">
        <h1 
          className="font-bold mb-1"
          style={{ 
            color: '#1e3a5f',
            fontSize: 'clamp(1.25rem, 5vw, 1.875rem)',
            lineHeight: '1.2',
            overflowWrap: 'break-word',
            wordBreak: 'break-word',
          }}
        >
          {formattedName}
        </h1>
        <p 
          className="font-medium"
          style={{ 
            color: '#2563eb',
            fontSize: 'clamp(0.875rem, 3vw, 1.125rem)',
            overflowWrap: 'break-word',
            wordBreak: 'break-word',
          }}
        >
          {data.profession || 'Votre Métier'}
        </p>
      </div>

      {/* Two Column Layout - Flexible */}
      <div className="flex gap-5" style={{ width: '100%', maxWidth: '100%' }}>
        {/* Left Column - Contact & Skills */}
        <div style={{ width: '35%', minWidth: 0, maxWidth: '35%' }} className="space-y-4">
          {/* Contact Info */}
          <SectionBox>
            <SectionTitle>Contact</SectionTitle>
            <div className="space-y-2 text-sm text-slate-700" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
              {data.email && (
                <div className="flex items-start gap-2" style={{ minWidth: 0 }}>
                  <Mail className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" />
                  <span style={{ overflowWrap: 'break-word', wordBreak: 'break-all', minWidth: 0, maxWidth: '100%' }}>{data.email}</span>
                </div>
              )}
              {data.phone && (
                <div className="flex items-start gap-2" style={{ minWidth: 0 }}>
                  <Phone className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" />
                  <span style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>{data.phone}</span>
                </div>
              )}
              {data.birthDate && (
                <div className="flex items-start gap-2" style={{ minWidth: 0 }}>
                  <Calendar className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" />
                  <span style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>{data.birthDate}</span>
                </div>
              )}
              {data.address && (
                <div className="flex items-start gap-2" style={{ minWidth: 0 }}>
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" />
                  <span style={{ textAlign: 'justify', textJustify: 'inter-word', overflowWrap: 'break-word', wordBreak: 'break-word', minWidth: 0 }}>{data.address}</span>
                </div>
              )}
              {data.drivingLicense && (
                <div className="flex items-start gap-2" style={{ minWidth: 0 }}>
                  <Car className="h-4 w-4 mt-0.5 shrink-0 text-blue-600" />
                  <span style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>Permis {data.drivingLicense}</span>
                </div>
              )}
            </div>
          </SectionBox>

          {/* Skills */}
          {data.skills.length > 0 && (
            <SectionBox>
              <SectionTitle>Compétences</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {data.skills.map((skill, index) => (
                  <span 
                    key={index} 
                    className="px-2 py-1 text-xs rounded-full border border-blue-200 text-blue-700"
                    style={{ backgroundColor: '#eff6ff' }}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </SectionBox>
          )}

          {/* Languages */}
          {data.languages.length > 0 && (
            <SectionBox>
              <SectionTitle>Langues</SectionTitle>
              <div className="space-y-2">
                {data.languages.map((lang) => (
                  <div key={lang.id} className="flex justify-between text-sm">
                    <span className="font-medium text-slate-800">{lang.name}</span>
                    <span className="text-slate-500 text-xs">
                      {languageLevelMap[lang.level] || lang.level}
                    </span>
                  </div>
                ))}
              </div>
            </SectionBox>
          )}

          {/* Centres d'intérêt */}
          {data.interests && data.interests.length > 0 && (
            <SectionBox>
              <SectionTitle>Centres d'intérêt</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {data.interests.map((interest, index) => (
                  <span 
                    key={index} 
                    className="px-2 py-1 text-xs rounded-full border border-amber-200 text-amber-700"
                    style={{ backgroundColor: '#fffbeb' }}
                  >
                    {interest}
                  </span>
                ))}
              </div>
            </SectionBox>
          )}
        </div>

        {/* Right Column - Profile, Experience, Education */}
        <div style={{ width: '65%', minWidth: 0, maxWidth: '65%' }} className="space-y-4">
          {/* Summary / Profile */}
          {data.summary && (
            <SectionBox>
              <SectionTitle>Profil</SectionTitle>
              <p 
                className="text-sm text-slate-600 leading-relaxed"
                style={{ textAlign: 'justify', textJustify: 'inter-word' }}
              >
                {data.summary}
              </p>
            </SectionBox>
          )}

          {/* Experience */}
          {data.experiences.length > 0 && (
            <SectionBox>
              <SectionTitle>Expériences Professionnelles</SectionTitle>
              <div className="space-y-4">
                {data.experiences.map((exp, index) => (
                  <div key={exp.id} className={index > 0 ? 'pt-3 border-t border-gray-100' : ''}>
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-semibold text-slate-800 text-sm">{exp.position}</h3>
                      <span className="text-xs text-slate-500 shrink-0 ml-2">
                        {exp.startDate} - {exp.endDate || 'Présent'}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-blue-600 mb-1">{exp.company}</p>
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
            </SectionBox>
          )}

          {/* Education */}
          {data.education.length > 0 && (
            <SectionBox>
              <SectionTitle>Formation</SectionTitle>
              <div className="space-y-3">
                {data.education.map((edu, index) => (
                  <div key={edu.id} className={index > 0 ? 'pt-3 border-t border-gray-100' : ''}>
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-semibold text-slate-800 text-sm">{edu.degree}</h3>
                      <span className="text-xs text-slate-500 shrink-0 ml-2">
                        {edu.startDate} - {edu.endDate}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-blue-600">{edu.institution}</p>
                    {edu.field && (
                      <p className="text-xs text-slate-500">{edu.field}</p>
                    )}
                  </div>
                ))}
              </div>
            </SectionBox>
          )}
        </div>
      </div>
    </div>
  );
});

CVPreview.displayName = 'CVPreview';

export default CVPreview;
