'use client'

interface ContactTypeSelectorProps {
  selected: string
  companyLabel: string
  individualLabel: string
  typeLabel: string
  onChange: (value: string) => void
}

export function ContactTypeSelector({ selected, companyLabel, individualLabel, typeLabel, onChange }: ContactTypeSelectorProps) {
  return (
    <div className="mt-6">
      <label className="mb-2 block text-sm font-medium text-[#333333]">{typeLabel}</label>
      <div className="flex gap-2">
        {(['company', 'individual'] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => onChange(type)}
            className={`rounded-xl px-4 py-2 text-sm font-bold transition-all duration-200 ${
              selected === type
                ? 'bg-black text-white'
                : 'bg-[#F5F5F5] text-[#555555] hover:bg-accent/10'
            }`}
          >
            {type === 'company' ? companyLabel : individualLabel}
          </button>
        ))}
      </div>
    </div>
  )
}
