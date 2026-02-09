import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { ExternalLink } from 'lucide-react';

interface NewsSource {
  name: string;
  nameAr: string;
  url: string;
  icon: string;
  description: string;
  descriptionAr: string;
  image: string;
}

const TABS = [
  { id: 'egypt', labelFr: '🇪🇬 Égypte', labelAr: '🇪🇬 مصر', accent: 'from-red-500/20 to-amber-500/20' },
  { id: 'france', labelFr: '🇫🇷 France', labelAr: '🇫🇷 فرنسا', accent: 'from-blue-500/20 to-red-500/20' },
  { id: 'sport', labelFr: '⚽ Sport', labelAr: '⚽ رياضة', accent: 'from-green-500/20 to-emerald-500/20' },
] as const;

const SOURCES: Record<string, NewsSource[]> = {
  egypt: [
    {
      name: 'Youm7',
      nameAr: 'اليوم السابع',
      url: 'https://www.youm7.com',
      icon: '📰',
      description: 'Actualités égyptiennes en continu',
      descriptionAr: 'أخبار مصر لحظة بلحظة',
      image: 'https://images.unsplash.com/photo-1572252009286-268acec5ca0a?w=400&h=200&fit=crop',
    },
    {
      name: 'Masrawy',
      nameAr: 'مصراوي',
      url: 'https://www.masrawy.com',
      icon: '📡',
      description: 'Portail d\'information égyptien',
      descriptionAr: 'بوابة أخبار مصرية',
      image: 'https://images.unsplash.com/photo-1539768942893-daf53e448371?w=400&h=200&fit=crop',
    },
    {
      name: 'BBC Arabic',
      nameAr: 'بي بي سي عربي',
      url: 'https://www.bbc.com/arabic',
      icon: '🌍',
      description: 'L\'actualité mondiale en arabe',
      descriptionAr: 'الأخبار العالمية بالعربية',
      image: 'https://images.unsplash.com/photo-1495020689067-958852a7765e?w=400&h=200&fit=crop',
    },
  ],
  france: [
    {
      name: '20 Minutes',
      nameAr: '20 دقيقة',
      url: 'https://www.20minutes.fr',
      icon: '🗞️',
      description: 'L\'essentiel de l\'info en France',
      descriptionAr: 'أهم الأخبار في فرنسا',
      image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400&h=200&fit=crop',
    },
    {
      name: 'Service-Public.fr',
      nameAr: 'الخدمات العامة',
      url: 'https://www.service-public.fr',
      icon: '🏛️',
      description: 'Vos droits et démarches administratives',
      descriptionAr: 'حقوقك والإجراءات الإدارية',
      image: 'https://images.unsplash.com/photo-1555685812-4b943f1cb0eb?w=400&h=200&fit=crop',
    },
    {
      name: 'France Info',
      nameAr: 'فرانس إنفو',
      url: 'https://www.francetvinfo.fr',
      icon: '📺',
      description: 'L\'actualité en direct et en vidéo',
      descriptionAr: 'الأخبار مباشرة وبالفيديو',
      image: 'https://images.unsplash.com/photo-1549923746-c502d488b3ea?w=400&h=200&fit=crop',
    },
  ],
  sport: [
    {
      name: 'Yallakora',
      nameAr: 'يلا كورة',
      url: 'https://www.yallakora.com',
      icon: '⚽',
      description: 'Foot égyptien et résultats en direct',
      descriptionAr: 'كورة مصرية ونتائج مباشرة',
      image: 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=400&h=200&fit=crop',
    },
    {
      name: 'FilGoal',
      nameAr: 'فيل جول',
      url: 'https://www.filgoal.com',
      icon: '🏆',
      description: 'Transferts et analyses sportives',
      descriptionAr: 'انتقالات وتحليلات رياضية',
      image: 'https://images.unsplash.com/photo-1553778263-73a83bab9b0c?w=400&h=200&fit=crop',
    },
    {
      name: 'L\'Équipe',
      nameAr: 'ليكيب',
      url: 'https://www.lequipe.fr',
      icon: '🏅',
      description: 'Le sport français et international',
      descriptionAr: 'الرياضة الفرنسية والدولية',
      image: 'https://images.unsplash.com/photo-1461896836934-bd45ba72a0c8?w=400&h=200&fit=crop',
    },
  ],
};

const NewsPage = () => {
  const { isRTL } = useLanguage();
  const [activeTab, setActiveTab] = useState<string>('egypt');

  const sources = SOURCES[activeTab] || [];
  const activeTabData = TABS.find(t => t.id === activeTab);

  return (
    <div className={cn("max-w-lg mx-auto pb-24")} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <h1 className={cn("text-xl font-black text-foreground", isRTL && "font-cairo")}>
          {isRTL ? '📰 آخر الأخبار' : '📰 Actualités'}
        </h1>
        <p className={cn("text-xs text-muted-foreground mt-0.5", isRTL && "font-cairo")}>
          {isRTL ? 'تابع أهم الأخبار من مصر وفرنسا' : 'Suivez l\'actu d\'Égypte et de France'}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-4 pb-4 overflow-x-auto no-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-5 py-2.5 rounded-2xl text-sm font-bold whitespace-nowrap transition-all duration-300",
              isRTL && "font-cairo",
              activeTab === tab.id
                ? "bg-red-500 text-white shadow-lg shadow-red-500/25 scale-105"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {isRTL ? tab.labelAr : tab.labelFr}
          </button>
        ))}
      </div>

      {/* Article Cards */}
      <div className="px-4 space-y-4">
        {sources.map((source) => (
          <a
            key={source.name}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block bg-card border border-border rounded-2xl overflow-hidden shadow-sm hover:shadow-lg hover:border-red-500/30 transition-all duration-300 active:scale-[0.98]"
          >
            {/* Image */}
            <div className="relative h-36 overflow-hidden">
              <img
                src={source.image}
                alt={isRTL ? source.nameAr : source.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              {/* Source badge */}
              <div className="absolute top-3 left-3 right-auto">
                <span className="bg-black/50 backdrop-blur-sm text-white text-[11px] font-bold px-2.5 py-1 rounded-full">
                  {source.icon} {isRTL ? source.nameAr : source.name}
                </span>
              </div>
              {/* External link icon */}
              <div className="absolute top-3 right-3 left-auto">
                <span className="bg-white/20 backdrop-blur-sm p-1.5 rounded-full inline-flex">
                  <ExternalLink size={14} className="text-white" />
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="p-4">
              <h3 className={cn(
                "font-bold text-foreground text-base mb-1",
                isRTL && "font-cairo"
              )}>
                {isRTL ? source.nameAr : source.name}
              </h3>
              <p className={cn(
                "text-sm text-muted-foreground line-clamp-2",
                isRTL && "font-cairo"
              )}>
                {isRTL ? source.descriptionAr : source.description}
              </p>
            </div>
          </a>
        ))}
      </div>

      {/* Footer */}
      <p className={cn(
        "text-center text-[10px] text-muted-foreground mt-6 px-4",
        isRTL && "font-cairo"
      )}>
        {isRTL
          ? '⚠️ الروابط بتوديك لمواقع خارجية'
          : '⚠️ Ces liens redirigent vers des sites externes'}
      </p>
    </div>
  );
};

export default NewsPage;
