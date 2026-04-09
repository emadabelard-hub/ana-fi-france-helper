import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  job: string | null;
  address: string | null;
  phone: string | null;
  caf_number: string | null;
  foreigner_number: string | null;
  social_security: string | null;
  company_name: string | null;
  siret: string | null;
  company_address: string | null;
  email: string | null;
  legal_status: string | null;
  logo_url: string | null;
  header_type: string | null;
  header_image_url: string | null;
  artisan_signature_url: string | null;
  stamp_url: string | null;
  capital_social: string | null;
  legal_footer: string | null;
  code_naf: string | null;
  ville_immatriculation: string | null;
  numero_tva: string | null;
  assureur_name: string | null;
  assureur_address: string | null;
  assurance_policy_number: string | null;
  assurance_geographic_coverage: string | null;
  iban: string | null;
  bic: string | null;
  accountant_email: string | null;
  tva_exempt: boolean;
  urssaf_rate: number;
  is_rate: number;
  credits_balance: number;
  daily_message_count: number;
  last_message_date: string | null;
  created_at: string;
  updated_at: string;
}

interface ProfileContextType {
  profile: Profile | null;
  isLoading: boolean;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null | unknown }>;
  refetch: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export const ProfileProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .upsert({ user_id: user.id }, { onConflict: 'user_id' })
          .select()
          .single();

        if (insertError) throw insertError;
        setProfile(newProfile);
      } else {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('Not authenticated') };

    try {
      // Convert empty strings to null for nullable text columns to avoid
      // check-constraint violations (e.g. siret_format)
      const cleaned: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(updates)) {
        cleaned[key] = typeof value === 'string' && value.trim() === '' ? null : value;
      }

      const { data, error } = await supabase
        .from('profiles')
        .upsert({ user_id: user.id, ...cleaned }, { onConflict: 'user_id' })
        .select()
        .single();

      if (error) throw error;

      setProfile(data);
      toast({
        title: "Profil mis à jour",
        description: "Vos informations ont été enregistrées avec succès.",
      });

      return { error: null };
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de mettre à jour le profil.",
      });
      return { error };
    }
  }, [user, toast]);

  return (
    <ProfileContext.Provider value={{ profile, isLoading, updateProfile, refetch: fetchProfile }}>
      {children}
    </ProfileContext.Provider>
  );
};

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
};
