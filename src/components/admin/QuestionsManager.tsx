import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Loader2, HelpCircle, Link } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import QuestionFormDialog from './QuestionFormDialog';
import type { Question, Lesson, ContentBlock } from '@/types/lessons';

interface QuestionsManagerProps {
  isRTL?: boolean;
}

const QuestionsManager = ({ isRTL = true }: QuestionsManagerProps) => {
  const { toast } = useToast();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [deleteQuestion, setDeleteQuestion] = useState<Question | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch questions and lessons in parallel
      const [questionsRes, lessonsRes] = await Promise.all([
        supabase
          .from('questions')
          .select('*')
          .order('display_order', { ascending: true }),
        supabase
          .from('lessons')
          .select('*')
          .order('display_order', { ascending: true }),
      ]);

      if (questionsRes.error) throw questionsRes.error;
      if (lessonsRes.error) throw lessonsRes.error;

      // Parse options JSON
      const parsedQuestions = (questionsRes.data || []).map(q => ({
        ...q,
        options: Array.isArray(q.options) ? q.options as unknown as { textFr: string; textAr: string }[] : [],
      })) as Question[];

      // Parse lessons content
      const parsedLessons = (lessonsRes.data || []).map(lesson => ({
        ...lesson,
        content: Array.isArray(lesson.content) ? lesson.content as unknown as ContentBlock[] : [],
      })) as Lesson[];

      setQuestions(parsedQuestions);
      setLessons(parsedLessons);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل في تحميل البيانات' : 'Failed to load data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async (questionData: Partial<Question>) => {
    try {
      if (editingQuestion) {
        // Update existing question
        const { error } = await supabase
          .from('questions')
          .update({
            lesson_id: questionData.lesson_id,
            question_fr: questionData.question_fr,
            question_ar: questionData.question_ar,
            options: questionData.options,
            correct_answer: questionData.correct_answer,
            explanation_ar: questionData.explanation_ar || null,
            display_order: questionData.display_order,
            is_published: questionData.is_published,
          })
          .eq('id', editingQuestion.id);

        if (error) throw error;

        toast({
          title: isRTL ? 'تم التحديث' : 'Updated',
          description: isRTL ? 'تم تحديث السؤال بنجاح' : 'Question updated successfully',
        });
      } else {
        // Create new question
        const { error } = await supabase
          .from('questions')
          .insert({
            lesson_id: questionData.lesson_id,
            question_fr: questionData.question_fr,
            question_ar: questionData.question_ar,
            options: questionData.options,
            correct_answer: questionData.correct_answer,
            explanation_ar: questionData.explanation_ar || null,
            display_order: questionData.display_order,
            is_published: questionData.is_published,
          });

        if (error) throw error;

        toast({
          title: isRTL ? 'تمت الإضافة' : 'Added',
          description: isRTL ? 'تم إضافة السؤال بنجاح' : 'Question added successfully',
        });
      }

      fetchData();
      setEditingQuestion(null);
    } catch (error) {
      console.error('Error saving question:', error);
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل في حفظ السؤال' : 'Failed to save question',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const handleDelete = async () => {
    if (!deleteQuestion) return;

    try {
      const { error } = await supabase
        .from('questions')
        .delete()
        .eq('id', deleteQuestion.id);

      if (error) throw error;

      toast({
        title: isRTL ? 'تم الحذف' : 'Deleted',
        description: isRTL ? 'تم حذف السؤال بنجاح' : 'Question deleted successfully',
      });

      fetchData();
    } catch (error) {
      console.error('Error deleting question:', error);
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل في حذف السؤال' : 'Failed to delete question',
        variant: 'destructive',
      });
    } finally {
      setDeleteQuestion(null);
    }
  };

  const getLessonTitle = (lessonId: string | null) => {
    if (!lessonId) return null;
    const lesson = lessons.find(l => l.id === lessonId);
    return lesson ? (isRTL ? lesson.title_ar : lesson.title_fr) : null;
  };

  return (
    <Card>
      <CardHeader className={cn(
        "flex flex-row items-center justify-between",
        isRTL && "flex-row-reverse"
      )}>
        <CardTitle className={cn("flex items-center gap-2", isRTL && "flex-row-reverse font-cairo")}>
          <HelpCircle className="h-5 w-5" />
          {isRTL ? 'إدارة الأسئلة' : 'Manage Questions'}
        </CardTitle>
        <Button
          onClick={() => {
            setEditingQuestion(null);
            setIsDialogOpen(true);
          }}
          className={cn("gap-2", isRTL && "flex-row-reverse font-cairo")}
        >
          <Plus className="h-4 w-4" />
          {isRTL ? 'سؤال جديد' : 'New Question'}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : questions.length === 0 ? (
          <div className={cn(
            "text-center py-8 text-muted-foreground",
            isRTL && "font-cairo"
          )}>
            <HelpCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>{isRTL ? 'لا توجد أسئلة بعد' : 'No questions yet'}</p>
            <p className="text-sm">{isRTL ? 'اضغط "سؤال جديد" للبدء' : 'Click "New Question" to start'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={cn(isRTL && "text-right font-cairo")}>
                    {isRTL ? 'السؤال' : 'Question'}
                  </TableHead>
                  <TableHead className={cn(isRTL && "text-right font-cairo")}>
                    {isRTL ? 'مرتبط بدرس' : 'Linked Lesson'}
                  </TableHead>
                  <TableHead className={cn(isRTL && "text-right font-cairo")}>
                    {isRTL ? 'الإجابات' : 'Options'}
                  </TableHead>
                  <TableHead className={cn(isRTL && "text-right font-cairo")}>
                    {isRTL ? 'الحالة' : 'Status'}
                  </TableHead>
                  <TableHead className={cn("w-[100px]", isRTL && "text-right font-cairo")}>
                    {isRTL ? 'إجراءات' : 'Actions'}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questions.map((question) => {
                  const linkedLesson = getLessonTitle(question.lesson_id);
                  return (
                    <TableRow key={question.id}>
                      <TableCell className={cn(isRTL && "text-right font-cairo")}>
                        <div className="max-w-[300px]">
                          <p className="font-medium truncate">
                            {isRTL ? question.question_ar : question.question_fr}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {isRTL ? question.question_fr : question.question_ar}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className={cn(isRTL && "text-right font-cairo")}>
                        {linkedLesson ? (
                          <Badge variant="outline" className="gap-1">
                            <Link className="h-3 w-3" />
                            {linkedLesson}
                          </Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className={cn(isRTL && "text-right font-cairo")}>
                        <span className="text-sm text-muted-foreground">
                          {question.options?.length || 0} {isRTL ? 'إجابة' : 'options'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={question.is_published ? "default" : "outline"}>
                          {question.is_published
                            ? (isRTL ? 'منشور' : 'Published')
                            : (isRTL ? 'مسودة' : 'Draft')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingQuestion(question);
                              setIsDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteQuestion(question)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Question Form Dialog */}
      <QuestionFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        question={editingQuestion}
        lessons={lessons}
        onSave={handleSave}
        isRTL={isRTL}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteQuestion} onOpenChange={() => setDeleteQuestion(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className={cn(isRTL && "text-right font-cairo")}>
              {isRTL ? 'تأكيد الحذف' : 'Confirm Delete'}
            </AlertDialogTitle>
            <AlertDialogDescription className={cn(isRTL && "text-right font-cairo")}>
              {isRTL
                ? 'هل أنت متأكد من حذف هذا السؤال؟ لا يمكن التراجع عن هذا الإجراء.'
                : 'Are you sure you want to delete this question? This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className={cn(isRTL && "flex-row-reverse")}>
            <AlertDialogCancel className={cn(isRTL && "font-cairo")}>
              {isRTL ? 'إلغاء' : 'Cancel'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRTL ? 'حذف' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default QuestionsManager;
