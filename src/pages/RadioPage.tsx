import { useState, useMemo } from 'react';
import { Play, Pause, Volume2, Search, Radio, Coffee, Waves, BookOpen } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { useLanguage } from '@/contexts/LanguageContext';
import { useRadio, stations, Station } from '@/contexts/RadioContext';
import { cn } from '@/lib/utils';

interface Ambiance {
  id: string;
  name: string;
  nameAr: string;
  icon: React.ElementType;
  youtubeId: string;
  color: string;
}

const ambiances: Ambiance[] = [
  {
    id: 'ahwa-baladi',
    name: 'Ahwa Baladi (Café)',
    nameAr: 'قهوة بلدي',
    icon: Coffee,
    youtubeId: 'gaGrHUekGrc', // Egyptian cafe ambiance
    color: 'bg-amber-600',
  },
  {
    id: 'corniche-nil',
    name: 'Corniche du Nil',
    nameAr: 'كورنيش النيل',
    icon: Waves,
    youtubeId: 'V-_O7nl0Ii0', // Nile river sounds
    color: 'bg-blue-500',
  },
  {
    id: 'quran',
    name: 'Quran Kareem',
    nameAr: 'القرآن الكريم',
    icon: BookOpen,
    youtubeId: 'WOoGYSfBYHQ', // Quran recitation
    color: 'bg-emerald-600',
  },
];

