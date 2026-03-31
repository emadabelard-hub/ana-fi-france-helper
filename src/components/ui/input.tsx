import * as React from "react";
import { cn } from "@/lib/utils";
import VoiceInputButton from "@/components/shared/VoiceInputButton";
import type { VoiceResult } from "@/hooks/useFieldVoice";

export interface InputProps extends React.ComponentProps<"input"> {
  /** Set to false to hide the voice input button. Defaults to true. */
  enableVoice?: boolean;
  /** Called with both French + raw transcription for dual-field UIs */
  onVoiceDual?: (result: VoiceResult) => void;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, style, enableVoice = true, onChange, onVoiceDual, ...props }, ref) => {
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    const mergedRef = React.useCallback(
      (node: HTMLInputElement | null) => {
        inputRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
      },
      [ref],
    );

    const handleVoiceResult = React.useCallback(
      (text: string) => {
        const el = inputRef.current;
        if (!el) return;
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          'value',
        )?.set;
        const prev = el.value;
        const separator = prev && !prev.endsWith(' ') ? ' ' : '';
        nativeInputValueSetter?.call(el, prev + separator + text);
        el.dispatchEvent(new Event('input', { bubbles: true }));
      },
      [],
    );

    const showVoice =
      enableVoice &&
      type !== 'password' &&
      type !== 'email' &&
      type !== 'number' &&
      type !== 'tel' &&
      type !== 'date' &&
      type !== 'file' &&
      type !== 'hidden' &&
      type !== 'color' &&
      !props.readOnly &&
      !props.disabled;

    return (
      <div className="relative w-full">
        <input
          type={type}
          className={cn(
            "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-base file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
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
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
            <VoiceInputButton onResult={handleVoiceResult} onDualResult={onVoiceDual} />
          </div>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

export { Input };
