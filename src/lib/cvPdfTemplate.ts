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
*, *::before, *::after {
  box-sizing: border-box; margin: 0; padding: 0;
}
html, body {
  width: 794px;
  min-height: 1123px;
  font-family: 'DM Sans', 'Inter', sans-serif;
  font-size: 8px;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.cv-wrap {
  width: 794px;
  min-height: 1123px;
  display: flex;
  align-items: stretch;
}

/* GAUCHE */
.col-left {
  width: 270px;
  min-height: 1123px;
  background: ${NAVY};
  color: #fff;
  padding: 36px 24px;
  display: flex;
  flex-direction: column;
  position: relative;
}
.col-left::after {
  content: '';
  position: absolute;
  top: 0; right: -1px;
  width: 3px; height: 100%;
  background: linear-gradient(180deg, ${ACCENT}, ${ACCENT_DARK}, ${NAVY});
}
.l-photo {
  width: 90px; height: 90px;
  border-radius: 50%;
  border: 3px solid ${ACCENT};
  object-fit: cover;
  display: block;
  margin: 0 auto 16px;
}
.l-photo-empty {
  width: 90px; height: 90px;
  border-radius: 50%;
  border: 3px solid ${ACCENT};
  background: ${NAVY_TAG};
  margin: 0 auto 16px;
}
.l-name {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  text-align: center;
  line-height: 1.2;
  margin-bottom: 4px;
}
.l-title {
  font-size: 9px;
  color: ${ACCENT_SOFT};
  text-align: center;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  margin-bottom: 16px;
}
.l-divider {
  height: 1px;
  background: linear-gradient(90deg, transparent, ${ACCENT}, transparent);
  margin-bottom: 18px;
}
.l-block { margin-bottom: 16px; page-break-inside: avoid; break-inside: avoid; }
.l-section-head { margin-bottom: 8px; }
.l-section-title {
  font-size: 7px;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: ${ACCENT};
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.l-section-title::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(232,168,124,0.3);
}
.l-section-line { display: none; }
.l-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 5px;
  font-size: 8px;
  color: #CBD5E1;
  line-height: 1.4;
}
.l-ico { color: ${ACCENT}; flex-shrink: 0; }
.l-lang { margin-bottom: 7px; }
.l-lang-head {
  display: flex;
  justify-content: space-between;
  font-size: 8px;
  color: #fff;
  margin-bottom: 3px;
}
.l-soft { color: ${ACCENT_SOFT}; font-size: 7.5px; }
.l-lang-bar {
  height: 3px;
  background: ${NAVY_TAG};
  border-radius: 2px;
  overflow: hidden;
}
.l-lang-fill {
  height: 100%;
  background: linear-gradient(90deg, ${ACCENT}, ${ACCENT_DARK});
  border-radius: 2px;
}
.l-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.l-tag {
  background: ${NAVY_TAG};
  color: #CBD5E1;
  font-size: 7px;
  padding: 3px 8px;
  border-radius: 20px;
  border: 1px solid #3D5166;
}
.l-badges { display: flex; flex-wrap: wrap; gap: 4px; }
.l-badge {
  background: ${ACCENT};
  color: ${NAVY};
  font-size: 8px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 20px;
}
.cert-item {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 5px;
  font-size: 8px;
  color: #CBD5E1;
}
.cert-dot {
  width: 5px; height: 5px;
  background: ${ACCENT};
  border-radius: 50%;
  flex-shrink: 0;
}

/* DROITE */
.col-right {
  flex: 1;
  min-height: 1123px;
  background: #fff;
  display: flex;
  flex-direction: column;
}
.r-top-bar {
  height: 4px;
  background: linear-gradient(90deg, ${ACCENT}, ${NAVY});
}
.r-header {
  background: ${BG_LIGHT};
  padding: 28px 28px 18px;
  border-bottom: 1px solid ${SEP};
}
.r-name {
  font-size: 26px;
  font-weight: 700;
  color: ${NAVY};
  line-height: 1.1;
  margin-bottom: 4px;
}
.r-job {
  font-size: 10px;
  color: #64748B;
  letter-spacing: 1.5px;
  text-transform: uppercase;
}
.r-header-line { display: none; }
.r-inner {
  padding: 18px 28px;
  flex: 1;
  font-size: 8px;
}
.r-section { margin-bottom: 16px; page-break-inside: avoid; break-inside: avoid; }
.r-section-head { margin-bottom: 8px; }
.r-section-title {
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: ${NAVY};
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.r-section-title::after {
  content: '';
  flex: 1;
  height: 2px;
  background: linear-gradient(90deg, ${ACCENT}, transparent);
}
.r-section-line { display: none; }
.profil-text, .r-section:first-of-type .r-body {
  font-size: 8.5px;
  color: ${BODY};
  line-height: 1.6;
  text-align: justify;
  padding: 10px 12px;
  background: ${BG_LIGHT};
  border-left: 3px solid ${ACCENT};
}
.r-entry {
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 1px dashed ${SEP};
  page-break-inside: avoid;
  break-inside: avoid;
}
.r-entry:last-child {
  border-bottom: none;
  margin-bottom: 0;
}
.r-entry-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2px;
  gap: 8px;
}
.r-entry-title {
  font-size: 9px;
  font-weight: 700;
  color: ${NAVY};
  flex: 1;
}
.r-entry-date {
  font-size: 7.5px;
  color: #fff;
  background: ${NAVY};
  padding: 2px 8px;
  border-radius: 10px;
  white-space: nowrap;
  flex-shrink: 0;
}
.r-entry-sub {
  font-size: 8.5px;
  font-style: italic;
  color: ${ACCENT};
  font-weight: 500;
  margin-bottom: 3px;
}
.r-entry-field {
  font-size: 8px;
  color: ${ACCENT_SOFT};
  margin-top: 2px;
}
.r-body {
  font-size: 8px;
  color: ${BODY};
  line-height: 1.5;
  margin-top: 3px;
}
.r-body-sm { font-size: 8px; margin-top: 3px; }
.cv-footer {
  padding: 8px 28px;
  text-align: center;
  font-size: 7px;
  color: ${ACCENT_SOFT};
  border-top: 1px solid ${SEP};
  letter-spacing: 1px;
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