const RadioPage = () => {
  const { t, isRTL, language } = useLanguage();
  const { currentStation, isPlaying, volume, playStation, setVolume, stop } = useRadio();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeAmbiance, setActiveAmbiance] = useState<string | null>(null);

  const handleVolumeChange = (newVolume: number[]) => {
    setVolume(newVolume[0]);
  };

  const handleAmbianceClick = (ambiance: Ambiance) => {
    // Stop radio if playing
    if (currentStation) {
      stop();
    }
    setActiveAmbiance(activeAmbiance === ambiance.id ? null : ambiance.id);
  };

  const handleStationClick = (station: Station) => {
    // Close ambiance when playing radio
    setActiveAmbiance(null);
    playStation(station);
  };

  // Filter stations by search query
  const filteredStations = useMemo(() => {
    if (!searchQuery.trim()) return stations;
    const query = searchQuery.toLowerCase();
    return stations.filter(station => 
      station.name.toLowerCase().includes(query) || 
      station.nameAr.includes(query)
    );
  }, [searchQuery]);

  // Group stations by category
  const egyptStations = useMemo(() => 
    filteredStations.filter(s => s.category === 'egypt'), 
    [filteredStations]
  );
  
  const maghrebStations = useMemo(() => 
    filteredStations.filter(s => s.category === 'maghreb'), 
    [filteredStations]
  );

  const renderStationCard = (station: Station) => {
    const isActive = currentStation?.id === station.id;
    const isCurrentlyPlaying = isActive && isPlaying;

    return (
      <Card
        key={station.id}
        className={cn(
          "cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02]",
          isActive && "ring-2 ring-primary ring-offset-2 shadow-lg"
        )}
        onClick={() => handleStationClick(station)}
      >
        <CardContent className={cn(
          "flex items-center gap-4 p-4",
          isRTL && "flex-row-reverse"
        )}>
          {/* Station Logo */}
          <div className={cn(
            "w-14 h-14 rounded-xl flex items-center justify-center shadow-md",
            station.color
          )}>
            <Radio className="h-6 w-6 text-white" />
          </div>

          {/* Station Info */}
          <div className={cn("flex-1 min-w-0", isRTL && "text-right")}>
            <h3 className={cn(
              "font-semibold text-foreground truncate",
              isRTL && "font-cairo"
            )}>
              {language === 'ar' ? station.nameAr : station.name}
            </h3>
            <p className="text-xs text-muted-foreground truncate">
              {language === 'ar' ? station.name : station.nameAr}
            </p>
          </div>

          {/* Play Button */}
          <Button
            size="icon"
            variant={isCurrentlyPlaying ? "default" : "secondary"}
            className={cn(
              "rounded-full shrink-0 transition-all duration-200",
              isCurrentlyPlaying && "animate-pulse"
            )}
          >
            {isCurrentlyPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
        </CardContent>
      </Card>
    );
  };

  const renderAmbianceCard = (ambiance: Ambiance) => {
    const isActive = activeAmbiance === ambiance.id;
    const Icon = ambiance.icon;

    return (
      <Card
        key={ambiance.id}
        className={cn(
          "cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02]",
          isActive && "ring-2 ring-primary ring-offset-2 shadow-lg"
        )}
        onClick={() => handleAmbianceClick(ambiance)}
      >
        <CardContent className={cn(
          "flex items-center gap-4 p-4",
          isRTL && "flex-row-reverse"
        )}>
          {/* Ambiance Icon */}
          <div className={cn(
            "w-14 h-14 rounded-xl flex items-center justify-center shadow-md",
            ambiance.color
          )}>
            <Icon className="h-6 w-6 text-white" />
          </div>

          {/* Ambiance Info */}
          <div className={cn("flex-1 min-w-0", isRTL && "text-right")}>
            <h3 className={cn(
              "font-semibold text-foreground truncate",
              isRTL && "font-cairo"
            )}>
              {language === 'ar' ? ambiance.nameAr : ambiance.name}
            </h3>
            <p className="text-xs text-muted-foreground truncate">
              {language === 'ar' ? ambiance.name : ambiance.nameAr}
            </p>
          </div>

          {/* Play/Pause Indicator */}
          <Button
            size="icon"
            variant={isActive ? "default" : "secondary"}
            className={cn(
              "rounded-full shrink-0 transition-all duration-200",
              isActive && "animate-pulse"
            )}
          >
            {isActive ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
        </CardContent>

        {/* YouTube Embed when active */}
        {isActive && (
          <div className="px-4 pb-4">
            <div className="rounded-xl overflow-hidden aspect-video">
              <iframe
                width="100%"
                height="100%"
                src={`https://www.youtube.com/embed/${ambiance.youtubeId}?autoplay=1&loop=1`}
                title={ambiance.name}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="border-0"
              />
            </div>
          </div>
        )}
      </Card>
    );
  };

  const renderCategorySection = (title: string, stationsList: Station[]) => {
    if (stationsList.length === 0) return null;
    
    return (
      <section className="space-y-3">
        <h2 className={cn(
          "text-lg font-semibold text-foreground border-b border-border pb-2",
          isRTL && "text-right font-cairo"
        )}>
          {title}
        </h2>
        <div className="grid gap-3">
          {stationsList.map(renderStationCard)}
        </div>
      </section>
    );
  };

  return (
    <div className="py-6 space-y-6">
      {/* Title */}
      <section className={cn("text-center", isRTL && "font-cairo")}>
        <h1 className="text-2xl font-bold text-foreground">
          {isRTL ? 'بوابة الترفيه' : 'Portail Divertissement'}
        </h1>
      </section>

      {/* Search Bar */}
      <div className="relative">
        <Search className={cn(
          "absolute top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground",
          isRTL ? "right-3" : "left-3"
        )} />
        <Input
          type="text"
          placeholder={t('radio.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={cn(
            "h-12 rounded-xl",
            isRTL ? "pr-10 text-right font-cairo" : "pl-10"
          )}
        />
      </div>

      {/* Now Playing */}
      {currentStation && !activeAmbiance && (
        <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-none shadow-lg">
          <CardContent className={cn(
            "p-6 flex flex-col items-center gap-4",
            isRTL && "font-cairo"
          )}>
            <div className={cn(
              "w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg",
              currentStation.color
            )}>
              <Radio className="h-8 w-8 text-white" />
            </div>
            
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">
                {t('radio.nowPlaying')}
              </p>
              <h2 className="text-xl font-semibold text-foreground">
                {language === 'ar' ? currentStation.nameAr : currentStation.name}
              </h2>
            </div>

            <div className={cn(
              "flex items-center gap-4 w-full max-w-xs",
              isRTL && "flex-row-reverse"
            )}>
              <Volume2 className="h-5 w-5 text-muted-foreground" />
              <Slider
                value={[volume]}
                onValueChange={handleVolumeChange}
                max={100}
                step={1}
                className="flex-1"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Results Message */}
      {filteredStations.length === 0 && searchQuery && (
        <div className={cn(
          "text-center py-8 text-muted-foreground",
          isRTL && "font-cairo"
        )}>
          <Radio className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p>{t('radio.noResults')}</p>
        </div>
      )}

      {/* Jaw Masr - Ambiances Section */}
      <section className="space-y-3">
        <h2 className={cn(
          "text-lg font-semibold text-foreground border-b border-border pb-2",
          isRTL && "text-right font-cairo"
        )}>
          {isRTL ? 'جو مصر 🇪🇬' : 'Ambiances Égyptiennes 🇪🇬'}
        </h2>
        <div className="grid gap-3">
          {ambiances.map(renderAmbianceCard)}
        </div>
      </section>

      {/* Station Categories */}
      {renderCategorySection(t('radio.categoryEgypt'), egyptStations)}
      {renderCategorySection(t('radio.categoryMaghreb'), maghrebStations)}
    </div>
  );
};

export default RadioPage;
