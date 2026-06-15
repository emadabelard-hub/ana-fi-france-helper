import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useProfile } from '@/hooks/useProfile';
import { useLanguage } from '@/contexts/LanguageContext';
import { Languages } from 'lucide-react';

type Dialect = 'egyptien' | 'algerien' | 'marocain' | 'tunisien';

const OPTIONS: { value: Dialect; label: string; sub: string }[] = [
  { value: 'egyptien', label: 'المصري (افتراضي)', sub: 'Égyptien' },
  { value: 'algerien', label: 'الجزائري', sub: 'Algérien' },
  { value: 'marocain', label: 'المغربي', sub: 'Marocain' },
  { value: 'tunisien', label: 'التونسي', sub: 'Tunisien' },
];

const DialectSelector = () => {
  const { profile, updateProfile } = useProfile();
  const [value, setValue] = useState<Dialect>('egyptien');

  useEffect(() => {
    const d = (profile as any)?.dialect as Dialect | undefined;
    if (d) setValue(d);
  }, [profile]);

  const handleChange = async (v: string) => {
    const next = v as Dialect;
    setValue(next);
    await updateProfile({ dialect: next } as any);
  };

  return (
    <Card className="rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Languages className="h-5 w-5" />
          لهجة المساعد
        </CardTitle>
        <CardDescription>اختار اللهجة اللي تحب المساعد يحكي بيها معاك.</CardDescription>
      </CardHeader>
      <CardContent>
        <Label className="mb-2 block">Dialecte de l'assistant</Label>
        <Select value={value} onValueChange={handleChange}>
          <SelectTrigger className="h-12 rounded-xl" lang="fr">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>
                {o.label} <span className="text-muted-foreground">— {o.sub}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardContent>
    </Card>
  );
};

export default DialectSelector;
