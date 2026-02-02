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
import { Plus, Pencil, Trash2, Loader2, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import LessonFormDialog from './LessonFormDialog';
import type { Lesson, ContentBlock } from '@/types/lessons';
import { LESSON_CATEGORIES } from '@/types/lessons';
import type { Json } from '@/integrations/supabase/types';

interface LessonsManagerProps {
  isRTL?: boolean;
}

const LessonsManager = ({ isRTL = true }: LessonsManagerProps) => {
  const { toast } = useToast();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [deleteLesson, setDeleteLesson] = useState<Lesson | null>(null);

  const fetchLessons = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .order('display_order', { ascending: true });

      if (error) throw error;
      
      // Parse content JSON - handle the Json type properly
      const parsedLessons = (data || []).map(lesson => ({
        ...lesson,
        content: Array.isArray(lesson.content) ? lesson.content as unknown as ContentBlock[] : [],
      })) as Lesson[];
      
      setLessons(parsedLessons);
    } catch (error) {
      console.error('Error fetching lessons:', error);
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل في تحميل الدروس' : 'Failed to load lessons',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLessons();
  }, []);

  const handleSave = async (lessonData: Partial<Lesson>) => {
    try {
      if (editingLesson) {
        // Update existing lesson
        const { error } = await supabase
          .from('lessons')
          .update({
            title_fr: lessonData.title_fr,
            title_ar: lessonData.title_ar,
            category: lessonData.category,
            audio_url: lessonData.audio_url || null,
            content: JSON.parse(JSON.stringify(lessonData.content)) as Json,
            display_order: lessonData.display_order,
            is_published: lessonData.is_published,
          })
          .eq('id', editingLesson.id);

        if (error) throw error;

        toast({
          title: isRTL ? 'تم التحديث' : 'Updated',
          description: isRTL ? 'تم تحديث الدرس بنجاح' : 'Lesson updated successfully',
        });
      } else {
        // Create new lesson
        const { error } = await supabase
          .from('lessons')
          .insert({
            title_fr: lessonData.title_fr!,
            title_ar: lessonData.title_ar!,
            category: lessonData.category!,
            audio_url: lessonData.audio_url || null,
            content: JSON.parse(JSON.stringify(lessonData.content)) as Json,
            display_order: lessonData.display_order!,
            is_published: lessonData.is_published!,
          });

        if (error) throw error;

        toast({
          title: isRTL ? 'تمت الإضافة' : 'Added',
          description: isRTL ? 'تم إضافة الدرس بنجاح' : 'Lesson added successfully',
        });
      }

      fetchLessons();
      setEditingLesson(null);
    } catch (error) {
      console.error('Error saving lesson:', error);
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل في حفظ الدرس' : 'Failed to save lesson',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const handleDelete = async () => {
    if (!deleteLesson) return;

    try {
      const { error } = await supabase
        .from('lessons')
        .delete()
        .eq('id', deleteLesson.id);

      if (error) throw error;

      toast({
        title: isRTL ? 'تم الحذف' : 'Deleted',
        description: isRTL ? 'تم حذف الدرس بنجاح' : 'Lesson deleted successfully',
      });

      fetchLessons();
    } catch (error) {
      console.error('Error deleting lesson:', error);
      toast({
        title: isRTL ? 'خطأ' : 'Error',
        description: isRTL ? 'فشل في حذف الدرس' : 'Failed to delete lesson',
        variant: 'destructive',
      });
    } finally {
      setDeleteLesson(null);
    }
  };

  const getCategoryLabel = (category: string) => {
    const cat = LESSON_CATEGORIES.find(c => c.value === category);
    return isRTL ? cat?.labelAr : cat?.labelFr;
  };

  return (
    <Card>
      <CardHeader className={cn(
        "flex flex-row items-center justify-between",
        isRTL && "flex-row-reverse"
      )}>
        <CardTitle className={cn("flex items-center gap-2", isRTL && "flex-row-reverse font-cairo")}>
          <BookOpen className="h-5 w-5" />
          {isRTL ? 'إدارة الدروس' : 'Manage Lessons'}
        </CardTitle>
        <Button
          onClick={() => {
            setEditingLesson(null);
            setIsDialogOpen(true);
          }}
          className={cn("gap-2", isRTL && "flex-row-reverse font-cairo")}
        >
          <Plus className="h-4 w-4" />
          {isRTL ? 'درس جديد' : 'New Lesson'}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : lessons.length === 0 ? (
          <div className={cn(
            "text-center py-8 text-muted-foreground",
            isRTL && "font-cairo"
          )}>
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>{isRTL ? 'لا توجد دروس بعد' : 'No lessons yet'}</p>
            <p className="text-sm">{isRTL ? 'اضغط "درس جديد" للبدء' : 'Click "New Lesson" to start'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={cn(isRTL && "text-right font-cairo")}>
                    {isRTL ? 'العنوان' : 'Title'}
                  </TableHead>
                  <TableHead className={cn(isRTL && "text-right font-cairo")}>
                    {isRTL ? 'الفئة' : 'Category'}
                  </TableHead>
                  <TableHead className={cn(isRTL && "text-right font-cairo")}>
                    {isRTL ? 'المحتوى' : 'Content'}
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
                {lessons.map((lesson) => (
                  <TableRow key={lesson.id}>
                    <TableCell className={cn(isRTL && "text-right font-cairo")}>
                      <div>
                        <p className="font-medium">{isRTL ? lesson.title_ar : lesson.title_fr}</p>
                        <p className="text-sm text-muted-foreground">
                          {isRTL ? lesson.title_fr : lesson.title_ar}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className={cn(isRTL && "text-right font-cairo")}>
                      <Badge variant="secondary">
                        {getCategoryLabel(lesson.category)}
                      </Badge>
                    </TableCell>
                    <TableCell className={cn(isRTL && "text-right font-cairo")}>
                      <span className="text-sm text-muted-foreground">
                        {lesson.content?.length || 0} {isRTL ? 'عنصر' : 'blocks'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={lesson.is_published ? "default" : "outline"}>
                        {lesson.is_published
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
                            setEditingLesson(lesson);
                            setIsDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteLesson(lesson)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Lesson Form Dialog */}
      <LessonFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        lesson={editingLesson}
        onSave={handleSave}
        isRTL={isRTL}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteLesson} onOpenChange={() => setDeleteLesson(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className={cn(isRTL && "text-right font-cairo")}>
              {isRTL ? 'تأكيد الحذف' : 'Confirm Delete'}
            </AlertDialogTitle>
            <AlertDialogDescription className={cn(isRTL && "text-right font-cairo")}>
              {isRTL
                ? `هل أنت متأكد من حذف "${deleteLesson?.title_ar}"؟ لا يمكن التراجع عن هذا الإجراء.`
                : `Are you sure you want to delete "${deleteLesson?.title_fr}"? This action cannot be undone.`}
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

export default LessonsManager;
