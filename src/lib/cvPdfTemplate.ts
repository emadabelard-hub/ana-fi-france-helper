/**
 * CV PDF Template v4 — Two-column modern layout (A4 fixed 794×1123).
 *
 *  - LEFT 33%  navy #1A2B4A (white text)  : photo, contact, langues, compétences, certifications, permis, intérêts
 *  - RIGHT 67% white (#2E6DA4 accent bar) : profil, expériences, formation
 */

import type { CVData } from '@/pages/CVGeneratorPage';

// ─── Palette ────────────────────────────────────────────────────────────────
const NAVY = '#1A2B4A';
const NAVY_SOFT = '#B8D4F0';
const ACCENT = '#2E6DA4';
const SEP_LIGHT = '#DDE3EC';
const TEXT_DARK = '#000000';
const BODY = '#3A3A4A';
const DATE_GRAY = '#8A9AB0';
const FOOTER_GRAY = '#9ca3af';

// ─── Helpers ────────────────────────────────────────────────────────────────
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

function formatName(fullName: string): { firstName: string; lastName: string; display: string } {
  if (!fullName?.trim()) return { firstName: '', lastName: '', display: '' };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    const ln = parts[0].toUpperCase();
    return { firstName: '', lastName: ln, display: ln };
  }
  const lastName = parts[parts.length - 1].toUpperCase();
  const firstName = parts.slice(0, -1).map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
  return { firstName, lastName, display: `${firstName} ${lastName}` };
}

