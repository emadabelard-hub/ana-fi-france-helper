import { useEffect, useState } from 'react';
import { Heart, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { toggleFavori, onFavorisChanged, fetchFavorisIds } from '@/pages/opportunites/favoris';

type Props = {
  annonceId: string;
  ownerUserId?: string | null;
  isFavInitial?: boolean;
  variant?: 'card' | 'hero';
  className?: string;
};

const FavoriteButton = ({ annonceId, ownerUserId, isFavInitial, variant = 'card', className }: Props) => {
  const { user } = useAuth();
  const { isRTL } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isFav, setIsFav] = useState<boolean>(!!isFavInitial);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setIsFav(!!isFavInitial); }, [isFavInitial]);

  // Refresh state when other components toggle favorites.
  useEffect(() => {
    if (!user) return;
    const refresh = async () => {
      const ids = await fetchFavorisIds(user.id);
      setIsFav(ids.has(annonceId));
    };
    return onFavorisChanged(refresh);
  }, [user, annonceId]);

  // Owner cannot favorite their own annonce.
  if (user && ownerUserId && user.id === ownerUserId) return null;

  const onClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!user) {
      toast({
        title: isRTL ? 'سجّل الدخول' : 'Connectez-vous',
        description: isRTL ? 'كده تقدر تحفظ الإعلان في المفضلة.' : "Connectez-vous pour ajouter aux favoris.",
      });
      navigate('/login');
      return;
    }
    setBusy(true);
    const prev = isFav;
    setIsFav(!prev);
    try {
      await toggleFavori(user.id, annonceId, prev);
      toast({
        title: prev
          ? (isRTL ? 'تم الحذف من المفضلة' : 'Retiré des favoris')
          : (isRTL ? 'تم الحفظ في المفضلة' : 'Ajouté à vos favoris'),
      });
    } catch (err: any) {
      console.error('toggleFavori', err);
      setIsFav(prev);
    } finally {
      setBusy(false);
    }
  };

  const size = variant === 'hero' ? 18 : 16;
  const cls = variant === 'hero'
    ? 'rounded-full p-2 bg-white/10 border border-white/20 text-white'
    : 'rounded-full p-1.5 bg-white border';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isFav}
      aria-label={isRTL ? 'إضافة إلى المفضلة' : 'Ajouter aux favoris'}
      disabled={busy}
      className={cn(cls, 'active:scale-[0.9] transition inline-flex items-center justify-center', className)}
      style={variant === 'card' ? { borderColor: '#E5E9F0' } : undefined}
    >
      {busy ? (
        <Loader2 size={size} className="animate-spin" />
      ) : (
        <Heart
          size={size}
          fill={isFav ? '#DC2626' : 'none'}
          color={isFav ? '#DC2626' : (variant === 'hero' ? '#FFFFFF' : '#6B7280')}
          strokeWidth={2}
        />
      )}
    </button>
  );
};

export default FavoriteButton;
