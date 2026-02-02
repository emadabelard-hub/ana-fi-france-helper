import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import ContentBlockEditor from './ContentBlockEditor';
import type { Lesson, ContentBlock, LessonCategory } from '@/types/lessons';
import { LESSON_CATEGORIES } from '@/types/lessons';

interface LessonFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lesson: Lesson | null;
  onSave: (lesson: Partial<Lesson>) => Promise<void>;
  isRTL?: boolean;
}

const LessonFormDialog = ({
  open,
  onOpenChange,
  lesson,
  onSave,
  isRTL = true,
}: LessonFormDialogProps) => {
  const [formData, setFormData] = useState<Partial<Lesson>>({
    title_fr: '',
    title_ar: '',
    category: 'vie_quotidienne',
    audio_url: '',
    content: [],
    display_order: 0,
    is_published: false,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (lesson) {
      setFormData({
        title_fr: lesson.title_fr,
        title_ar: lesson.title_ar,
        category: lesson.category,
        audio_url: lesson.audio_url || '',
        content: lesson.content || [],
        display_order: lesson.display_order,
        is_published: lesson.is_published,
      });
    } else {
      setFormData({
        title_fr: '',
        title_ar: '',
        category: 'vie_quotidienne',
        audio_url: '',
        content: [],
        display_order: 0,
        is_published: false,
      });
    }
  }, [lesson, open]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(formData);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className={cn(isRTL && "text-right font-cairo")}>
            {lesson
              ? (isRTL ? 'تعديل الدرس' : 'Edit Lesson')
              : (isRTL ? 'إضافة درس جديد' : 'Add New Lesson')}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-4">
            {/* Title FR */}
            <div className="space-y-2">
              <Label className={cn(isRTL && "text-right font-cairo block")}>
                {isRTL ? 'العنوان بالفرنسي' : 'Title (French)'}
              </Label>
              <Input
                value={formData.title_fr}
                onChange={(e) => setFormData({ ...formData, title_fr: e.target.value })}
                placeholder="Le titre en français..."
                dir="ltr"
              />
            </div>

            {/* Title AR */}
            <div className="space-y-2">
              <Label className={cn(isRTL && "text-right font-cairo block")}>
                {isRTL ? 'العنوان بالعربي' : 'Title (Arabic)'}
              </Label>
              <Input
                value={formData.title_ar}
                onChange={(e) => setFormData({ ...formData, title_ar: e.target.value })}
                placeholder="العنوان بالعربي..."
                dir="rtl"
                className={cn(isRTL && "font-cairo")}
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label className={cn(isRTL && "text-right font-cairo block")}>
                {isRTL ? 'الفئة' : 'Category'}
              </Label>
              <Select
                value={formData.category}
                onValueChange={(value: LessonCategory) => setFormData({ ...formData, category: value })}
              >
                <SelectTrigger className={cn(isRTL && "text-right font-cairo")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LESSON_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {isRTL ? cat.labelAr : cat.labelFr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Audio URL */}
            <div className="space-y-2">
              <Label className={cn(isRTL && "text-right font-cairo block")}>
                {isRTL ? 'رابط الصوت (اختياري)' : 'Audio URL (Optional)'}
              </Label>
              <Input
                value={formData.audio_url || ''}
                onChange={(e) => setFormData({ ...formData, audio_url: e.target.value })}
                placeholder="https://example.com/audio.mp3"
                dir="ltr"
              />
            </div>

            {/* Display Order */}
            <div className="space-y-2">
              <Label className={cn(isRTL && "text-right font-cairo block")}>
                {isRTL ? 'ترتيب العرض' : 'Display Order'}
              </Label>
              <Input
                type="number"
                value={formData.display_order}
                onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                min="0"
              />
            </div>

            {/* Published Switch */}
            <div className={cn(
              "flex items-center gap-3",
              isRTL && "flex-row-reverse"
            )}>
              <Switch
                checked={formData.is_published}
                onCheckedChange={(checked) => setFormData({ ...formData, is_published: checked })}
              />
              <Label className={cn(isRTL && "font-cairo")}>
                {isRTL ? 'منشور (مرئي للجميع)' : 'Published (visible to all)'}
              </Label>
            </div>

            {/* Content Builder */}
            <div className="space-y-2">
              <Label className={cn(isRTL && "text-right font-cairo block")}>
                {isRTL ? 'محتوى الدرس' : 'Lesson Content'}
              </Label>
            <ContentBlockEditor
              blocks={(formData.content || []) as ContentBlock[]}
              onChange={(blocks) => setFormData(prev => ({ ...prev, content: blocks }))}
              isRTL={isRTL}
            />
            </div>
          </div>
        </ScrollArea>

        {/* Actions */}
        <div className={cn(
          "flex gap-3 pt-4 border-t",
          isRTL && "flex-row-reverse"
        )}>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            {isRTL ? 'إلغاء' : 'Cancel'}
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || !formData.title_fr || !formData.title_ar}
            className="gap-2"
          >
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {isRTL ? 'حفظ' : 'Save'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LessonFormDialog;
