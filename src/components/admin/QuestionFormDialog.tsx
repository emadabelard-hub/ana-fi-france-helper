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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Question, Lesson } from '@/types/lessons';

interface QuestionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: Question | null;
  lessons: Lesson[];
  onSave: (question: Partial<Question>) => Promise<void>;
  isRTL?: boolean;
}

interface QuestionOption {
  textFr: string;
  textAr: string;
}

const QuestionFormDialog = ({
  open,
  onOpenChange,
  question,
  lessons,
  onSave,
  isRTL = true,
}: QuestionFormDialogProps) => {
  const [formData, setFormData] = useState<Partial<Question>>({
    lesson_id: null,
    question_fr: '',
    question_ar: '',
    options: [],
    correct_answer: 0,
    explanation_ar: '',
    display_order: 0,
    is_published: false,
  });
  const [options, setOptions] = useState<QuestionOption[]>([
    { textFr: '', textAr: '' },
    { textFr: '', textAr: '' },
  ]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (question) {
      const qOptions = (question.options || []) as QuestionOption[];
      setFormData({
        lesson_id: question.lesson_id,
        question_fr: question.question_fr,
        question_ar: question.question_ar,
        correct_answer: question.correct_answer,
        explanation_ar: question.explanation_ar || '',
        display_order: question.display_order,
        is_published: question.is_published,
      });
      setOptions(qOptions.length > 0 ? qOptions : [{ textFr: '', textAr: '' }, { textFr: '', textAr: '' }]);
    } else {
      setFormData({
        lesson_id: null,
        question_fr: '',
        question_ar: '',
        correct_answer: 0,
        explanation_ar: '',
        display_order: 0,
        is_published: false,
      });
      setOptions([{ textFr: '', textAr: '' }, { textFr: '', textAr: '' }]);
    }
  }, [question, open]);

  const addOption = () => {
    if (options.length < 6) {
      setOptions([...options, { textFr: '', textAr: '' }]);
    }
  };

  const removeOption = (index: number) => {
    if (options.length > 2) {
      const newOptions = options.filter((_, i) => i !== index);
      setOptions(newOptions);
      // Adjust correct answer if needed
      if (formData.correct_answer && formData.correct_answer >= newOptions.length) {
        setFormData({ ...formData, correct_answer: newOptions.length - 1 });
      }
    }
  };

  const updateOption = (index: number, field: 'textFr' | 'textAr', value: string) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], [field]: value };
    setOptions(newOptions);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        ...formData,
        options: options,
      });
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
            {question
              ? (isRTL ? 'تعديل السؤال' : 'Edit Question')
              : (isRTL ? 'إضافة سؤال جديد' : 'Add New Question')}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 -mx-6 px-6">
          <div className="space-y-6 py-4">
            {/* Link to Lesson */}
            <div className="space-y-2">
              <Label className={cn(isRTL && "text-right font-cairo block")}>
                {isRTL ? 'ربط بدرس (اختياري)' : 'Link to Lesson (Optional)'}
              </Label>
              <Select
                value={formData.lesson_id || 'none'}
                onValueChange={(value) => setFormData({ ...formData, lesson_id: value === 'none' ? null : value })}
              >
                <SelectTrigger className={cn(isRTL && "text-right font-cairo")}>
                  <SelectValue placeholder={isRTL ? 'اختر درس...' : 'Select lesson...'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    {isRTL ? '-- بدون ربط --' : '-- No lesson --'}
                  </SelectItem>
                  {lessons.map((lesson) => (
                    <SelectItem key={lesson.id} value={lesson.id}>
                      {isRTL ? lesson.title_ar : lesson.title_fr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Question FR */}
            <div className="space-y-2">
              <Label className={cn(isRTL && "text-right font-cairo block")}>
                {isRTL ? 'السؤال بالفرنسي' : 'Question (French)'}
              </Label>
              <Textarea
                value={formData.question_fr}
                onChange={(e) => setFormData({ ...formData, question_fr: e.target.value })}
                placeholder="La question en français..."
                dir="ltr"
              />
            </div>

            {/* Question AR */}
            <div className="space-y-2">
              <Label className={cn(isRTL && "text-right font-cairo block")}>
                {isRTL ? 'السؤال بالعربي' : 'Question (Arabic)'}
              </Label>
              <Textarea
                value={formData.question_ar}
                onChange={(e) => setFormData({ ...formData, question_ar: e.target.value })}
                placeholder="السؤال بالعربي..."
                dir="rtl"
                className={cn(isRTL && "font-cairo")}
              />
            </div>

            {/* Options */}
            <div className="space-y-3">
              <div className={cn(
                "flex items-center justify-between",
                isRTL && "flex-row-reverse"
              )}>
                <Label className={cn(isRTL && "font-cairo")}>
                  {isRTL ? 'الإجابات' : 'Answer Options'}
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addOption}
                  disabled={options.length >= 6}
                  className={cn("gap-1", isRTL && "flex-row-reverse font-cairo")}
                >
                  <Plus className="h-4 w-4" />
                  {isRTL ? 'إضافة' : 'Add'}
                </Button>
              </div>

              {options.map((option, index) => (
                <Card key={index} className={cn(
                  formData.correct_answer === index && "border-green-500 bg-green-500/5"
                )}>
                  <CardContent className="p-3 space-y-2">
                    <div className={cn(
                      "flex items-center gap-2 mb-2",
                      isRTL && "flex-row-reverse"
                    )}>
                      <span className={cn(
                        "text-sm font-medium",
                        isRTL && "font-cairo"
                      )}>
                        {isRTL ? `إجابة ${index + 1}` : `Option ${index + 1}`}
                      </span>
                      <Button
                        type="button"
                        variant={formData.correct_answer === index ? "default" : "outline"}
                        size="sm"
                        onClick={() => setFormData({ ...formData, correct_answer: index })}
                        className={cn("text-xs", isRTL && "font-cairo")}
                      >
                        {formData.correct_answer === index
                          ? (isRTL ? '✓ صحيحة' : '✓ Correct')
                          : (isRTL ? 'اختر كصحيحة' : 'Mark correct')}
                      </Button>
                      {options.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => removeOption(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <Input
                      value={option.textFr}
                      onChange={(e) => updateOption(index, 'textFr', e.target.value)}
                      placeholder="Option in French..."
                      dir="ltr"
                    />
                    <Input
                      value={option.textAr}
                      onChange={(e) => updateOption(index, 'textAr', e.target.value)}
                      placeholder="الإجابة بالعربي..."
                      dir="rtl"
                      className={cn(isRTL && "font-cairo")}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Explanation */}
            <div className="space-y-2">
              <Label className={cn(isRTL && "text-right font-cairo block")}>
                {isRTL ? 'الشرح بعد الإجابة (اختياري)' : 'Explanation (Optional)'}
              </Label>
              <Textarea
                value={formData.explanation_ar || ''}
                onChange={(e) => setFormData({ ...formData, explanation_ar: e.target.value })}
                placeholder={isRTL ? 'شرح الإجابة الصحيحة...' : 'Explain the correct answer...'}
                dir="rtl"
                className={cn(isRTL && "font-cairo")}
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
            disabled={isSaving || !formData.question_fr || !formData.question_ar || options.some(o => !o.textFr || !o.textAr)}
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

export default QuestionFormDialog;
