import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Type, Image, Trash2, GripVertical, Upload, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { compressImageFile } from '@/lib/imageCompression';
import { toast } from 'sonner';
import type { ContentBlock, TextBlock, ImageBlock } from '@/types/lessons';

interface ContentBlockEditorProps {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
  isRTL?: boolean;
}

const ContentBlockEditor = ({ blocks, onChange, isRTL = true }: ContentBlockEditorProps) => {
  const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const [localBlocks, setLocalBlocks] = useState<ContentBlock[]>(blocks);

  // Keep local UI state in sync when the parent replaces blocks (e.g., switching lessons)
  useEffect(() => {
    setLocalBlocks(blocks);
  }, [blocks]);

  const commitBlocks = (updater: (prev: ContentBlock[]) => ContentBlock[]) => {
    setLocalBlocks((prev) => {
      const next = updater(prev);
      onChange(next);
      return next;
    });
  };
  
  const generateId = () => `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const addTextBlock = () => {
    const newBlock: TextBlock = {
      type: 'text',
      id: generateId(),
      textAr: '',
      termFr: '',
    };
    commitBlocks((prev) => [...prev, newBlock]);
  };

  const addImageBlock = () => {
    const newBlock: ImageBlock = {
      type: 'image',
      id: generateId(),
      imageUrl: '',
      caption: '',
    };
    commitBlocks((prev) => [...prev, newBlock]);
  };

  const updateBlock = (id: string, updates: Partial<TextBlock> | Partial<ImageBlock>) => {
    commitBlocks((prev) =>
      prev.map((block) => {
        if (block.id !== id) return block;
        if (block.type === 'text') {
          return { ...block, ...updates } as TextBlock;
        }
        return { ...block, ...updates } as ImageBlock;
      }),
    );
  };

  const removeBlock = (id: string) => {
    commitBlocks((prev) => prev.filter((block) => block.id !== id));
  };

  const moveBlock = (fromIndex: number, toIndex: number) => {
    commitBlocks((prev) => {
      if (toIndex < 0 || toIndex >= prev.length) return prev;
      const next = [...prev];
      const [removed] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, removed);
      return next;
    });
  };

  const handleImageUpload = async (blockId: string, file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error(isRTL ? 'يرجى اختيار ملف صورة' : 'Please select an image file');
      return;
    }

    setUploadingBlockId(blockId);
    
    try {
      // Compress the image before upload
      const compressedBlob = await compressImageFile(file, {
        maxWidth: 1200,
        maxHeight: 1200,
        quality: 0.8,
      });

      // Generate unique filename
      const fileExt = 'jpg'; // Always save as jpg after compression
      const fileName = `${blockId}-${Date.now()}.${fileExt}`;
      const filePath = `lessons/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('lesson-images')
        .upload(filePath, compressedBlob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('lesson-images')
        .getPublicUrl(filePath);

      // Update the block with the new URL
      updateBlock(blockId, { imageUrl: urlData.publicUrl });
      toast.success(isRTL ? 'تم رفع الصورة بنجاح' : 'Image uploaded successfully');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(isRTL ? 'فشل رفع الصورة' : `Upload failed: ${error.message}`);
    } finally {
      setUploadingBlockId(null);
    }
  };

  const triggerFileInput = (blockId: string) => {
    fileInputRefs.current[blockId]?.click();
  };

  return (
    <div className="space-y-4">
      {/* Add Block Buttons */}
      <div className={cn("flex gap-2 relative z-10", isRTL && "flex-row-reverse")}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addTextBlock}
          className={cn("gap-2 touch-manipulation", isRTL && "flex-row-reverse font-cairo")}
        >
          <Type className="h-4 w-4" />
          {isRTL ? 'أضف نص' : 'Add Text Block'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addImageBlock}
          className={cn("gap-2 touch-manipulation", isRTL && "flex-row-reverse font-cairo")}
        >
          <Image className="h-4 w-4" />
          {isRTL ? 'أضف صورة' : 'Add Image Block'}
        </Button>
      </div>

      {/* Blocks List */}
      <div className="space-y-3">
        {localBlocks.map((block, index) => (
          <Card key={block.id} className="relative">
            <CardContent className="p-4">
              {/* Block Header */}
              <div className={cn(
                "flex items-center gap-2 mb-3 pb-2 border-b",
                isRTL && "flex-row-reverse"
              )}>
                <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                <span className={cn(
                  "text-sm font-medium text-muted-foreground flex-1",
                  isRTL && "text-right font-cairo"
                )}>
                  {block.type === 'text' ? (
                    <>{isRTL ? 'بلوك نص' : 'Text Block'} #{index + 1}</>
                  ) : (
                    <>{isRTL ? 'بلوك صورة' : 'Image Block'} #{index + 1}</>
                  )}
                </span>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => moveBlock(index, index - 1)}
                    disabled={index === 0}
                  >
                    ↑
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => moveBlock(index, index + 1)}
                     disabled={index === localBlocks.length - 1}
                  >
                    ↓
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => removeBlock(block.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Block Content */}
              {block.type === 'text' ? (
                <div className="space-y-3">
                  <div>
                    <label className={cn(
                      "text-sm font-medium mb-1 block",
                      isRTL && "text-right font-cairo"
                    )}>
                      {isRTL ? 'النص بالعربي' : 'Arabic Text'}
                    </label>
                    <Textarea
                      value={(block as TextBlock).textAr}
                      onChange={(e) => updateBlock(block.id, { textAr: e.target.value })}
                      placeholder={isRTL ? 'اكتب الشرح بالعربي هنا...' : 'Write Arabic explanation...'}
                      className={cn("min-h-[80px]", isRTL && "text-right font-cairo")}
                      dir="rtl"
                    />
                  </div>
                  <div>
                    <label className={cn(
                      "text-sm font-medium mb-1 block",
                      isRTL && "text-right font-cairo"
                    )}>
                      {isRTL ? 'المصطلح بالفرنسي' : 'French Term'}
                    </label>
                    <Input
                      value={(block as TextBlock).termFr}
                      onChange={(e) => updateBlock(block.id, { termFr: e.target.value })}
                      placeholder={isRTL ? 'المصطلح الفرنسي...' : 'French term...'}
                      dir="ltr"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Hidden file input */}
                  <input
                    type="file"
                    accept="image/*"
                    ref={(el) => { fileInputRefs.current[block.id] = el; }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(block.id, file);
                    }}
                    className="hidden"
                  />
                  
                  {/* Upload Button */}
                  <div>
                    <label className={cn(
                      "text-sm font-medium mb-1 block",
                      isRTL && "text-right font-cairo"
                    )}>
                      {isRTL ? 'رفع صورة' : 'Upload Image'}
                    </label>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => triggerFileInput(block.id)}
                      disabled={uploadingBlockId === block.id}
                      className={cn("w-full gap-2", isRTL && "flex-row-reverse font-cairo")}
                    >
                      {uploadingBlockId === block.id ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {isRTL ? 'جاري الرفع...' : 'Uploading...'}
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          {isRTL ? 'اختر صورة للرفع' : 'Choose image to upload'}
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Or enter URL manually */}
                  <div>
                    <label className={cn(
                      "text-sm font-medium mb-1 block text-muted-foreground",
                      isRTL && "text-right font-cairo"
                    )}>
                      {isRTL ? 'أو أدخل رابط الصورة' : 'Or enter image URL'}
                    </label>
                    <Input
                      value={(block as ImageBlock).imageUrl}
                      onChange={(e) => updateBlock(block.id, { imageUrl: e.target.value })}
                      placeholder="https://example.com/image.jpg"
                      dir="ltr"
                    />
                  </div>
                  
                  <div>
                    <label className={cn(
                      "text-sm font-medium mb-1 block",
                      isRTL && "text-right font-cairo"
                    )}>
                      {isRTL ? 'تعليق الصورة' : 'Caption'}
                    </label>
                    <Input
                      value={(block as ImageBlock).caption || ''}
                      onChange={(e) => updateBlock(block.id, { caption: e.target.value })}
                      placeholder={isRTL ? 'وصف الصورة...' : 'Image caption...'}
                      className={cn(isRTL && "text-right font-cairo")}
                      dir={isRTL ? "rtl" : "ltr"}
                    />
                  </div>
                  
                  {/* Image Preview */}
                  {(block as ImageBlock).imageUrl && (
                    <div className="mt-2">
                      <img
                        src={(block as ImageBlock).imageUrl}
                        alt="Preview"
                        className="max-w-[200px] h-auto rounded-lg border"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {localBlocks.length === 0 && (
          <div className={cn(
            "text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg",
            isRTL && "font-cairo"
          )}>
            <Plus className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>{isRTL ? 'اضغط على الأزرار أعلاه لإضافة محتوى' : 'Click buttons above to add content'}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContentBlockEditor;
