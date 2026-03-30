/**
 * CV PDF Template — Standalone HTML builder for Browserless rendering.
 * Uses the same pipeline as invoices (pdfEngine.ts edge function).
 * 
 * Constraints:
 * - Fixed structure: header / profil / expériences / compétences / formation
 * - No block split across pages (page-break-inside: avoid on each section)
 * - 1 page preferred, 2 max
 * - No empty/partially empty pages
 * - Auto font-size reduction if overflow
 */

import type { CVData } from '@/pages/CVGeneratorPage';

const ACCENT = '#3b4f6b';

function calculateAge(birthDate: string): string {
  if (!birthDate) return '';
  const parts = birthDate.split('/');
  if (parts.length === 3) {
    const [d, m, y] = parts.map(Number);
    if (!isNaN(d) && !isNaN(m) && !isNaN(y)) {
      const birth = new Date(y, m - 1, d);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const md = today.getMonth() - birth.getMonth();
      if (md < 0 || (md === 0 && today.getDate() < birth.getDate())) age--;
      return age > 0 ? `${age} ans` : '';
    }
  }
  return '';
}

function formatName(fullName: string): { firstName: string; lastName: string } {
  if (!fullName?.trim()) return { firstName: '', lastName: '' };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: '', lastName: parts[0].toUpperCase() };
  const lastName = parts[parts.length - 1].toUpperCase();
  const firstName = parts.slice(0, -1).map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
  return { firstName, lastName };
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const langMap: Record<string, string> = {
  debutant: 'Débutant',
  intermediaire: 'Intermédiaire',
  avance: 'Avancé',
  bilingue: 'Bilingue',
  natif: 'Langue maternelle',
};

/**
 * Inline a blob:/relative photoUrl to a base64 data URI.
 */
