import React, { createContext, useContext, useState, useRef, ReactNode, useEffect } from 'react';

export interface Station {
  id: string;
  name: string;
  nameAr: string;
  streamUrl: string;
  color: string;
  category: 'egypt' | 'maghreb';
}

interface RadioContextType {
  currentStation: Station | null;
  isPlaying: boolean;
  volume: number;
  playStation: (station: Station) => void;
  pauseStation: () => void;
  togglePlayPause: () => void;
  setVolume: (volume: number) => void;
}

const RadioContext = createContext<RadioContextType | undefined>(undefined);

export const stations: Station[] = [
  // Radios Égyptiennes (Musique & News)
  {
    id: 'nogoom-fm',
    name: 'Nogoom FM',
    nameAr: 'نجوم إف إم',
    streamUrl: 'https://switch-rb.ice.infomaniak.ch/nogoomfm.mp3',
    color: 'bg-purple-500',
    category: 'egypt',
  },
  {
    id: 'nile-fm',
    name: 'Nile FM',
    nameAr: 'نايل إف إم',
    streamUrl: 'https://switch-rb.ice.infomaniak.ch/nilefm.mp3',
    color: 'bg-blue-500',
    category: 'egypt',
  },
  {
    id: 'mega-fm',
    name: 'Mega FM 92.7',
    nameAr: 'ميجا إف إم 92.7',
    streamUrl: 'https://95fm.ice.infomaniak.ch/95fm.mp3',
    color: 'bg-orange-500',
    category: 'egypt',
  },
  {
    id: 'radio-masr',
    name: 'Radio Masr',
    nameAr: 'راديو مصر',
    streamUrl: 'https://radiomasr.ice.infomaniak.ch/radiomasr.mp3',
    color: 'bg-red-500',
    category: 'egypt',
  },
  {
    id: '9090-fm',
    name: '9090 FM',
    nameAr: '9090 إف إم',
    streamUrl: 'https://9090fm.ice.infomaniak.ch/9090fm.mp3',
    color: 'bg-green-500',
    category: 'egypt',
  },
  {
    id: 'el-gouna-radio',
    name: 'El Gouna Radio',
    nameAr: 'راديو الجونة',
    streamUrl: 'https://elgounaradio.ice.infomaniak.ch/elgounaradio-128.mp3',
    color: 'bg-cyan-500',
    category: 'egypt',
  },
  {
    id: 'energy-fm-egypt',
    name: 'Energy FM Egypt',
    nameAr: 'إنرجي إف إم مصر',
    streamUrl: 'https://nrjegypt.ice.infomaniak.ch/nrjegypt-128.mp3',
    color: 'bg-yellow-500',
    category: 'egypt',
  },
  // Radios Maghreb & France
  {
    id: 'radio-orient',
    name: 'Radio Orient (Paris)',
    nameAr: 'راديو أورينت (باريس)',
    streamUrl: 'https://radioorient.ice.infomaniak.ch/radioorient-high.mp3',
    color: 'bg-amber-600',
    category: 'maghreb',
  },
  {
    id: 'beur-fm',
    name: 'Beur FM',
    nameAr: 'بور إف إم',
    streamUrl: 'http://beurfm.ice.infomaniak.ch/beurfm-high.mp3',
    color: 'bg-rose-500',
    category: 'maghreb',
  },
  {
    id: 'monte-carlo-doualiya',
    name: 'Monte Carlo Doualiya',
    nameAr: 'مونت كارلو الدولية',
    streamUrl: 'https://mc-doualiya.ice.infomaniak.ch/mcd-128.mp3',
    color: 'bg-indigo-500',
    category: 'maghreb',
  },
  {
    id: 'medi-1',
    name: 'Medi 1 (Maghreb)',
    nameAr: 'ميدي 1 (المغرب)',
    streamUrl: 'http://medi1.ice.infomaniak.ch/medi1.mp3',
    color: 'bg-teal-500',
    category: 'maghreb',
  },
  {
    id: 'mosaique-fm',
    name: 'Mosaïque FM (Tunisie)',
    nameAr: 'موزاييك إف إم (تونس)',
    streamUrl: 'http://shoutcast.mosaiquefm.net:8000/mosaiquefm.mp3',
    color: 'bg-pink-500',
    category: 'maghreb',
  },
];

export const RadioProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentStation, setCurrentStation] = useState<Station | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(75);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio element once
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.volume = volume / 100;
    
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const playStation = (station: Station) => {
    if (!audioRef.current) return;
    
    if (currentStation?.id === station.id && isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.src = station.streamUrl;
      audioRef.current.volume = volume / 100;
      audioRef.current.play().catch(console.error);
      setCurrentStation(station);
      setIsPlaying(true);
    }
  };

  const pauseStation = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const togglePlayPause = () => {
    if (!audioRef.current || !currentStation) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(console.error);
      setIsPlaying(true);
    }
  };

  const setVolume = (newVolume: number) => {
    setVolumeState(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume / 100;
    }
  };

  return (
    <RadioContext.Provider value={{
      currentStation,
      isPlaying,
      volume,
      playStation,
      pauseStation,
      togglePlayPause,
      setVolume,
    }}>
      {children}
    </RadioContext.Provider>
  );
};

export const useRadio = (): RadioContextType => {
  const context = useContext(RadioContext);
  if (!context) {
    throw new Error('useRadio must be used within a RadioProvider');
  }
  return context;
};
