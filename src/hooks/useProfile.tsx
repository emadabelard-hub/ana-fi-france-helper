import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';
import {
  ensureProfileExists,
  getAuthenticatedProfileUser,
  getProfileErrorMessage,
  isAbortLikeError,
  logSupabaseError,
  saveProfileForUser,
} from '@/lib/profilePersistence';

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
  const { user, isLoading: authLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (authLoading) return;

    if (!user || !isAuthenticated) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const ensuredProfile = await ensureProfileExists(user);
      setProfile(ensuredProfile);
    } catch (error) {
      logSupabaseError('profile:fetch', error, { userId: user.id });
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, [authLoading, isAuthenticated, user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const updateProfile = useCallback(async (updates: Partial<Profile>) => {
    const attempt = async (retry: boolean): Promise<{ error: Error | null | unknown }> => {
      try {
        const activeUser = await getAuthenticatedProfileUser();
        const { created, profile: savedProfile } = await saveProfileForUser(activeUser, updates as Profile);

        setProfile(savedProfile);
        toast({
          title: created ? 'Profil recréé' : 'Profil mis à jour',
          description: created
            ? 'Votre fiche a été recréée puis enregistrée avec succès.'
            : 'Vos informations ont été enregistrées avec succès.',
        });

        return { error: null };
      } catch (error: unknown) {
        if (retry && isAbortLikeError(error)) {
          console.warn('[profile:update] Request aborted, retrying once...');
          await new Promise(r => setTimeout(r, 800));
          return attempt(false);
        }

        logSupabaseError('profile:update', error, { fields: Object.keys(updates) });

        toast({
          variant: "destructive",
          title: "Erreur",
          description: getProfileErrorMessage(error, 'L’enregistrement du profil a échoué.').slice(0, 200),
        });
        return { error };
      }
    };

    return attempt(true);
  }, [toast]);

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
