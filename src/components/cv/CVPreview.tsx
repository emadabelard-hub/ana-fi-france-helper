import { forwardRef } from 'react';
import { Mail, Phone, MapPin, Briefcase, GraduationCap, Wrench, Languages } from 'lucide-react';
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

  return (
    <div
      ref={ref}
      dir="ltr"
      lang="fr"
      className="bg-white text-slate-800 w-full max-w-[210mm] mx-auto shadow-lg"
      style={{
        fontFamily: "'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif",
        minHeight: '297mm',
        padding: '0',
      }}
    >
      <div className="flex min-h-[297mm]">
        {/* Sidebar - Left Column */}
        <div 
          className="w-[35%] p-6 text-white"
          style={{ 
            background: 'linear-gradient(180deg, #1e3a5f 0%, #2d4a6f 50%, #1e3a5f 100%)',
          }}
        >
          {/* Profile Circle */}
          <div className="flex justify-center mb-6">
            <div 
              className="w-28 h-28 rounded-full bg-white/20 flex items-center justify-center text-4xl font-bold border-4 border-white/30"
            >
              {data.fullName ? data.fullName.charAt(0).toUpperCase() : '?'}
            </div>
          </div>

          {/* Contact */}
          <div className="mb-8">
            <h3 className="text-lg font-semibold mb-4 pb-2 border-b border-white/30 uppercase tracking-wider">
              Contact
            </h3>
            <div className="space-y-3 text-sm">
              {data.email && (
                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 mt-0.5 shrink-0 opacity-80" />
                  <span className="break-all">{data.email}</span>
                </div>
              )}
              {data.phone && (
                <div className="flex items-start gap-3">
                  <Phone className="h-4 w-4 mt-0.5 shrink-0 opacity-80" />
                  <span>{data.phone}</span>
                </div>
              )}
              {data.address && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0 opacity-80" />
                  <span>{data.address}</span>
                </div>
              )}
            </div>
          </div>

          {/* Skills */}
          {data.skills.length > 0 && (
            <div className="mb-8">
              <h3 className="text-lg font-semibold mb-4 pb-2 border-b border-white/30 uppercase tracking-wider flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Compétences
              </h3>
              <div className="space-y-2">
                {data.skills.map((skill, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <span className="text-sm">{skill}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Languages */}
          {data.languages.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-4 pb-2 border-b border-white/30 uppercase tracking-wider flex items-center gap-2">
                <Languages className="h-4 w-4" />
                Langues
              </h3>
              <div className="space-y-3">
                {data.languages.map((lang) => (
                  <div key={lang.id}>
                    <div className="flex justify-between text-sm mb-1">
                      <span>{lang.name}</span>
                      <span className="text-white/70 text-xs">
                        {languageLevelMap[lang.level] || lang.level}
                      </span>
                    </div>
                    <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-amber-400 rounded-full transition-all"
                        style={{
                          width: lang.level === 'natif' ? '100%' :
                                 lang.level === 'bilingue' ? '90%' :
                                 lang.level === 'avance' ? '75%' :
                                 lang.level === 'intermediaire' ? '50%' : '25%'
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Main Content - Right Column */}
        <div className="w-[65%] p-8">
          {/* Header */}
          <div className="mb-8 pb-6 border-b-2 border-slate-200">
            <h1 
              className="text-3xl font-bold mb-2"
              style={{ color: '#1e3a5f' }}
            >
              {data.fullName || 'Votre Nom'}
            </h1>
            <p className="text-xl text-slate-600 font-medium">
              {data.profession || 'Votre Métier'}
            </p>
          </div>

          {/* Summary */}
          {data.summary && (
            <div className="mb-8">
              <h2 
                className="text-lg font-semibold mb-3 pb-2 border-b-2 uppercase tracking-wider"
                style={{ color: '#1e3a5f', borderColor: '#1e3a5f' }}
              >
                Profil
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed text-justify">
                {data.summary}
              </p>
            </div>
          )}

          {/* Experience */}
          {data.experiences.length > 0 && (
            <div className="mb-8">
              <h2 
                className="text-lg font-semibold mb-4 pb-2 border-b-2 uppercase tracking-wider flex items-center gap-2"
                style={{ color: '#1e3a5f', borderColor: '#1e3a5f' }}
              >
                <Briefcase className="h-5 w-5" />
                Expériences Professionnelles
              </h2>
              <div className="space-y-5">
                {data.experiences.map((exp) => (
                  <div key={exp.id} className="relative pl-4 border-l-2 border-slate-200">
                    <div 
                      className="absolute -left-[5px] top-1 w-2 h-2 rounded-full"
                      style={{ backgroundColor: '#1e3a5f' }}
                    />
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-semibold text-slate-800">{exp.position}</h3>
                      <span className="text-xs text-slate-500 shrink-0 ml-2">
                        {exp.startDate} - {exp.endDate || 'Présent'}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-600 mb-2">{exp.company}</p>
                    {exp.description && (
                      <p className="text-sm text-slate-500 leading-relaxed">
                        {exp.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Education */}
          {data.education.length > 0 && (
            <div>
              <h2 
                className="text-lg font-semibold mb-4 pb-2 border-b-2 uppercase tracking-wider flex items-center gap-2"
                style={{ color: '#1e3a5f', borderColor: '#1e3a5f' }}
              >
                <GraduationCap className="h-5 w-5" />
                Formation
              </h2>
              <div className="space-y-4">
                {data.education.map((edu) => (
                  <div key={edu.id} className="relative pl-4 border-l-2 border-slate-200">
                    <div 
                      className="absolute -left-[5px] top-1 w-2 h-2 rounded-full"
                      style={{ backgroundColor: '#1e3a5f' }}
                    />
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-semibold text-slate-800">{edu.degree}</h3>
                      <span className="text-xs text-slate-500 shrink-0 ml-2">
                        {edu.startDate} - {edu.endDate}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-slate-600">{edu.institution}</p>
                    {edu.field && (
                      <p className="text-sm text-slate-500">{edu.field}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

CVPreview.displayName = 'CVPreview';

export default CVPreview;
