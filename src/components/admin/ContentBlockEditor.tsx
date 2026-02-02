import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Type, Image, Trash2, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ContentBlock, TextBlock, ImageBlock } from '@/types/lessons';

interface ContentBlockEditorProps {
  blocks: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
  isRTL?: boolean;
}

const ContentBlockEditor = ({ blocks, onChange, isRTL = true }: ContentBlockEditorProps) => {
  const generateId = () => `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const addTextBlock = () => {
    const newBlock: TextBlock = {
      type: 'text',
      id: generateId(),
      textAr: '',
      termFr: '',
    };
    onChange([...blocks, newBlock]);
  };

  const addImageBlock = () => {
    const newBlock: ImageBlock = {
      type: 'image',
      id: generateId(),
      imageUrl: '',
      caption: '',
    };
    onChange([...blocks, newBlock]);
  };

  const updateBlock = (id: string, updates: Partial<TextBlock> | Partial<ImageBlock>) => {
    onChange(blocks.map(block => {
      if (block.id !== id) return block;
      if (block.type === 'text') {
        return { ...block, ...updates } as TextBlock;
      } else {
        return { ...block, ...updates } as ImageBlock;
      }
    }));
  };

  const removeBlock = (id: string) => {
    onChange(blocks.filter(block => block.id !== id));
  };

  const moveBlock = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= blocks.length) return;
    const newBlocks = [...blocks];
    const [removed] = newBlocks.splice(fromIndex, 1);
    newBlocks.splice(toIndex, 0, removed);
    onChange(newBlocks);
  };

  return (
    <div className="space-y-4">
      {/* Add Block Buttons */}
      <div className={cn("flex gap-2", isRTL && "flex-row-reverse")}>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addTextBlock}
          className={cn("gap-2", isRTL && "flex-row-reverse font-cairo")}
        >
          <Type className="h-4 w-4" />
          {isRTL ? 'أضف نص' : 'Add Text Block'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addImageBlock}
          className={cn("gap-2", isRTL && "flex-row-reverse font-cairo")}
        >
          <Image className="h-4 w-4" />
          {isRTL ? 'أضف صورة' : 'Add Image Block'}
        </Button>
      </div>

      {/* Blocks List */}
      <div className="space-y-3">
        {blocks.map((block, index) => (
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
                    disabled={index === blocks.length - 1}
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
                  <div>
                    <label className={cn(
                      "text-sm font-medium mb-1 block",
                      isRTL && "text-right font-cairo"
                    )}>
                      {isRTL ? 'رابط الصورة' : 'Image URL'}
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

        {blocks.length === 0 && (
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
