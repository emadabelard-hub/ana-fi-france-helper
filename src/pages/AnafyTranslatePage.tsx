import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, LogIn } from 'lucide-react';
import anafyProLogo from '@/assets/anafy-pro-logo.png';

type Card = {
  emoji: string;
  title: string;
  description: string;
  url: string;
  badge?: string;
};

const SECTION_1: Card[] = [
  {
    emoji: '🏛️',
    title: 'الشباك الموحد INPI — تسجيل شركتك',
    description: 'الموقع الرسمي الوحيد لتسجيل أي شركة في فرنسا',
    url: 'https://procedures-inpi-fr.translate.goog/?_x_tr_sl=fr&_x_tr_tl=ar&_x_tr_hl=ar',
  },
  {
    emoji: '📋',
    title: 'Service-Public — دليل الإجراءات',
    description: 'كل المعلومات الرسمية عن إنشاء وإدارة الشركات',
    url: 'https://entreprendre-service--public-fr.translate.goog/?_x_tr_sl=fr&_x_tr_tl=ar&_x_tr_hl=ar',
  },
  {
    emoji: '💼',
    title: 'URSSAF — الضمان الاجتماعي',
    description: 'التسجيل والاشتراكات الاجتماعية',
    url: 'https://www-urssaf-fr.translate.goog/accueil.html?_x_tr_sl=fr&_x_tr_tl=ar&_x_tr_hl=ar',
  },
  {
    emoji: '💰',
    title: 'الضرائب impots.gouv.fr',
    description: 'الموقع الرسمي للضرائب الفرنسية',
    url: 'https://www.impots.gouv.fr/accueil',
    badge: '🔒 افتحه واستخدم ترجمة كروم (شوف الطريقة تحت)',
  },
  {
    emoji: '🔍',
    title: 'INSEE — التحقق من SIRET',
    description: 'اتأكد من رقم SIRET بتاع أي شركة',
    url: 'https://avis--situation--sirene-insee-fr.translate.goog/?_x_tr_sl=fr&_x_tr_tl=ar&_x_tr_hl=ar',
  },
];

const SECTION_2: Card[] = [
  {
    emoji: '📄',
    title: 'Chorus Pro — بوابة الفوترة',
    description: 'بوابة الفوترة الإلكترونية للدولة الفرنسية',
    url: 'https://portail-chorus--pro-gouv-fr.translate.goog/?_x_tr_sl=fr&_x_tr_tl=ar&_x_tr_hl=ar',
  },
  {
    emoji: '📚',
    title: 'Chorus Pro — مركز المساعدة',
    description: 'شروحات ومساعدة على استخدام Chorus Pro',
    url: 'https://communaute.chorus-pro.gouv.fr/',
    badge: '🔒 افتحه واستخدم ترجمة كروم (شوف الطريقة تحت)',
  },
];

const CardLink = ({ card }: { card: Card }) => (
  <a
    href={card.url}
    target="_blank"
    rel="noopener noreferrer"
    className="block rounded-2xl border border-border bg-card p-4 shadow-sm hover:border-primary/40 hover:shadow-md active:scale-[0.99] transition-all"
  >
    <div className="flex items-start gap-3 flex-row-reverse text-right">
      <div className="text-3xl leading-none shrink-0">{card.emoji}</div>
      <div className="flex-1 min-w-0">
        <h3 className="text-[15px] font-bold text-card-foreground font-cairo">{card.title}</h3>
        {card.badge && (
          <p className="text-[12px] text-amber-700 dark:text-amber-300 font-medium mt-1 font-cairo leading-relaxed">
            {card.badge}
          </p>
        )}
        <p className="text-[13px] text-muted-foreground mt-1 font-cairo leading-relaxed">
          {card.description}
        </p>
      </div>
    </div>
  </a>
);

const AnafyTranslatePage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background font-cairo" dir="rtl">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 text-white" style={{ backgroundColor: '#1E3A8A' }}>
        <div className="flex items-center justify-between px-3 py-2 flex-row-reverse">
          <div className="flex items-center gap-1.5 flex-row-reverse cursor-pointer" onClick={() => navigate('/')}>
            <img src={anafyProLogo} alt="Anafy Pro" className="h-9 w-auto object-contain" />
            <h1 className="text-base font-bold">Anafy Pro</h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/login')}
            className="rounded-full h-8 px-3 bg-white/10 hover:bg-white/20 text-white text-xs font-bold gap-1"
          >
            <LogIn className="h-4 w-4" />
            تسجيل الدخول
          </Button>
        </div>
      </header>

      <main className="pt-16 pb-10 px-4 max-w-2xl mx-auto">
        {/* Title */}
        <div className="text-center mt-4 mb-4">
          <h1 className="text-2xl font-bold text-foreground">anafypro ترجمة 🌍</h1>
          <p className="text-sm text-muted-foreground mt-1">
            المواقع الإدارية الفرنسية مترجمة للعربية
          </p>
        </div>

        {/* Intro */}
        <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4 text-right text-[14px] text-foreground leading-relaxed mb-6">
          اضغط على الموقع اللي محتاجه وهيفتح مترجم بالعربي على طول. لو مش فاهم حاجة، اسأل شبيك لبيك 👇
        </div>

        {/* Section 1 */}
        <section className="mb-6">
          <h2 className="text-right text-lg font-bold text-foreground mb-3">🏢 تأسيس شركة</h2>
          <div className="space-y-3">
            {SECTION_1.map((c) => <CardLink key={c.url} card={c} />)}
          </div>
        </section>

        {/* Section 2 */}
        <section className="mb-6">
          <h2 className="text-right text-lg font-bold text-foreground mb-3">🧾 الفوترة الإلكترونية</h2>
          <div className="space-y-3">
            {SECTION_2.map((c) => <CardLink key={c.url} card={c} />)}
          </div>
        </section>

        {/* Warning */}
        <div className="rounded-2xl border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800/60 p-4 text-right text-[13px] text-amber-900 dark:text-amber-100 leading-relaxed mb-5">
          ⚠️ الترجمة أوتوماتيكية من جوجل — ممكن تكون مش دقيقة 100%. صفحات تسجيل الدخول ممكن ماتشتغلش مترجمة، ساعتها ادخل الموقع الأصلي.
        </div>

        {/* Ask assistant */}
        <Button
          onClick={() => navigate('/ai-assistant')}
          className="w-full font-bold h-12 text-[15px] gap-2 flex-row-reverse"
        >
          <ArrowRight className="h-4 w-4" />
          ❓ مش فاهم حاجة؟ اسأل شبيك لبيك
        </Button>
      </main>
    </div>
  );
};

export default AnafyTranslatePage;