async function inlinePhoto(url?: string): Promise<string | undefined> {
  if (!url) return undefined;
  if (url.startsWith('data:')) return url;
  try {
    const resp = await fetch(url);
    const blob = await resp.blob();
    return await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

export async function buildCvHtml(data: CVData): Promise<string> {
  const { firstName, lastName } = formatName(data.fullName);
  const age = calculateAge(data.birthDate);
  const personalInfo: string[] = [];
  if (age) personalInfo.push(age);
  if (data.maritalStatus) personalInfo.push(esc(data.maritalStatus));
  if (data.drivingLicense) personalInfo.push(`Permis ${esc(data.drivingLicense)}`);

  const photoDataUrl = await inlinePhoto(data.photoUrl);

  const sectionTitle = (title: string) => `
    <div class="section-title">
      <h2>${esc(title)}</h2>
      <div class="title-bar"></div>
    </div>`;

  // Build sections
  const sections: string[] = [];

  // -- Header (always present)
  sections.push(`<div class="cv-header">
    <div class="header-text">
      <h1><span class="fn">${esc(firstName || 'Prénom')}</span> <span class="ln">${esc(lastName || 'NOM')}</span></h1>
      <div class="header-bar"></div>
      <p class="profession">${esc(data.profession || 'Votre Métier')}</p>
      ${personalInfo.length ? `<p class="personal-info">${personalInfo.join('  •  ')}</p>` : ''}
    </div>
    ${photoDataUrl ? `<img class="photo" src="${photoDataUrl}" alt="Photo" />` : ''}
  </div>`);

  // -- Contact
  const contacts: string[] = [];
  if (data.phone) contacts.push(`📞 ${esc(data.phone)}`);
  if (data.email) contacts.push(`✉️ ${esc(data.email)}`);
  if (data.address) contacts.push(`📍 ${esc(data.address)}`);
  if (contacts.length) {
    sections.push(`<div class="cv-contact">${contacts.map(c => `<span>${c}</span>`).join('')}</div>`);
  }

  // -- Profil
  if (data.summary?.trim()) {
    sections.push(`<div class="cv-section">${sectionTitle('Profil')}<p class="body-text">${esc(data.summary)}</p></div>`);
  }

  // -- Formation
  if (data.education.length > 0) {
    const items = data.education.map((edu, i) => `
      <div class="entry${i > 0 ? ' entry-border' : ''}">
        <div class="entry-row"><div class="entry-main">
          <p class="entry-title">${esc(edu.degree)}</p>
          <p class="entry-sub">${esc(edu.institution)}</p>
          ${edu.field ? `<p class="entry-field">${esc(edu.field)}</p>` : ''}
        </div><span class="entry-date">${esc(edu.startDate)} — ${esc(edu.endDate)}</span></div>
      </div>`).join('');
    sections.push(`<div class="cv-section">${sectionTitle('Formation')}${items}</div>`);
  }

  // -- Expériences
  if (data.experiences.length > 0) {
    const items = data.experiences.map((exp, i) => `
      <div class="entry${i > 0 ? ' entry-border' : ''}">
        <div class="entry-row">
          <p class="entry-title">${esc(exp.position)}</p>
          <span class="entry-date">${esc(exp.startDate)} — ${esc(exp.endDate || 'Présent')}</span>
        </div>
        <p class="entry-sub">${esc(exp.company)}</p>
        ${exp.description ? `<p class="body-text small">${esc(exp.description)}</p>` : ''}
      </div>`).join('');
    sections.push(`<div class="cv-section">${sectionTitle('Expériences Professionnelles')}${items}</div>`);
  }

  // -- Compétences
  if (data.skills.length > 0) {
    sections.push(`<div class="cv-section">${sectionTitle('Compétences')}<p class="body-text">${data.skills.map(esc).join('  •  ')}</p></div>`);
  }

  // -- Langues
  if (data.languages.length > 0) {
    const items = data.languages.map(l => `
      <div class="lang-row">
        <span class="lang-name">${esc(l.name)}</span>
        <span class="lang-level">${esc(langMap[l.level] || l.level)}</span>
      </div>`).join('');
    sections.push(`<div class="cv-section">${sectionTitle('Langues')}${items}</div>`);
  }

  // -- Permis
  if (data.drivingLicense) {
    sections.push(`<div class="cv-section">${sectionTitle('Permis de Conduire')}<p class="body-text">Permis ${esc(data.drivingLicense)}</p></div>`);
  }

  // -- Centres d'intérêt
  if (data.interests?.length) {
    sections.push(`<div class="cv-section">${sectionTitle("Centres d'Intérêt")}<p class="body-text">${data.interests.map(esc).join('  •  ')}</p></div>`);
  }

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Urbanist:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
@page {
  size: A4;
  margin: 10mm 12mm;
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  width: 210mm;
  background: #fff;
  color: #1f2937;
  font-family: 'Urbanist', 'Inter', 'Segoe UI', sans-serif;
  font-size: 8.5pt;
  line-height: 1.3;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* Header */
.cv-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 6px;
  page-break-inside: avoid;
  break-inside: avoid;
}
.header-text { flex: 1; text-align: center; }
.cv-header h1 { font-size: 15pt; line-height: 1.15; margin-bottom: 1px; }
.cv-header .fn { font-weight: 400; }
.cv-header .ln { font-weight: 700; letter-spacing: 0.04em; }
.header-bar { height: 1.5px; background: ${ACCENT}; width: 40px; margin: 4px auto; }
.profession { color: ${ACCENT}; font-size: 9pt; font-weight: 600; letter-spacing: 0.03em; margin-bottom: 2px; }
.personal-info { font-size: 7.5pt; color: #6b7280; letter-spacing: 0.03em; }
.photo {
  width: 58px; height: 58px; border-radius: 50%; object-fit: cover;
  border: 1.5px solid ${ACCENT}; flex-shrink: 0; margin-left: 10px;
}

/* Contact */
.cv-contact {
  text-align: center;
  padding-bottom: 5px;
  margin-bottom: 5px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  color: #4b5563;
  font-size: 7.5pt;
  page-break-inside: avoid;
  break-inside: avoid;
}

/* Sections */
.cv-section {
  page-break-inside: avoid;
  break-inside: avoid;
  margin-bottom: 1px;
}
.section-title { margin-top: 7px; margin-bottom: 2px; }
.section-title h2 {
  font-size: 7pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: ${ACCENT};
  margin-bottom: 2px;
}
.title-bar { height: 1px; background: ${ACCENT}; width: 30px; }

/* Body */
.body-text {
  font-size: 8pt;
  line-height: 1.35;
  color: #374151;
  text-align: justify;
}
.body-text.small { font-size: 7.5pt; line-height: 1.3; color: #4b5563; }

/* Entries (education, experience) */
.entry { margin-bottom: 2px; }
.entry-border { padding-top: 2px; border-top: 1px solid #f3f4f6; }
.entry-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 6px; }
.entry-main { flex: 1; }
.entry-title { font-size: 8pt; font-weight: 600; color: #1f2937; }
.entry-sub { font-size: 7.5pt; color: #6b7280; }
.entry-field { font-size: 7pt; color: #9ca3af; font-style: italic; }
.entry-date { font-size: 7pt; color: ${ACCENT}; font-weight: 500; white-space: nowrap; }

/* Languages */
.lang-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1px; }
.lang-name { font-size: 8pt; font-weight: 500; color: #374151; }
.lang-level { font-size: 7pt; font-style: italic; color: ${ACCENT}; }

/* Hide interactive elements */
button, [role="button"], input, select, textarea { display: none !important; }
</style>
</head>
<body>
${sections.join('\n')}
</body>
</html>`;
}