function esc(s: string): string {
  if (s === undefined || s === null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const langMap: Record<string, string> = {
  debutant: 'Débutant',
  intermediaire: 'Intermédiaire',
  avance: 'Avancé',
  bilingue: 'Bilingue',
  natif: 'Langue maternelle',
};

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

// ─── LEFT column ────────────────────────────────────────────────────────────
function leftSectionTitle(title: string): string {
  return `<div class="l-section-title">${esc(title)}</div>`;
}

function buildLeftColumn(data: CVData, photoDataUrl: string | undefined, displayName: string): string {
  const blocks: string[] = [];

  blocks.push(`
    <div class="l-identity">
      ${photoDataUrl ? `<img class="l-photo" src="${photoDataUrl}" alt="Photo" />` : ''}
      <div class="l-name">${esc(displayName || 'Prénom NOM')}</div>
      ${data.profession ? `<div class="l-title">${esc(data.profession)}</div>` : ''}
      <div class="l-divider"></div>
    </div>
  `);

  // Coordonnées
  const contact: string[] = [];
  if (data.phone)   contact.push(`<div class="l-row"><span class="l-ico">·</span><span>${esc(data.phone)}</span></div>`);
  if (data.email)   contact.push(`<div class="l-row"><span class="l-ico">·</span><span>${esc(data.email)}</span></div>`);
  if (data.address) contact.push(`<div class="l-row"><span class="l-ico">·</span><span>${esc(data.address)}</span></div>`);
  const age = calculateAge(data.birthDate);
  if (age)                contact.push(`<div class="l-row"><span class="l-ico">·</span><span>${esc(age)}</span></div>`);
  if (data.maritalStatus) contact.push(`<div class="l-row"><span class="l-ico">·</span><span>${esc(data.maritalStatus)}</span></div>`);
  if (contact.length) {
    blocks.push(`<div class="l-block">${leftSectionTitle('Coordonnées')}${contact.join('')}</div>`);
  }

  // Langues
  if (data.languages.length) {
    const items = data.languages.map(l => `
      <div class="l-row l-row-split">
        <span>${esc(l.name)}</span>
        <span class="l-soft">${esc(langMap[l.level] || l.level)}</span>
      </div>`).join('');
    blocks.push(`<div class="l-block">${leftSectionTitle('Langues')}${items}</div>`);
  }

  // Compétences
  if (data.skills.length) {
    const items = data.skills.map(s => `<div class="l-row"><span class="l-ico">-</span><span>${esc(s)}</span></div>`).join('');
    blocks.push(`<div class="l-block">${leftSectionTitle('Compétences')}${items}</div>`);
  }

  // Certifications
  const certifications = (data as any).certifications as string[] | undefined;
  if (certifications?.length) {
    const items = certifications.map(c => `<div class="l-row"><span class="l-ico">-</span><span>${esc(c)}</span></div>`).join('');
    blocks.push(`<div class="l-block">${leftSectionTitle('Certifications')}${items}</div>`);
  }

  // Permis
  if (data.drivingLicense) {
    blocks.push(`<div class="l-block">${leftSectionTitle('Permis')}<div class="l-row"><span class="l-ico">-</span><span>Permis ${esc(data.drivingLicense)}</span></div></div>`);
  }

  // Intérêts
  if (data.interests?.length) {
    const items = data.interests.map(i => `<div class="l-row"><span class="l-ico">-</span><span>${esc(i)}</span></div>`).join('');
    blocks.push(`<div class="l-block">${leftSectionTitle('Intérêts')}${items}</div>`);
  }

  return `<aside class="col-left">${blocks.join('')}</aside>`;
}

// ─── RIGHT column ───────────────────────────────────────────────────────────
function rightSectionTitle(title: string): string {
  return `<div class="r-section">
    <div class="r-section-title">${esc(title)}</div>
    <div class="r-section-line"></div>
  </div>`;
}

function buildRightColumn(data: CVData): string {
  const blocks: string[] = [`<div class="r-top-bar"></div><div class="r-inner">`];

  if (data.summary?.trim()) {
    blocks.push(`${rightSectionTitle('Profil')}<p class="r-body">${esc(data.summary)}</p>`);
  }

  if (data.experiences.length) {
    const items = data.experiences.map(exp => `
      <div class="r-entry">
        <div class="r-entry-head">
          <span class="r-entry-title">${esc(exp.position)}</span>
          <span class="r-entry-date">${esc(exp.startDate)} — ${esc(exp.endDate || 'Présent')}</span>
        </div>
        <div class="r-entry-sub">${esc(exp.company)}</div>
        ${exp.description ? `<p class="r-body r-body-sm">${esc(exp.description)}</p>` : ''}
      </div>`).join('');
    blocks.push(`${rightSectionTitle('Expériences professionnelles')}${items}`);
  }

  if (data.education.length) {
    const items = data.education.map(edu => `
      <div class="r-entry">
        <div class="r-entry-head">
          <span class="r-entry-title">${esc(edu.degree)}</span>
          <span class="r-entry-date">${esc(edu.startDate)} — ${esc(edu.endDate)}</span>
        </div>
        <div class="r-entry-sub">${esc(edu.institution)}</div>
        ${edu.field ? `<div class="r-entry-field">${esc(edu.field)}</div>` : ''}
      </div>`).join('');
    blocks.push(`${rightSectionTitle('Formation')}${items}`);
  }

  blocks.push(`</div>`);
  return `<main class="col-right">${blocks.join('')}</main>`;
}

// ─── CSS ────────────────────────────────────────────────────────────────────
const CSS = `
@page { size: A4; margin: 0; }
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  width: 794px;
  height: 1123px;
  background: ${NAVY};
  font-family: 'Inter', 'Segoe UI', sans-serif;
  font-size: 8px;
  line-height: 1.3;
  color: ${BODY};
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  overflow: hidden;
}

.cv-wrap {
  width: 794px;
  height: 1123px;
  display: flex;
  align-items: stretch;
  position: relative;
  overflow: hidden;
}

/* ── LEFT (33%) ── */
.col-left {
  width: 33%;
  height: 1123px;
  background: ${NAVY};
  color: #ffffff;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow: hidden;
}
.l-identity { text-align: center; }
.l-photo {
  width: 60px; height: 60px;
  border-radius: 50%;
  object-fit: cover;
  border: 1.5px solid #ffffff;
  margin: 0 auto 6px;
  display: block;
}
.l-name {
  color: #ffffff;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: 0.02em;
  margin-bottom: 2px;
  word-break: break-word;
}
.l-title {
  color: ${NAVY_SOFT};
  font-size: 10px;
  font-style: italic;
  margin-bottom: 6px;
}
.l-divider {
  height: 0.5px;
  background: #ffffff;
  width: 60%;
  margin: 4px auto 0;
}
.l-block { margin-top: 8px; page-break-inside: avoid; break-inside: avoid; }
.l-section-title {
  color: #ffffff;
  font-size: 8px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding-bottom: 2px;
  margin-bottom: 4px;
  border-bottom: 0.5px solid rgba(255,255,255,0.5);
}
.l-row {
  font-size: 7.5px;
  color: #ffffff;
  display: flex;
  gap: 4px;
  align-items: flex-start;
  margin-bottom: 3px;
  line-height: 1.35;
  word-break: break-word;
}
.l-row-split { justify-content: space-between; }
.l-ico {
  color: ${NAVY_SOFT};
  flex-shrink: 0;
  width: 6px;
  display: inline-block;
}
.l-soft { color: ${NAVY_SOFT}; font-style: italic; font-size: 7px; }

/* ── RIGHT (67%) ── */
.col-right {
  width: 67%;
  height: 1123px;
  background: #ffffff;
  position: relative;
  overflow: hidden;
}
.r-top-bar {
  height: 3px;
  background: ${ACCENT};
  width: 100%;
}
.r-inner {
  padding: 14px;
}
.r-section { margin-top: 10px; margin-bottom: 4px; page-break-inside: avoid; break-inside: avoid; }
.r-section:first-of-type { margin-top: 0; }
.r-section-title {
  color: ${ACCENT};
  font-size: 8px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin-bottom: 3px;
}
.r-section-line {
  height: 0.5px;
  background: ${SEP_LIGHT};
  width: 100%;
}
.r-body {
  font-size: 8px;
  line-height: 1.3;
  color: ${BODY};
  text-align: justify;
  margin-top: 4px;
}
.r-body-sm { font-size: 8px; margin-top: 2px; }

.r-entry { margin-top: 6px; page-break-inside: avoid; break-inside: avoid; }
.r-entry:first-child { margin-top: 4px; }
.r-entry-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 6px;
}
.r-entry-title {
  font-size: 8px;
  font-weight: 700;
  color: ${TEXT_DARK};
  flex: 1;
}
.r-entry-date {
  font-size: 7.5px;
  color: ${DATE_GRAY};
  white-space: nowrap;
  flex-shrink: 0;
  text-align: right;
}
.r-entry-sub {
  font-size: 8px;
  font-style: italic;
  color: ${ACCENT};
  margin-top: 1px;
}
.r-entry-field {
  font-size: 7.5px;
  color: ${BODY};
  margin-top: 1px;
}

/* ── Footer ── */
.cv-footer {
  position: absolute;
  bottom: 8px;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 7px;
  color: ${FOOTER_GRAY};
}

button, [role="button"], input, select, textarea { display: none !important; }
`;

// ─── Main builder ───────────────────────────────────────────────────────────
export async function buildCvHtml(data: CVData): Promise<string> {
  const { display } = formatName(data.fullName);
  const photoDataUrl = await inlinePhoto(data.photoUrl);

  const left = buildLeftColumn(data, photoDataUrl, display);
  const right = buildRightColumn(data);

  const footerName = display || 'CV';

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
<div class="cv-wrap">
  ${left}
  ${right}
  <div class="cv-footer">CV — ${esc(footerName)} · Page 1/1</div>
</div>
</body>
</html>`;
}
