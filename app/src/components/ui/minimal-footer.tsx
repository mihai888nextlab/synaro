import Link from "next/link";
import {
  FacebookIcon,
  GithubIcon,
  Grid2X2Plus,
  InstagramIcon,
  LinkedinIcon,
  TwitterIcon,
  YoutubeIcon,
} from "lucide-react";

export function MinimalFooter() {
  const year = new Date().getFullYear();

  const company = [
    { title: "About Us", href: "#" },
    { title: "Careers", href: "#" },
    { title: "Brand assets", href: "#" },
    { title: "Privacy Policy", href: "#" },
    { title: "Terms of Service", href: "#" },
  ];

  const resources = [
    { title: "Blog", href: "#" },
    { title: "Help Center", href: "#" },
    { title: "Contact Support", href: "#" },
    { title: "Community", href: "#" },
    { title: "Security", href: "#" },
  ];

  const socialLinks = [
    { icon: <FacebookIcon className="size-4" />, link: "#" },
    { icon: <GithubIcon className="size-4" />, link: "#" },
    { icon: <InstagramIcon className="size-4" />, link: "#" },
    { icon: <LinkedinIcon className="size-4" />, link: "#" },
    { icon: <TwitterIcon className="size-4" />, link: "#" },
    { icon: <YoutubeIcon className="size-4" />, link: "#" },
  ];

  return (
    <footer className="relative mt-8 border-t border-white/10 bg-black/50">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="relative bg-[radial-gradient(35%_80%_at_30%_0%,rgba(255,255,255,0.08),transparent)] py-8">
          <div className="grid grid-cols-6 gap-6">
            <div className="col-span-6 flex flex-col gap-5 md:col-span-4">
              <Link href="/" className="w-max text-white/80 transition hover:text-white">
                <Grid2X2Plus className="size-8" />
              </Link>
              <p className="max-w-sm text-sm text-zinc-400">
                Synaro is a cloud infrastructure platform for modern B2B teams.
              </p>
              <div className="flex flex-wrap gap-2">
                {socialLinks.map((item, i) => (
                  <a
                    key={i}
                    className="rounded-md border border-white/15 p-1.5 text-zinc-300 transition hover:bg-white/10 hover:text-white"
                    target="_blank"
                    rel="noreferrer"
                    href={item.link}
                  >
                    {item.icon}
                  </a>
                ))}
              </div>
            </div>
            <div className="col-span-3 w-full md:col-span-1">
              <span className="mb-2 block text-xs uppercase tracking-[0.15em] text-zinc-500">
                Resources
              </span>
              <div className="flex flex-col gap-1">
                {resources.map(({ href, title }, i) => (
                  <a
                    key={i}
                    className="w-max py-1 text-sm text-zinc-300 transition hover:text-white hover:underline"
                    href={href}
                  >
                    {title}
                  </a>
                ))}
              </div>
            </div>
            <div className="col-span-3 w-full md:col-span-1">
              <span className="mb-2 block text-xs uppercase tracking-[0.15em] text-zinc-500">
                Company
              </span>
              <div className="flex flex-col gap-1">
                {company.map(({ href, title }, i) => (
                  <a
                    key={i}
                    className="w-max py-1 text-sm text-zinc-300 transition hover:text-white hover:underline"
                    href={href}
                  >
                    {title}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pb-6 pt-3">
          <p className="text-center text-sm text-zinc-500">
            © Synaro Labs. All rights reserved {year}
          </p>
        </div>
      </div>
    </footer>
  );
}
