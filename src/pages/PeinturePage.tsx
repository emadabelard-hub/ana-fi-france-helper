import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import PeintureHeader from '@/components/peinture/PeintureHeader';
import JobDescriptionInput from '@/components/peinture/JobDescriptionInput';
import InteractivePricing, { type AnalysisData } from '@/components/peinture/InteractivePricing';

const PeinturePage = () => {
  const { language, isRTL } = useLanguage();
  const isFr = language === 'fr';

  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);

  const handleAnalyze = async () => {
    if (!description.trim()) return;
    setIsLoading(true);
    setAnalysisData(null);

    try {
      const { data, error } = await supabase.functions.invoke('contracting-assistant', {
        body: { description: description.trim(), location: location.trim(), estimatedDuration: estimatedDuration.trim() },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setAnalysisData(data as AnalysisData);
    } catch (e: any) {
      console.error('Analysis error:', e);
      toast.error(isFr ? 'Erreur lors de l\'analyse. Réessayez.' : 'خطأ في التحليل. حاول مرة أخرى.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("min-h-screen bg-background pb-24", isRTL && "font-cairo")} dir={isRTL ? 'rtl' : 'ltr'}>
      <PeintureHeader isFr={isFr} isRTL={isRTL} />

      <div className="p-4 space-y-5 max-w-lg mx-auto">
        <JobDescriptionInput
          isFr={isFr}
          isRTL={isRTL}
          description={description}
          setDescription={setDescription}
          location={location}
          setLocation={setLocation}
          estimatedDuration={estimatedDuration}
          setEstimatedDuration={setEstimatedDuration}
          onAnalyze={handleAnalyze}
          isLoading={isLoading}
        />

        {analysisData && (
          <InteractivePricing
            data={analysisData}
            isFr={isFr}
            isRTL={isRTL}
          />
        )}
      </div>
    </div>
  );
};

export default PeinturePage;
