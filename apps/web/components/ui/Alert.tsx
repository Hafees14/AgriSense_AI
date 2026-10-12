type Tone = "error" | "success" | "info";

const TONES: Record<Tone, { box: string; icon: string }> = {
  error: { box: "border-chili bg-chili-50 text-chili-dark", icon: "!" },
  success: { box: "border-primary bg-primary-50 text-primary-dark", icon: "✓" },
  info: { box: "border-monsoon bg-monsoon-50 text-monsoon-dark", icon: "i" },
};

/** Inline message. Icon + border carry the tone as well as colour. Errors are announced immediately. */
export default function Alert({ tone = "error", children }: { tone?: Tone; children: React.ReactNode }) {
  const s = TONES[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-control border px-4 py-3 text-sm font-medium ${s.box}`}
    >
      <span aria-hidden="true" className="font-bold">
        {s.icon}
      </span>
      <p className="flex-1">{children}</p>
    </div>
  );
}
