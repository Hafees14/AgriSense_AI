/** Table shell: scrolls horizontally inside its own container so the page never overflows. */
export function Table({ children, caption }: { children: React.ReactNode; caption: string }) {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-paper-raised shadow-card">
      <table className="w-full min-w-[32rem] border-collapse text-left text-[0.95rem]">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th scope="col" className={`border-b border-line bg-primary-50 px-4 py-3 text-sm font-semibold text-primary-dark ${className}`}>
      {children}
    </th>
  );
}

export function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={`border-b border-line/70 px-4 py-3 align-top last:border-b-0 ${className}`}>{children}</td>;
}
