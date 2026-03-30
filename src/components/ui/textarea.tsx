import * as React from "react";
import { cn } from "@/lib/utils";
import VoiceInputButton from "@/components/shared/VoiceInputButton";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Set to false to hide the voice input button. Defaults to true. */
  enableVoice?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, style, enableVoice = true, onChange, ...props }, ref) => {
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

    const mergedRef = React.useCallback(
      (node: HTMLTextAreaElement | null) => {
        textareaRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
      },
      [ref],
    );

    const handleVoiceResult = React.useCallback(
      (text: string) => {
        const el = textareaRef.current;
        if (!el) return;
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          'value',
        )?.set;
        const prev = el.value;
        const separator = prev && !prev.endsWith(' ') ? ' ' : '';
        nativeInputValueSetter?.call(el, prev + separator + text);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      },
      [],
    );

    const showVoice = enableVoice && !props.readOnly && !props.disabled;

    return (
      <div className="relative w-full">
        <textarea
          className={cn(
            "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            showVoice && "pr-9",
            className,
            "!text-base",
          )}
          style={{ ...(style ?? {}), fontSize: "16px" }}
          ref={mergedRef}
          onChange={onChange}
          {...props}
        />
        {showVoice && (
          <div className="absolute right-1.5 top-2">
            <VoiceInputButton onResult={handleVoiceResult} />
          </div>
        )}
      </div>
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
