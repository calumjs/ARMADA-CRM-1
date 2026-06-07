export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6">
      <h1 className="font-display text-3xl font-bold tracking-tight">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-1 text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
  );
}
