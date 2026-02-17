import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, HardHat } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PeintureHeaderProps {
  isFr: boolean;
  isRTL: boolean;
}

const PeintureHeader: React.FC<PeintureHeaderProps> = ({ isFr, isRTL }) => {
  const navigate = useNavigate();

  return (
    <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4 pt-14 flex items-center gap-3 text-white">
      <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-white/20">
        <ArrowLeft size={24} className={isRTL ? 'rotate-180' : ''} />
      </button>
      <HardHat size={28} />
      <div>
        <h1 className="text-xl font-black">
          {isFr ? 'Expert Travaux & Devis' : 'مساعد المقاولات والتكاليف'}
        </h1>
        <p className="text-xs opacity-80 font-bold">
          {isFr ? 'Analyse IA complète de votre chantier' : 'تحليل ذكي شامل للشانتييه ديالك'}
        </p>
      </div>
    </div>
  );
};

export default PeintureHeader;
