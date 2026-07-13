// Shared constants for the "Opportunités professionnelles" reporting system.
// Motifs / statuts / helpers used by:
// - AnnonceDetailPage (report an annonce)
// - MessageThreadPage (report a conversation or a single message)
// - AdminModerationOpportunitesPage (admin review)

export type ReportType = 'annonce' | 'conversation' | 'message';

export type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'rejected';

export const ANNONCE_REPORT_REASONS: { value: string; fr: string; ar: string }[] = [
  { value: 'trompeuse',       fr: 'Annonce trompeuse ou mensongère',    ar: 'إعلان مضلل أو غير حقيقي' },
  { value: 'dissimule',       fr: 'Suspicion de travail dissimulé',     ar: 'اشتباه في شغل غير قانوني' },
  { value: 'discrimination',  fr: 'Contenu discriminatoire',            ar: 'محتوى فيه تمييز' },
  { value: 'offensant',       fr: 'Contenu offensant ou menaçant',      ar: 'كلام مسيء أو تهديد' },
  { value: 'arnaque',         fr: 'Arnaque ou demande d’argent suspecte', ar: 'نصب أو طلب فلوس بشكل مشبوه' },
  { value: 'coordonnees',     fr: 'Coordonnées personnelles publiées',  ar: 'بيانات شخصية منشورة' },
  { value: 'doublon',         fr: 'Annonce en double',                  ar: 'إعلان مكرر' },
  { value: 'categorie',       fr: 'Mauvaise catégorie',                 ar: 'القسم غير مناسب' },
  { value: 'autre',           fr: 'Autre motif',                        ar: 'سبب آخر' },
];

export const MESSAGE_REPORT_REASONS: { value: string; fr: string; ar: string }[] = [
  { value: 'harcelement', fr: 'Harcèlement',                ar: 'مضايقة' },
  { value: 'menace',      fr: 'Menace',                     ar: 'تهديد' },
  { value: 'insulte',     fr: 'Insulte',                    ar: 'إهانة' },
  { value: 'arnaque',     fr: 'Arnaque',                    ar: 'نصب' },
  { value: 'bancaire',    fr: 'Demande de données bancaires', ar: 'طلب بيانات بنكية' },
  { value: 'illegal',     fr: 'Contenu illégal',            ar: 'محتوى غير قانوني' },
  { value: 'spam',        fr: 'Spam',                       ar: 'رسائل مزعجة' },
  { value: 'autre',       fr: 'Autre',                      ar: 'سبب آخر' },
];

export const REPORT_STATUS_LABELS: Record<ReportStatus, { fr: string; ar: string; bg: string; fg: string }> = {
  pending:   { fr: 'À traiter',    ar: 'قيد الانتظار', bg: '#FDF3E1', fg: '#8A5A00' },
  reviewing: { fr: 'En cours',     ar: 'قيد المراجعة', bg: '#E3EEFB', fg: '#1B4F8A' },
  resolved:  { fr: 'Traité',       ar: 'تمت المعالجة', bg: '#E8F5EE', fg: '#0F7B3D' },
  rejected:  { fr: 'Classé sans suite', ar: 'مرفوض',   bg: '#EEF0F5', fg: '#3F4A63' },
};

// Local rate-limit: prevent instant re-submits from the same browser.
const RL_KEY = 'anafypro:opportunite_report_last_ts';

export const canSubmitReport = (): boolean => {
  try {
    const last = Number(sessionStorage.getItem(RL_KEY) || '0');
    return !last || Date.now() - last > 4000;
  } catch { return true; }
};

export const markReportSubmitted = () => {
  try { sessionStorage.setItem(RL_KEY, String(Date.now())); } catch { /* noop */ }
};
