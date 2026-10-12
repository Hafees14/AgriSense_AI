interface Props {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export default function EmptyState({ title, description, action }: Props) {
  return (
    <div className="rounded-card border border-dashed border-line bg-paper-raised px-6 py-12 text-center">
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      {description && <p className="mx-auto mt-2 max-w-md text-ink-soft">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
