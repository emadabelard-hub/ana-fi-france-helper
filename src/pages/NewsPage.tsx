import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { ExternalLink, RefreshCw } from 'lucide-react';

interface RSSSource {
  name: string;
  nameAr: string;
  url: string;
  rssUrl: string;
  icon: string;
}

const TABS = [
  { id: 'egypt', labelFr: '🇪🇬 Masr', labelAr: '🇪🇬 مصر' },
  { id: 'france', labelFr: '🇫🇷 France', labelAr: '🇫🇷 فرنسا' },
  { id: 'sport', labelFr: '⚽ Sport', labelAr: '⚽ رياضة' },
] as const;

const SOURCES: Record<string, RSSSource[]> = {
  egypt: [
    { name: 'Youm7', nameAr: 'اليوم السابع', url: 'https://www.youm7.com', rssUrl: 'https://www.youm7.com/rss/SectionRss', icon: '📰' },
    { name: 'Masrawy', nameAr: 'مصراوي', url: 'https://www.masrawy.com', rssUrl: 'https://www.masrawy.com/rss', icon: '📡' },
    { name: 'BBC Arabic', nameAr: 'بي بي سي عربي', url: 'https://www.bbc.com/arabic', rssUrl: 'https://feeds.bbci.co.uk/arabic/rss.xml', icon: '🌍' },
  ],
  france: [
    { name: '20 Minutes', nameAr: '20 دقيقة', url: 'https://www.20minutes.fr', rssUrl: 'https://www.20minutes.fr/feeds/rss-une.xml', icon: '🗞️' },
    { name: 'Service-Public', nameAr: 'الخدمات العامة', url: 'https://www.service-public.fr', rssUrl: 'https://www.service-public.fr/rss', icon: '🏛️' },
  ],
  sport: [
    { name: 'Yallakora', nameAr: 'يلا كورة', url: 'https://www.yallakora.com', rssUrl: 'https://www.yallakora.com/rss', icon: '⚽' },
    { name: 'FilGoal', nameAr: 'فيل جول', url: 'https://www.filgoal.com', rssUrl: 'https://www.filgoal.com/rss', icon: '🏆' },
  ],
};

const NewsPage = () => {
  const { isRTL, t } = useLanguage();
  const [activeTab, setActiveTab] = useState<string>('egypt');

  const sources = SOURCES[activeTab] || [];

  return (
    <div className={cn("max-w-lg mx-auto pb-8", isRTL && "font-cairo")} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Page Title */}
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-black text-foreground">
          {t('news.title')}
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t('news.subtitle')}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 px-4 pb-3 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all",
              activeTab === tab.id
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {isRTL ? tab.labelAr : tab.labelFr}
          </button>
        ))}
      </div>

      {/* Sources List */}
      <div className="px-4 space-y-3">
        {sources.map((source) => (
          <a
            key={source.name}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 bg-card border border-border rounded-2xl p-4 shadow-sm hover:shadow-md hover:border-primary/30 transition-all active:scale-[0.98]"
          >
            <span className="text-3xl">{source.icon}</span>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-foreground text-[15px]">
                {isRTL ? source.nameAr : source.name}
              </h3>
              <p className="text-xs text-muted-foreground truncate">
                {source.url}
              </p>
            </div>
            <ExternalLink size={18} className="text-muted-foreground shrink-0" />
          </a>
        ))}
      </div>

      {/* Footer note */}
      <p className="text-center text-[10px] text-muted-foreground mt-6 px-4">
        {t('news.disclaimer')}
      </p>
    </div>
  );
};

export default NewsPage;
