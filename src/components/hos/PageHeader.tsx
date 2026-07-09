export function PageHeader({
  eyebrow,
  title,
  intro,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
}) {
  return (
    <header>
      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
        {eyebrow}
      </div>
      <h1 className="mt-2 font-display text-4xl md:text-5xl">{title}</h1>
      {intro && (
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          {intro}
        </p>
      )}
    </header>
  );
}
