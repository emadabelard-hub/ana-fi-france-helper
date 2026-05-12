import { forwardRef } from 'react';
import type { CVData } from '@/pages/CVGeneratorPage';

const SIDEBAR_BG = '#2C3E50';
const SIDEBAR_TEXT = '#FFFFFF';
const SIDEBAR_MUTED = '#CBD5DC';
const ACCENT = '#C9A267'; // Gold accent
const MAIN_TEXT = '#1F2937';
const MAIN_MUTED = '#4B5563';
const DIVIDER_LIGHT = 'rgba(255,255,255,0.25)';
const DIVIDER_DARK = '#E5E7EB';

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
  const firstName = parts
    .slice(0, -1)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(' ');
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

  const SidebarTitle = ({ children }: { children: React.ReactNode }) => (
    <div style={{ marginTop: '12px', marginBottom: '6px' }}>
      <h2
        style={{
          fontSize: '0.62rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: ACCENT,
          margin: 0,
          paddingBottom: '3px',
          borderBottom: `1px solid ${DIVIDER_LIGHT}`,
        }}
      >
        {children}
      </h2>
    </div>
  );

  const MainTitle = ({ children }: { children: React.ReactNode }) => (
    <div style={{ marginTop: '10px', marginBottom: '6px' }}>
      <h2
        style={{
          fontSize: '0.72rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: SIDEBAR_BG,
          margin: 0,
          paddingBottom: '3px',
          borderBottom: `1px solid ${DIVIDER_DARK}`,
        }}
      >
        {children}
      </h2>
    </div>
  );

  const Badge = ({ children }: { children: React.ReactNode }) => (
    <span
      style={{
        display: 'inline-block',
        backgroundColor: 'rgba(255,255,255,0.10)',
        border: `1px solid ${DIVIDER_LIGHT}`,
        color: SIDEBAR_TEXT,
        fontSize: '0.62rem',
        padding: '2px 7px',
        borderRadius: '10px',
        margin: '2px 3px 2px 0',
        lineHeight: 1.3,
      }}
    >
      {children}
    </span>
  );

  return (
    <div
      ref={ref}
      dir="ltr"
      lang="fr"
      className="bg-white text-gray-800 w-full max-w-[210mm] mx-auto"
      style={{
        fontFamily: "'Urbanist', 'Inter', 'Segoe UI', sans-serif",
        width: '210mm',
        height: '297mm',
        boxSizing: 'border-box',
        overflow: 'hidden',
        backgroundColor: '#ffffff',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        flexDirection: 'row',
        color: MAIN_TEXT,
      }}
    >
      {/* ========== SIDEBAR (LEFT 35%) ========== */}
      <aside
        style={{
          width: '35%',
          backgroundColor: SIDEBAR_BG,
          color: SIDEBAR_TEXT,
          padding: '15px 13px',
          boxSizing: 'border-box',
          textAlign: 'left',
        }}
      >
        {/* Photo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
          {data.photoUrl ? (
            <img
              src={data.photoUrl}
              alt="Photo"
              style={{
                width: '95px',
                height: '95px',
                borderRadius: '50%',
                objectFit: 'cover',
                border: `2px solid ${ACCENT}`,
              }}
            />
          ) : (
            <div
              style={{
                width: '95px',
                height: '95px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,0.08)',
                border: `2px dashed ${DIVIDER_LIGHT}`,
              }}
            />
          )}
        </div>

        {/* Name */}
        <div style={{ textAlign: 'center', marginBottom: '4px' }}>
          <h1
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: '1.1rem',
              lineHeight: 1.15,
              margin: 0,
              color: SIDEBAR_TEXT,
            }}
          >
            <div style={{ fontWeight: 400 }}>{firstName || 'Prénom'}</div>
            <div style={{ fontWeight: 700, letterSpacing: '0.04em' }}>{lastName || 'NOM'}</div>
          </h1>
          <div
            style={{
              height: '1.5px',
              backgroundColor: ACCENT,
              width: '38px',
              margin: '6px auto',
            }}
          />
          <p
            style={{
              fontSize: '0.7rem',
              color: ACCENT,
              fontWeight: 600,
              letterSpacing: '0.04em',
              margin: 0,
            }}
          >
            {data.profession || 'Votre Métier'}
          </p>
        </div>

        {/* Contact */}
        <SidebarTitle>Contact</SidebarTitle>
        <div style={{ fontSize: '0.62rem', color: SIDEBAR_MUTED, lineHeight: 1.55 }}>
          {data.phone && <div style={{ marginBottom: '2px' }}>📞 {data.phone}</div>}
          {data.email && (
            <div style={{ marginBottom: '2px', wordBreak: 'break-word' }}>✉️ {data.email}</div>
          )}
          {data.address && <div style={{ marginBottom: '2px' }}>📍 {data.address}</div>}
        </div>

        {/* Personal info */}
        {personalInfoItems.length > 0 && (
          <>
            <SidebarTitle>Informations</SidebarTitle>
            <div style={{ fontSize: '0.62rem', color: SIDEBAR_MUTED, lineHeight: 1.55 }}>
              {personalInfoItems.map((item, i) => (
                <div key={i}>• {item}</div>
              ))}
            </div>
          </>
        )}

        {/* Skills as badges */}
        {data.skills.length > 0 && (
          <>
            <SidebarTitle>Compétences</SidebarTitle>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              {data.skills.map((s, i) => (
                <Badge key={i}>{s}</Badge>
              ))}
            </div>
          </>
        )}

        {/* Languages */}
        {data.languages.length > 0 && (
          <>
            <SidebarTitle>Langues</SidebarTitle>
            <div style={{ fontSize: '0.65rem', color: SIDEBAR_TEXT }}>
              {data.languages.map((lang) => (
                <div
                  key={lang.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '2px',
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{lang.name}</span>
                  <span style={{ color: ACCENT, fontStyle: 'italic', fontSize: '0.6rem' }}>
                    {languageLevelMap[lang.level] || lang.level}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Interests */}
        {data.interests && data.interests.length > 0 && (
          <>
            <SidebarTitle>Centres d'intérêt</SidebarTitle>
            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
              {data.interests.map((it, i) => (
                <Badge key={i}>{it}</Badge>
              ))}
            </div>
          </>
        )}
      </aside>

      {/* ========== MAIN (RIGHT 65%) ========== */}
      <main
        style={{
          width: '65%',
          padding: '15px 18px',
          boxSizing: 'border-box',
          backgroundColor: '#ffffff',
          textAlign: 'left',
        }}
      >
        {/* Profile */}
        {data.summary && (
          <section>
            <MainTitle>Profil</MainTitle>
            <p
              style={{
                textAlign: 'left',
                fontSize: '0.72rem',
                lineHeight: 1.45,
                color: MAIN_MUTED,
                margin: 0,
              }}
            >
              {data.summary}
            </p>
          </section>
        )}

        {/* Experiences */}
        {data.experiences.length > 0 && (
          <section>
            <MainTitle>Expériences professionnelles</MainTitle>
            <div>
              {data.experiences.map((exp, index) => (
                <div
                  key={exp.id}
                  style={{
                    marginTop: index === 0 ? 0 : '6px',
                    paddingTop: index === 0 ? 0 : '5px',
                    borderTop: index === 0 ? 'none' : `1px solid #F1F2F4`,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '6px',
                      alignItems: 'baseline',
                    }}
                  >
                    <p
                      style={{
                        fontSize: '0.74rem',
                        fontWeight: 700,
                        color: MAIN_TEXT,
                        margin: 0,
                      }}
                    >
                      {exp.position}
                    </p>
                    <span
                      style={{
                        fontSize: '0.62rem',
                        color: SIDEBAR_BG,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {exp.startDate} — {exp.endDate || 'Présent'}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: '0.68rem',
                      fontStyle: 'italic',
                      color: ACCENT,
                      margin: '1px 0 2px 0',
                    }}
                  >
                    {exp.company}
                  </p>
                  {exp.description && (
                    <p
                      style={{
                        textAlign: 'left',
                        fontSize: '0.68rem',
                        lineHeight: 1.4,
                        color: MAIN_MUTED,
                        margin: 0,
                      }}
                    >
                      {exp.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Education */}
        {data.education.length > 0 && (
          <section>
            <MainTitle>Formation</MainTitle>
            <div>
              {data.education.map((edu, index) => (
                <div
                  key={edu.id}
                  style={{
                    marginTop: index === 0 ? 0 : '5px',
                    paddingTop: index === 0 ? 0 : '4px',
                    borderTop: index === 0 ? 'none' : `1px solid #F1F2F4`,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '6px',
                      alignItems: 'baseline',
                    }}
                  >
                    <p
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        color: MAIN_TEXT,
                        margin: 0,
                      }}
                    >
                      {edu.degree}
                    </p>
                    <span
                      style={{
                        fontSize: '0.62rem',
                        color: SIDEBAR_BG,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {edu.startDate} — {edu.endDate}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: '0.68rem',
                      color: ACCENT,
                      fontStyle: 'italic',
                      margin: '1px 0 0 0',
                    }}
                  >
                    {edu.institution}
                  </p>
                  {edu.field && (
                    <p
                      style={{
                        fontSize: '0.65rem',
                        color: MAIN_MUTED,
                        margin: '1px 0 0 0',
                      }}
                    >
                      {edu.field}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
});

CVPreview.displayName = 'CVPreview';

export default CVPreview;
