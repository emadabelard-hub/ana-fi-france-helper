import React from 'react';
import { X, FileText, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

export interface AttachedDocument {
  id: string;
  data: string;
  type: 'image' | 'pdf';
  name: string;
  timestamp: number;
}

interface AttachedDocumentsProps {
  documents: AttachedDocument[];
  onRemove: (id: string) => void;
  isRTL?: boolean;
  disabled?: boolean;
}

const AttachedDocuments = ({ documents, onRemove, isRTL = true, disabled = false }: AttachedDocumentsProps) => {
  if (documents.length === 0) return null;

  return (
    <div className={cn(
      "px-2 py-1.5 bg-muted/30 border-b",
      isRTL && "font-cairo"
    )}>
      <div className={cn(
        "flex items-center gap-2 mb-1",
        isRTL && "flex-row-reverse"
      )}>
        <span className="text-xs font-medium text-muted-foreground">
          {isRTL ? `📂 ملفات الملف (${documents.length})` : `📂 Dossier (${documents.length})`}
        </span>
      </div>
      
      <ScrollArea className="w-full whitespace-nowrap">
        <div className={cn(
          "flex gap-2",
          isRTL && "flex-row-reverse"
        )}>
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="relative group flex-shrink-0"
            >
              {doc.type === 'image' ? (
                <div className="relative w-14 h-14 rounded-lg overflow-hidden border-2 border-background shadow-sm">
                  <img
                    src={doc.data}
                    alt={doc.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                </div>
              ) : (
                <div className="w-14 h-14 rounded-lg border-2 border-background shadow-sm bg-background flex flex-col items-center justify-center">
                  <FileText className="h-5 w-5 text-destructive" />
                  <span className="text-[8px] text-muted-foreground mt-0.5 truncate max-w-[48px]">
                    PDF
                  </span>
                </div>
              )}
              
              {/* Remove button */}
              {!disabled && (
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => onRemove(doc.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
              
              {/* Document number badge */}
              <div className="absolute -bottom-1 -left-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shadow-sm">
                {documents.indexOf(doc) + 1}
              </div>
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="h-2" />
      </ScrollArea>
    </div>
  );
};

export default AttachedDocuments;
