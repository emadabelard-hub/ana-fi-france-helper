/**
 * CV PDF Template v5 — Modern professional two-column layout (A4 794×1123).
 *
 *  - LEFT 260px  navy #1E3A5F : photo, contact, langues, compétences, certifications, permis
 *  - RIGHT 534px white        : profil, expériences, formation
 */

import type { CVData } from '@/pages/CVGeneratorPage';

// ─── Palette ────────────────────────────────────────────────────────────────
const NAVY = '#1E3A5F';
const NAVY_DARK = '#1A1A2E';
const NAVY_TAG = '#2A4F7A';
const ACCENT = '#4A9FD4';
const ACCENT_SOFT = '#90C4E8';
const SEP_LIGHT = '#E0E8F0';
const BODY = '#444444';
const DATE_GRAY = '#8A9AB0';

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

function formatName(fullName: string): { display: string } {
  if (!fullName?.trim()) return { display: '' };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { display: parts[0].toUpperCase() };
  const lastName = parts[parts.length - 1].toUpperCase();
  const firstName = parts.slice(0, -1).map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
  return { display: `${firstName} ${lastName}` };
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

const langPercent: Record<string, number> = {
  debutant: 25,
  intermediaire: 50,
  avance: 75,
  bilingue: 90,
  natif: 100,
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
  return `<div class="l-section-head">
    <div class="l-section-title">${esc(title)}</div>
    <div class="l-section-line"></div>
  </div>`;
}

function buildLeftColumn(data: CVData, photoDataUrl: string | undefined, displayName: string): string {
  const blocks: string[] = [];

  blocks.push(`
    <div class="l-identity">
      ${photoDataUrl ? `<img class="l-photo" src="${photoDataUrl}" alt="Photo" />` : '<div class="l-photo l-photo-empty"></div>'}
      <div class="l-name">${esc(displayName || 'Prénom NOM')}</div>
      ${data.profession ? `<div class="l-title">${esc(data.profession)}</div>` : ''}
      <div class="l-divider"></div>
    </div>
  `);

  // Coordonnées
  const contact: string[] = [];
  if (data.phone)   contact.push(`<div class="l-row"><span class="l-ico">📞</span><span>${esc(data.phone)}</span></div>`);
  if (data.email)   contact.push(`<div class="l-row"><span class="l-ico">📧</span><span>${esc(data.email)}</span></div>`);
  if (data.address) contact.push(`<div class="l-row"><span class="l-ico">📍</span><span>${esc(data.address)}</span></div>`);
  const age = calculateAge(data.birthDate);
  if (age)                contact.push(`<div class="l-row"><span class="l-ico">·</span><span>${esc(age)}</span></div>`);
  if (data.maritalStatus) contact.push(`<div class="l-row"><span class="l-ico">·</span><span>${esc(data.maritalStatus)}</span></div>`);
  if (contact.length) {
    blocks.push(`<div class="l-block">${leftSectionTitle('Coordonnées')}${contact.join('')}</div>`);
  }

  // Langues
  if (data.languages.length) {
    const items = data.languages.map(l => {
      const pct = langPercent[l.level] ?? 50;
      return `
      <div class="l-lang">
        <div class="l-lang-head">
          <span>${esc(l.name)}</span>
          <span class="l-soft">${esc(langMap[l.level] || l.level)}</span>
        </div>
        <div class="l-lang-bar"><div class="l-lang-fill" style="width:${pct}%"></div></div>
      </div>`;
    }).join('');
    blocks.push(`<div class="l-block">${leftSectionTitle('Langues')}${items}</div>`);
  }

  // Compétences
  if (data.skills.length) {
    const items = data.skills.map(s => `<span class="l-tag">${esc(s)}</span>`).join('');
    blocks.push(`<div class="l-block">${leftSectionTitle('Compétences')}<div class="l-tags">${items}</div></div>`);
  }

  // Certifications
  const certifications = (data as any).certifications as string[] | undefined;
  if (certifications?.length) {
    const items = certifications.map(c => `<div class="l-row"><span class="l-ico">·</span><span>${esc(c)}</span></div>`).join('');
    blocks.push(`<div class="l-block">${leftSectionTitle('Certifications')}${items}</div>`);
  }

  // Permis
  if (data.drivingLicense) {
    blocks.push(`<div class="l-block">${leftSectionTitle('Permis')}<div class="l-badges"><span class="l-badge">${esc(data.drivingLicense)}</span></div></div>`);
  }

  // Intérêts
  if (data.interests?.length) {
    const items = data.interests.map(i => `<span class="l-tag">${esc(i)}</span>`).join('');
    blocks.push(`<div class="l-block">${leftSectionTitle('Intérêts')}<div class="l-tags">${items}</div></div>`);
  }

  return `<aside class="col-left">${blocks.join('')}</aside>`;
}

// ─── RIGHT column ───────────────────────────────────────────────────────────
function rightSectionTitle(title: string): string {
  return `<div class="r-section-head">
    <div class="r-section-title">${esc(title)}</div>
    <div class="r-section-line"></div>
  </div>`;
}

function buildRightColumn(data: CVData, displayName: string): string {
  const blocks: string[] = [`<div class="r-top-bar"></div><div class="r-inner">`];

  // Header (nom + métier)
  blocks.push(`
    <div class="r-header">
      <div class="r-name">${esc(displayName || 'Prénom NOM')}</div>
      ${data.profession ? `<div class="r-job">${esc(data.profession)}</div>` : ''}
      <div class="r-header-line"></div>
    </div>
  `);

  if (data.summary?.trim()) {
    blocks.push(`<section class="r-section">${rightSectionTitle('Profil')}<p class="r-body">${esc(data.summary)}</p></section>`);
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
    blocks.push(`<section class="r-section">${rightSectionTitle('Expériences professionnelles')}${items}</section>`);
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
    blocks.push(`<section class="r-section">${rightSectionTitle('Formation')}${items}</section>`);
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
  min-height: 1123px;
  background: ${NAVY};
  font-family: 'Inter', 'Segoe UI', sans-serif;
  font-size: 8px;
  line-height: 1.4;
  color: ${BODY};
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

.cv-wrap {
  width: 794px;
  min-height: 1123px;
  display: flex;
  align-items: stretch;
  position: relative;
}

/* ── LEFT (260px) ── */
.col-left {
  width: 260px;
  min-height: 1123px;
  background: ${NAVY};
  color: #ffffff;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-size: 8px;
}
.l-identity { text-align: center; }
.l-photo {
  width: 70px; height: 70px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #ffffff;
  margin: 0 auto 8px;
  display: block;
}
.l-photo-empty { background: ${NAVY_TAG}; }
.l-name {
  color: #ffffff;
  font-size: 17px;
  font-weight: 700;
  line-height: 1.15;
  margin-bottom: 3px;
  word-break: break-word;
}
.l-title {
  color: ${ACCENT_SOFT};
  font-size: 10px;
  font-style: italic;
  margin-bottom: 8px;
}
.l-divider {
  height: 1px;
  background: rgba(255,255,255,0.3);
  width: 70%;
  margin: 6px auto 0;
}
.l-block { margin-top: 4px; page-break-inside: avoid; break-inside: avoid; }
.l-section-head { margin-bottom: 6px; }
.l-section-title {
  color: #ffffff;
  font-size: 7px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 3px;
}
.l-section-line {
  height: 2px;
  background: ${ACCENT};
  width: 28px;
}
.l-row {
  font-size: 8px;
  color: #ffffff;
  display: flex;
  gap: 5px;
  align-items: flex-start;
  margin-bottom: 4px;
  line-height: 1.4;
  word-break: break-word;
}
.l-ico {
  flex-shrink: 0;
  width: 10px;
  display: inline-block;
}
.l-soft { color: ${ACCENT_SOFT}; font-style: italic; font-size: 7.5px; }

.l-lang { margin-bottom: 6px; }
.l-lang-head {
  display: flex;
  justify-content: space-between;
  font-size: 8px;
  color: #ffffff;
  margin-bottom: 2px;
}
.l-lang-bar {
  height: 3px;
  background: ${NAVY_TAG};
  border-radius: 2px;
  overflow: hidden;
}
.l-lang-fill {
  height: 100%;
  background: ${ACCENT};
  border-radius: 2px;
}

.l-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.l-tag {
  display: inline-block;
  background: ${NAVY_TAG};
  color: #ffffff;
  font-size: 7px;
  padding: 3px 7px;
  border-radius: 10px;
  line-height: 1.2;
}

.l-badges { display: flex; flex-wrap: wrap; gap: 4px; }
.l-badge {
  display: inline-block;
  background: ${ACCENT};
  color: #ffffff;
  font-size: 8px;
  font-weight: 600;
  padding: 3px 9px;
  border-radius: 12px;
  line-height: 1.2;
}

/* ── RIGHT (534px) ── */
.col-right {
  width: 534px;
  min-height: 1123px;
  background: #ffffff;
  position: relative;
}
.r-top-bar {
  height: 4px;
  background: ${NAVY};
  width: 100%;
}
.r-inner {
  padding: 18px;
  font-size: 8px;
}
.r-header { margin-bottom: 12px; }
.r-name {
  color: ${NAVY};
  font-size: 22px;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: 0.01em;
}
.r-job {
  color: ${ACCENT};
  font-size: 11px;
  font-style: italic;
  margin-top: 2px;
}
.r-header-line {
  height: 1px;
  background: ${SEP_LIGHT};
  margin-top: 8px;
}

.r-section { margin-top: 12px; page-break-inside: avoid; break-inside: avoid; }
.r-section:first-of-type { margin-top: 6px; }
.r-section-head { margin-bottom: 6px; }
.r-section-title {
  color: ${NAVY};
  font-size: 8.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin-bottom: 3px;
}
.r-section-line {
  height: 1.5px;
  background: ${ACCENT};
  width: 100%;
}
.r-body {
  font-size: 8px;
  line-height: 1.4;
  color: ${BODY};
  text-align: justify;
}
.r-body-sm { font-size: 8px; margin-top: 3px; }

.r-entry { margin-top: 7px; page-break-inside: avoid; break-inside: avoid; }
.r-entry:first-child { margin-top: 0; }
.r-entry-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 6px;
}
.r-entry-title {
  font-size: 9px;
  font-weight: 700;
  color: ${NAVY_DARK};
  flex: 1;
}
.r-entry-date {
  font-size: 8px;
  color: ${DATE_GRAY};
  white-space: nowrap;
  flex-shrink: 0;
  text-align: right;
}
.r-entry-sub {
  font-size: 8.5px;
  font-style: italic;
  color: ${ACCENT};
  margin-top: 2px;
}
.r-entry-field {
  font-size: 8px;
  color: ${BODY};
  margin-top: 1px;
}

/* ── Footer ── */
.cv-footer {
  position: absolute;
  bottom: 10px;
  left: 0;
  right: 0;
  text-align: center;
  font-size: 7px;
  color: ${DATE_GRAY};
}

button, [role="button"], input, select, textarea { display: none !important; }
`;

// ─── Main builder ───────────────────────────────────────────────────────────
export async function buildCvHtml(data: CVData): Promise<string> {
  const { display } = formatName(data.fullName);
  const photoDataUrl = await inlinePhoto(data.photoUrl);

  const left = buildLeftColumn(data, photoDataUrl, display);
  const right = buildRightColumn(data, display);

  const footerName = display || 'CV';
  const footerJob = data.profession ? ` · ${esc(data.profession)}` : '';

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
  <div class="cv-footer">CV — ${esc(footerName)}${footerJob} · Page 1/1</div>
</div>
</body>
</html>`;
}
