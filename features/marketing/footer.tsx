import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-ink-400">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-3 px-6 py-8 text-meta text-fg-200 sm:flex-row sm:justify-between sm:px-10">
        <span>© {new Date().getFullYear()} KILN</span>
        <div className="flex items-center gap-4">
          <Link href="/login" className="transition-instant hover:text-fg-000">
            Sign in
          </Link>
          <Link href="/signup" className="transition-instant hover:text-fg-000">
            Sign up
          </Link>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
