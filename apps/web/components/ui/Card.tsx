interface Props extends React.HTMLAttributes<HTMLElement> {
  as?: "div" | "section" | "article";
  padded?: boolean;
}

export default function Card({ as: Tag = "div", padded = true, className = "", children, ...rest }: Props) {
  return (
    <Tag
      className={`rounded-card border border-line bg-paper-raised shadow-card ${padded ? "p-5 sm:p-6" : ""} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}
