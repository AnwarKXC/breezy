interface ModulePlaceholderProps {
  description: string;
  title: string;
}

export function ModulePlaceholder({ description, title }: ModulePlaceholderProps) {
  return (
    <section className="flex w-full flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-[#1A1A1A]">
          {title}
        </h1>
        <p className="mt-1 text-sm font-medium text-[#787774]">{description}</p>
      </header>
      <div className="rounded-xl border border-[#EAEAEA] bg-white p-8 text-sm text-[#787774]">
        {description}
      </div>
    </section>
  );
}

