import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-line bg-paper-raised">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 sm:grid-cols-3">
          <div>
            <p className="font-display text-lg font-semibold text-ink">AgriSense AI</p>
            <p className="mt-2 text-sm text-ink-soft">
              AI-powered crop diagnosis and outbreak alerts for smallholder farmers in Sri Lanka.
            </p>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-ink">Navigate</p>
            <ul className="space-y-1.5 text-sm text-ink-soft">
              <li>
                <Link href="/dashboard" className="hover:text-primary">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/diagnose" className="hover:text-primary">
                  Diagnose
                </Link>
              </li>
              <li>
                <Link href="/outbreaks" className="hover:text-primary">
                  Outbreaks
                </Link>
              </li>
              <li>
                <Link href="/chat" className="hover:text-primary">
                  AI Agent
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-ink">Support</p>
            <ul className="space-y-1.5 text-sm text-ink-soft">
              <li>
                <Link href="/contact" className="hover:text-primary">
                  Contact us
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-line pt-6 text-xs text-ink-soft">
          <p>© {year} AgriSense AI. All rights reserved.</p>
          <p className="mt-1">
            Map data by{" "}
            <a href="https://www.openstreetmap.org/copyright" className="hover:text-primary" target="_blank" rel="noreferrer">
              OpenStreetMap
            </a>{" "}
            contributors.
          </p>
        </div>
      </div>
    </footer>
  );
}