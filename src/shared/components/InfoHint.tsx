interface InfoHintProps {
  /** Explanation shown on hover, keyboard focus, or tap. */
  text: string
  /** Accessible name for the trigger, e.g. "About check-in date". Defaults to the text. */
  label?: string
  className?: string
}

/** Small "i" badge placed next to a label or heading to explain it. Rendered by TooltipLayer. */
export function InfoHint({ text, label, className = '' }: InfoHintProps) {
  return (
    <button
      type="button"
      aria-label={label ?? text}
      data-tooltip={text}
      data-tooltip-tap=""
      className={`inline-grid h-4 w-4 shrink-0 cursor-help place-items-center rounded-full border border-[#C9C9C6] align-middle text-[10px] font-bold leading-none text-[#787774] transition-colors hover:border-[#1A1A1A] hover:text-[#1A1A1A] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A1A1A] ${className}`}
      // Inside a <label>, a click would otherwise focus/toggle the associated control.
      onClick={(event) => event.preventDefault()}
    >
      i
    </button>
  )
}
