import Card from "@/components/ui/Card";

interface Props {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/** Shared shell for login/register. Uses <section>: the root layout already provides <main id="main">. */
export default function AuthCard({ title, subtitle, children, footer }: Props) {
  return (
    <section className="mx-auto w-full max-w-md px-4 py-10 sm:py-16">
      <Card className="sm:p-8">
        <h1 className="text-2xl font-semibold text-primary-dark sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1.5 text-ink-soft">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </Card>
      {footer && <p className="mt-5 text-center text-ink-soft">{footer}</p>}
    </section>
  );
}
