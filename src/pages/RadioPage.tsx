import { useState } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface Station {
  id: string;
  name: string;
  nameAr: string;
  streamUrl: string;
  color: string;
}

const stations: Station[] = [
  {
    id: 'coran-karim',
    name: 'Coran Karim',
    nameAr: 'القرآن الكريم',
    streamUrl: 'https://Qurango.net/radio/tarateel',
    color: 'bg-emerald-500',
  },
  {
    id: 'radio-orient',
    name: 'Radio Orient',
    nameAr: 'راديو أورينت',
    streamUrl: 'https://radioorient.ice.infomaniak.ch/radioorient-high.mp3',
    color: 'bg-amber-500',
  },
  {
    id: 'mega-fm',
    name: 'Mega FM',
    nameAr: 'ميجا إف إم',
    streamUrl: 'https://stream.zeno.fm/yn65fsaurfhvv',
    color: 'bg-blue-500',
  },
  {
    id: 'radio-masr',
    name: 'Radio Masr',
    nameAr: 'راديو مصر',
    streamUrl: 'https://stream.zeno.fm/e3mps8psphruv',
    color: 'bg-red-500',
  },
  {
    id: 'nogoum-fm',
    name: 'Nogoum FM (Music)',
    nameAr: 'نجوم إف إم (موسيقى)',
    streamUrl: 'https://stream.zeno.fm/55rmnf65fzzuv',
    color: 'bg-purple-500',
  },
];

const RadioPage = () => {
  const { t, isRTL, language } = useLanguage();
  const [currentStation, setCurrentStation] = useState<Station | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState([75]);
  const [audio] = useState(() => new Audio());

  const playStation = (station: Station) => {
    if (currentStation?.id === station.id && isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.src = station.streamUrl;
      audio.volume = volume[0] / 100;
      audio.play().catch(console.error);
      setCurrentStation(station);
      setIsPlaying(true);
    }
  };

  const handleVolumeChange = (newVolume: number[]) => {
    setVolume(newVolume);
    audio.volume = newVolume[0] / 100;
  };

  return (
    <div className="py-6 space-y-6">
      {/* Title */}
      <section className={cn("text-center", isRTL && "font-cairo")}>
        <h1 className="text-2xl font-bold text-foreground">
          {t('radio.title')}
        </h1>
      </section>

      {/* Now Playing */}
      {currentStation && (
        <Card className="bg-gradient-to-br from-primary/10 to-accent/10 border-none">
          <CardContent className={cn(
            "p-6 flex flex-col items-center gap-4",
            isRTL && "font-cairo"
          )}>
            <div className={cn(
              "w-20 h-20 rounded-2xl flex items-center justify-center",
              currentStation.color
            )}>
              <span className="text-white text-2xl font-bold">
                {currentStation.name.charAt(0)}
              </span>
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
                value={volume}
                onValueChange={handleVolumeChange}
                max={100}
                step={1}
                className="flex-1"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Station List */}
      <section className="space-y-3">
        <h2 className={cn(
          "text-lg font-semibold text-foreground",
          isRTL && "text-right font-cairo"
        )}>
          {t('radio.selectStation')}
        </h2>

        <div className="grid gap-3">
          {stations.map((station) => {
            const isActive = currentStation?.id === station.id;
            const isCurrentlyPlaying = isActive && isPlaying;

            return (
              <Card
                key={station.id}
                className={cn(
                  "cursor-pointer transition-all duration-200",
                  isActive && "ring-2 ring-primary ring-offset-2"
                )}
                onClick={() => playStation(station)}
              >
                <CardContent className={cn(
                  "flex items-center gap-4 p-4",
                  isRTL && "flex-row-reverse"
                )}>
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center",
                    station.color
                  )}>
                    <span className="text-white font-bold">
                      {station.name.charAt(0)}
                    </span>
                  </div>

                  <div className={cn("flex-1", isRTL && "text-right")}>
                    <h3 className={cn(
                      "font-medium text-foreground",
                      isRTL && "font-cairo"
                    )}>
                      {language === 'ar' ? station.nameAr : station.name}
                    </h3>
                  </div>

                  <Button
                    size="icon"
                    variant={isCurrentlyPlaying ? "default" : "secondary"}
                    className="rounded-full"
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
          })}
        </div>
      </section>
    </div>
  );
};

export default RadioPage;
