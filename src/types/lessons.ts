// Lesson content block types
export interface TextBlock {
  type: 'text';
  id: string;
  textAr: string;
  termFr: string;
  phoneticAr?: string;
}

export interface ImageBlock {
  type: 'image';
  id: string;
  imageUrl: string;
  caption?: string;
}

export interface TeacherTipBlock {
  type: 'tip';
  id: string;
  tipAr: string;
}

export interface GrammarBlock {
  type: 'grammar';
  id: string;
  ruleAr: string;
  ruleFr?: string;
}

export type ContentBlock = TextBlock | ImageBlock | TeacherTipBlock | GrammarBlock;

// Lesson categories
export type LessonCategory = 
  | 'vie_quotidienne'
  | 'vie_professionnelle'
  | 'droits_devoirs'
  | 'histoire_culture'
  | 'valeurs_republicaines';

export const LESSON_CATEGORIES: { value: LessonCategory; labelFr: string; labelAr: string }[] = [
  { value: 'vie_quotidienne', labelFr: 'Vie quotidienne', labelAr: 'الحياة اليومية' },
  { value: 'vie_professionnelle', labelFr: 'Vie professionnelle', labelAr: 'الحياة المهنية' },
  { value: 'droits_devoirs', labelFr: 'Droits et devoirs', labelAr: 'الحقوق والواجبات' },
  { value: 'histoire_culture', labelFr: 'Histoire et culture', labelAr: 'التاريخ والثقافة' },
  { value: 'valeurs_republicaines', labelFr: 'Valeurs républicaines', labelAr: 'القيم الجمهورية' },
];

// Database types
export interface Lesson {
  id: string;
  title_fr: string;
  title_ar: string;
  category: LessonCategory;
  audio_url: string | null;
  content: ContentBlock[];
  display_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface Question {
  id: string;
  lesson_id: string | null;
  question_fr: string;
  question_ar: string;
  options: { textFr: string; textAr: string }[];
  correct_answer: number;
  explanation_ar: string | null;
  display_order: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}
