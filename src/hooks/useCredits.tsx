import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useProfile } from './useProfile';
import { useToast } from '@/hooks/use-toast';

// Credit costs for different actions
export const CREDIT_COSTS = {
  chat: 0,           // Free
  invoice_pdf: 0,    // Free
  letter_pdf: 0,     // Free
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;

// Daily message limit for fair use
export const DAILY_MESSAGE_LIMIT = 30;

interface UseCreditsReturn {
  balance: number;
  dailyMessagesUsed: number;
  dailyLimitReached: boolean;
  canAfford: (action: CreditAction) => boolean;
  deductCredits: (action: CreditAction) => Promise<boolean>;
  incrementDailyMessages: () => Promise<boolean>;
  getCost: (action: CreditAction) => number;
  isProcessing: boolean;
}

export const useCredits = (): UseCreditsReturn => {
  const { user } = useAuth();
  const { profile, refetch } = useProfile();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const balance = profile?.credits_balance ?? 0;
  
  // Check if it's a new day and reset count
  const isNewDay = () => {
    if (!profile?.last_message_date) return true;
    const lastDate = new Date(profile.last_message_date).toDateString();
    const today = new Date().toDateString();
    return lastDate !== today;
  };

  const dailyMessagesUsed = isNewDay() ? 0 : (profile?.daily_message_count ?? 0);
  const dailyLimitReached = dailyMessagesUsed >= DAILY_MESSAGE_LIMIT;

  const canAfford = useCallback((action: CreditAction): boolean => {
    const cost = CREDIT_COSTS[action];
    return balance >= cost;
  }, [balance]);

  const getCost = useCallback((action: CreditAction): number => {
    return CREDIT_COSTS[action];
  }, []);

  const incrementDailyMessages = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    // Check if limit reached
    if (dailyLimitReached) {
      toast({
        variant: "destructive",
        title: "🌙 Limite quotidienne atteinte",
        description: "Vous avez atteint la limite de 30 messages par jour. À demain !",
      });
      return false;
    }

    try {
      const today = new Date().toISOString().split('T')[0];
      const newCount = isNewDay() ? 1 : dailyMessagesUsed + 1;

      const { error } = await supabase
        .from('profiles')
        .update({ 
          daily_message_count: newCount,
          last_message_date: today,
        })
        .eq('user_id', user.id);

      if (error) throw error;
      
      await refetch();
      return true;
    } catch (error) {
      console.error('Error incrementing daily messages:', error);
      return true; // Don't block on error
    }
  }, [user, dailyMessagesUsed, dailyLimitReached, refetch, toast]);

  const deductCredits = useCallback(async (action: CreditAction): Promise<boolean> => {
    if (!user) {
      toast({
        variant: "destructive",
        title: "Connexion requise",
        description: "Veuillez vous connecter pour utiliser cette fonctionnalité.",
      });
      return false;
    }

    const cost = CREDIT_COSTS[action];
    
    // Chat is free
    if (cost === 0) return true;

    if (!canAfford(action)) {
      toast({
        variant: "destructive",
        title: "🪙 Crédits insuffisants",
        description: `Vous avez ${balance} crédits. Cette action coûte ${cost} crédits. Rechargez votre compte.`,
      });
      return false;
    }

    setIsProcessing(true);
    try {
      const newBalance = balance - cost;
      
      const { error } = await supabase
        .from('profiles')
        .update({ credits_balance: newBalance })
        .eq('user_id', user.id);

      if (error) throw error;
      
      await refetch();
      
      toast({
        title: "🪙 Crédits déduits",
        description: `${cost} crédit(s) utilisé(s). Solde: ${newBalance} crédits.`,
      });
      
      return true;
    } catch (error) {
      console.error('Error deducting credits:', error);
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de déduire les crédits. Veuillez réessayer.",
      });
      return false;
    } finally {
      setIsProcessing(false);
    }
  }, [user, balance, canAfford, refetch, toast]);

  return {
    balance,
    dailyMessagesUsed,
    dailyLimitReached,
    canAfford,
    deductCredits,
    incrementDailyMessages,
    getCost,
    isProcessing,
  };
};
