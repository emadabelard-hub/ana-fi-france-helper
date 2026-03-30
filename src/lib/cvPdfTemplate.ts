/**
 * CV PDF Template v2 — Standalone HTML for Browserless (Chrome Headless).
 * Same pipeline as invoices: buildCvHtml() → generate-pdf edge function.
 *
 * Layout: Fixed A4 (794×1123px), padding 40px, max-width 714px centered.
 * Sizes: Name 22px, Title 14px, Sections 13px, Body 11px.
 * Rules: No block split, 1-page preferred, no empty pages.
 */

import type { CVData } from '@/pages/CVGeneratorPage';

const ACCENT = '#2c3e50';
const TEXT = '#1f2937';
const TEXT_MUTED = '#4b5563';
const TEXT_LIGHT = '#6b7280';
const BORDER = '#e5e7eb';
const BORDER_LIGHT = '#f3f4f6';

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

// ─── Section Builders ────────────────────────────────────────────────────────

function sectionTitle(title: string): string {
  return `<div class="section-title"><h2>${esc(title)}</h2><div class="title-line"></div></div>`;
}

function buildHeader(firstName: string, lastName: string, profession: string, personalInfo: string[], photoDataUrl?: string): string {
  return `<div class="cv-header">
  <div class="header-left">
    <h1><span class="fn">${esc(firstName || 'Prénom')}</span> <span class="ln">${esc(lastName || 'NOM')}</span></h1>
    <div class="header-accent"></div>
    <p class="profession">${esc(profession || 'Votre Métier')}</p>
    ${personalInfo.length ? `<p class="personal-info">${personalInfo.join(' · ')}</p>` : ''}
  </div>
  ${photoDataUrl ? `<img class="photo" src="${photoDataUrl}" alt="Photo" />` : ''}
</div>`;
}

function buildContact(data: CVData): string {
  const items: string[] = [];
  if (data.phone) items.push(`<span class="c-item">📞 ${esc(data.phone)}</span>`);
  if (data.email) items.push(`<span class="c-item">✉ ${esc(data.email)}</span>`);
  if (data.address) items.push(`<span class="c-item">📍 ${esc(data.address)}</span>`);
  if (!items.length) return '';
  return `<div class="cv-contact">${items.join('<span class="c-sep">|</span>')}</div>`;
}

function buildProfile(summary?: string): string {
  if (!summary?.trim()) return '';
  return `<div class="cv-section">${sectionTitle('Profil')}<p class="body-text">${esc(summary)}</p></div>`;
}

function buildExperiences(experiences: CVData['experiences']): string {
  if (!experiences.length) return '';
  const items = experiences.map((exp, i) => `
    <div class="entry${i > 0 ? ' entry-border' : ''}">
      <div class="entry-row">
        <div class="entry-main">
          <p class="entry-title">${esc(exp.position)}</p>
          <p class="entry-sub">${esc(exp.company)}</p>
        </div>
        <span class="entry-date">${esc(exp.startDate)} — ${esc(exp.endDate || 'Présent')}</span>
      </div>
      ${exp.description ? `<p class="body-text small">${esc(exp.description)}</p>` : ''}
    </div>`).join('');
  return `<div class="cv-section">${sectionTitle('Expériences Professionnelles')}${items}</div>`;
}

function buildEducation(education: CVData['education']): string {
  if (!education.length) return '';
  const items = education.map((edu, i) => `
    <div class="entry${i > 0 ? ' entry-border' : ''}">
      <div class="entry-row">
        <div class="entry-main">
          <p class="entry-title">${esc(edu.degree)}</p>
          <p class="entry-sub">${esc(edu.institution)}</p>
          ${edu.field ? `<p class="entry-field">${esc(edu.field)}</p>` : ''}
        </div>
        <span class="entry-date">${esc(edu.startDate)} — ${esc(edu.endDate)}</span>
      </div>
    </div>`).join('');
  return `<div class="cv-section">${sectionTitle('Formation')}${items}</div>`;
}

function buildSkills(skills: string[]): string {
  if (!skills.length) return '';
  const tags = skills.map(s => `<span class="skill-tag">${esc(s)}</span>`).join('');
  return `<div class="cv-section">${sectionTitle('Compétences')}<div class="skills-grid">${tags}</div></div>`;
}

function buildLanguages(languages: CVData['languages']): string {
  if (!languages.length) return '';
  const items = languages.map(l => `
    <div class="lang-row">
      <span class="lang-name">${esc(l.name)}</span>
      <span class="lang-level">${esc(langMap[l.level] || l.level)}</span>
    </div>`).join('');
  return `<div class="cv-section">${sectionTitle('Langues')}${items}</div>`;
}

function buildLicense(license?: string): string {
  if (!license) return '';
  return `<div class="cv-section">${sectionTitle('Permis de Conduire')}<p class="body-text">Permis ${esc(license)}</p></div>`;
}

function buildInterests(interests?: string[]): string {
  if (!interests?.length) return '';
  return `<div class="cv-section">${sectionTitle("Centres d'Intérêt")}<p class="body-text">${interests.map(esc).join(' · ')}</p></div>`;
}

