import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

const sectionMap: Record<string, string> = {
  '/': 'home',
  '/home': 'home',
  '/ai-assistant': 'chat',
  '/pro/cv-generator': 'cv',
  '/premium-consultation': 'legal',
  '/consultations': 'legal',
  '/language-school': 'school',
  '/pro': 'tools',
  '/pro/invoice-creator': 'invoice',
  '/pro/quote-to-invoice': 'quote',
  '/pro/admin-assistant': 'admin-assistant',
  '/pro/peinture': 'peinture',
  '/profile': 'profile',
  '/news': 'news',
  '/pro/settings': 'pro-settings',
};

const useVisitTracker = () => {
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const section = sectionMap[location.pathname] || location.pathname;

    supabase
      .from('visit_logs')
      .insert({ user_id: user.id, section })
      .then(({ error }) => {
        if (error) console.error('Visit log error:', error);
      });
  }, [location.pathname, user]);
};

export default useVisitTracker;
