import Link from "next/link";
import { InstagramIcon, LinkedinIcon } from "lucide-react";

const NAV_LINKS = [
  { title: "Features", href: "/features" },
  { title: "Documentation", href: "/documentation" },
  { title: "About", href: "/about" },
  { title: "Contact", href: "/contact" },
] as const;

const SOCIAL_LINKS = [
  {
    label: "LinkedIn",
    href: "https://www.linkedin.com/company/synarotech",
    icon: LinkedinIcon,
  },
  {
    label: "Instagram",
    href: "https://www.instagram.com/synaro.tech/",
    icon: InstagramIcon,
  },
] as const;

export function MinimalFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-8 border-t border-white/10">
      <div className="mx-auto flex min-h-[8.5rem] max-w-6xl items-center px-4 py-12 sm:min-h-[7.5rem] sm:px-6 sm:py-10">
        <div className="grid w-full grid-cols-1 items-center justify-items-center gap-5 sm:grid-cols-[1fr_auto_1fr] sm:justify-items-stretch sm:gap-4">
          <p className="self-center text-xs text-zinc-600 sm:justify-self-start">
            © {year} Synaro
          </p>

          <nav
            className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2"
            aria-label="Footer"
          >
            {NAV_LINKS.map(({ href, title }) => (
              <Link
                key={href}
                href={href}
                className="text-sm text-zinc-400 transition hover:text-white"
              >
                {title}
              </Link>
            ))}
          </nav>

          <div className="flex items-center justify-center gap-3 self-center sm:justify-self-end">
            {SOCIAL_LINKS.map(({ href, icon: Icon, label }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="text-zinc-500 transition hover:text-white"
              >
                <Icon className="size-4" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