// ─── CSS ─────────────────────────────────────────────────────────────────────

const CSS = `
@page { size: A4; margin: 0; }
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  width: 794px;
  min-height: 1123px;
  background: #fff;
  color: ${TEXT};
  font-family: 'Inter', 'Urbanist', 'Segoe UI', sans-serif;
  font-size: 11px;
  line-height: 1.4;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

body {
  padding: 36px 40px 30px;
  max-width: 794px;
  margin: 0 auto;
}

/* ── Header ── */
.cv-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
  page-break-inside: avoid;
  break-inside: avoid;
}
.header-left { flex: 1; }
.cv-header h1 { font-size: 22px; line-height: 1.15; margin-bottom: 3px; }
.cv-header .fn { font-weight: 400; color: ${TEXT_MUTED}; }
.cv-header .ln { font-weight: 700; color: ${TEXT}; letter-spacing: 0.05em; }
.header-accent { height: 2.5px; background: ${ACCENT}; width: 45px; margin: 5px 0; }
.profession { color: ${ACCENT}; font-size: 14px; font-weight: 600; letter-spacing: 0.02em; margin-bottom: 2px; }
.personal-info { font-size: 9.5px; color: ${TEXT_LIGHT}; letter-spacing: 0.02em; }
.photo {
  width: 68px; height: 68px; border-radius: 50%; object-fit: cover;
  border: 2px solid ${ACCENT}; flex-shrink: 0; margin-left: 16px;
}

/* ── Contact ── */
.cv-contact {
  display: flex; flex-wrap: wrap; align-items: center; justify-content: center;
  gap: 6px;
  padding: 7px 0;
  margin-bottom: 6px;
  border-top: 1px solid ${BORDER};
  border-bottom: 1px solid ${BORDER};
  font-size: 9.5px; color: ${TEXT_MUTED};
  page-break-inside: avoid; break-inside: avoid;
}
.c-item { white-space: nowrap; }
.c-sep { color: ${BORDER}; margin: 0 2px; }

/* ── Sections ── */
.cv-section {
  margin-bottom: 8px;
  page-break-inside: avoid;
  break-inside: avoid;
}
.section-title { margin-bottom: 4px; }
.section-title h2 {
  font-size: 13px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.12em;
  color: ${ACCENT}; margin-bottom: 2px;
}
.title-line { height: 1.5px; background: ${ACCENT}; width: 100%; }

/* ── Body Text ── */
.body-text { font-size: 11px; line-height: 1.4; color: ${TEXT}; }
.body-text.small { font-size: 10px; line-height: 1.35; color: ${TEXT_MUTED}; margin-top: 2px; }

/* ── Entries ── */
.entry { margin-bottom: 4px; }
.entry-border { padding-top: 4px; border-top: 1px solid ${BORDER_LIGHT}; }
.entry-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
.entry-main { flex: 1; }
.entry-title { font-size: 11px; font-weight: 600; color: ${TEXT}; }
.entry-sub { font-size: 10px; color: ${TEXT_LIGHT}; }
.entry-field { font-size: 9px; color: #9ca3af; font-style: italic; }
.entry-date { font-size: 9px; color: ${ACCENT}; font-weight: 500; white-space: nowrap; flex-shrink: 0; }

/* ── Skills ── */
.skills-grid { display: flex; flex-wrap: wrap; gap: 5px; }
.skill-tag {
  font-size: 10px; padding: 2px 8px;
  background: #f1f5f9; color: ${TEXT_MUTED};
  border-radius: 3px; border: 1px solid ${BORDER};
}

/* ── Languages ── */
.lang-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; }
.lang-name { font-size: 11px; font-weight: 500; color: ${TEXT}; }
.lang-level { font-size: 10px; font-style: italic; color: ${ACCENT}; }

/* ── Hide interactive ── */
button, [role="button"], input, select, textarea { display: none !important; }
`;

// ─── Main Builder ────────────────────────────────────────────────────────────

export async function buildCvHtml(data: CVData): Promise<string> {
  const { firstName, lastName } = formatName(data.fullName);
  const age = calculateAge(data.birthDate);
  const personalInfo: string[] = [];
  if (age) personalInfo.push(age);
  if (data.maritalStatus) personalInfo.push(esc(data.maritalStatus));
  if (data.drivingLicense) personalInfo.push(`Permis ${esc(data.drivingLicense)}`);

  const photoDataUrl = await inlinePhoto(data.photoUrl);

  const body = [
    buildHeader(firstName, lastName, data.profession, personalInfo, photoDataUrl),
    buildContact(data),
    buildProfile(data.summary),
    buildExperiences(data.experiences),
    buildEducation(data.education),
    buildSkills(data.skills),
    buildLanguages(data.languages),
    buildLicense(data.drivingLicense),
    buildInterests(data.interests),
  ].filter(Boolean).join('\n');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<link href="https://fonts.googleapis.com/css2?family=Urbanist:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>${CSS}</style>
</head>
<body>
${body}
</body>
</html>`;
}
