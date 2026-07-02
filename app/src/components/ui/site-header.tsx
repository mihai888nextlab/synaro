"use client";

import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Cloud, Menu, ShieldCheck, Waypoints, X } from "lucide-react";
import { useState } from "react";

import { useTranslation } from "@/components/ui/locale-provider";
import { SynaroLogo } from "@/components/ui/synaro-logo";

type DropdownCard = {
  title: string;
  image: string;
};

type DropdownData = {
  key: string;
  label: string;
  links: {
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    href?: string;
  }[];
  cards: DropdownCard[];
};

const dropdowns: DropdownData[] = [
  {
    key: "features",
    label: "Features",
    links: [
      { title: "Infrastructure API", icon: Cloud },
      { title: "Secure Workflows", icon: ShieldCheck },
      { title: "Runtime Operations", icon: Waypoints },
      { title: "Templates", icon: Cloud },
      { title: "Broadcasts", icon: Waypoints },
    ],
    cards: [
      {
        title: "Transactional emails",
        image:
          "https://images.unsplash.com/photo-1518773553398-650c184e0bb3?auto=format&fit=crop&w=600&q=80",
      },
      {
        title: "Marketing emails",
        image:
          "https://images.unsplash.com/photo-1461749280684-dccba630e2f6?auto=format&fit=crop&w=600&q=80",
      },
    ],
  },
  {
    key: "resources",
    label: "Resources",
    links: [
      { title: "Documentation", icon: Cloud, href: "/documentation" },
      { title: "Guides", icon: ShieldCheck },
      { title: "Status", icon: Waypoints },
      { title: "Changelog", icon: Cloud },
      { title: "Community", icon: Waypoints },
    ],
    cards: [
      {
        title: "API overview",
        image:
          "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=600&q=80",
      },
      {
        title: "Playground",
        image:
          "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80",
      },
    ],
  },
  {
    key: "company",
    label: "Company",
    links: [
      { title: "About", icon: Cloud },
      { title: "Careers", icon: ShieldCheck },
      { title: "Customers", icon: Waypoints },
      { title: "Partners", icon: Cloud },
      { title: "Press", icon: Waypoints },
    ],
    cards: [
      {
        title: "Case studies",
        image:
          "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=600&q=80",
      },
      {
        title: "Team updates",
        image:
          "https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=600&q=80",
      },
    ],
  },
];

export function SiteHeader() {
  const { t } = useTranslation();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeMobileMenu, setActiveMobileMenu] = useState<string | null>(null);

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-black/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6 lg:gap-10">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-white transition-opacity hover:opacity-90"
          >
            <SynaroLogo className="h-7 w-auto shrink-0 text-white" />
            <span className="text-lg font-semibold tracking-tight">Synaro</span>
          </Link>

          <nav className="hidden items-center gap-5 lg:flex">
            {dropdowns.map((menu) => (
              <div
                key={menu.key}
                className="relative"
                onMouseEnter={() => setActiveMenu(menu.key)}
                onMouseLeave={() => setActiveMenu((current) => (current === menu.key ? null : current))}
              >
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-sm font-medium text-zinc-300 transition hover:text-white"
                >
                  {menu.label}
                  <ChevronDown className="size-3.5" />
                </button>

                {activeMenu === menu.key && (
                  <div className="absolute left-1/2 top-full z-50 w-[470px] -translate-x-1/2 pt-2">
                    <div className="rounded-2xl border border-white/10 bg-[#0c0c0d] p-3 shadow-[0_20px_60px_rgba(0,0,0,0.65)]">
                    <div className="grid grid-cols-[1fr_208px] gap-3">
                      <div className="rounded-xl border border-white/6 bg-black/30 p-3">
                        <div className="flex flex-col gap-1">
                          {menu.links.map((item) =>
                            item.href ? (
                              <Link
                                key={item.title}
                                href={item.href}
                                className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-300 transition hover:bg-white/[0.04] hover:text-white"
                              >
                                <item.icon className="size-3.5 text-zinc-400" />
                                {item.title}
                              </Link>
                            ) : (
                              <a
                                key={item.title}
                                href="#"
                                className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-zinc-300 transition hover:bg-white/[0.04] hover:text-white"
                              >
                                <item.icon className="size-3.5 text-zinc-400" />
                                {item.title}
                              </a>
                            ),
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {menu.cards.map((card) => (
                          <a
                            key={card.title}
                            href="#"
                            className="group relative overflow-hidden rounded-xl border border-white/10 bg-zinc-900"
                          >
                            <div className="relative h-[122px] w-full">
                              <Image
                                src={card.image}
                                alt={card.title}
                                fill
                                className="object-cover transition duration-300 group-hover:scale-105"
                              />
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />
                            <p className="absolute bottom-2 left-2 pr-2 text-xs leading-tight text-white">
                              {card.title}
                            </p>
                          </a>
                        ))}
                      </div>
                    </div>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <Link href="/documentation" className="text-sm font-medium text-zinc-300 transition hover:text-white">
              Docs
            </Link>
            <Link href="/pricing" className="text-sm font-medium text-zinc-300 transition hover:text-white">
              Pricing
            </Link>
          </nav>
        </div>

        <div className="hidden items-center gap-3 lg:flex">
          <Link href="/login" className="text-sm font-medium text-zinc-300 transition hover:text-white">
            Log in
          </Link>
          <Link
            href="/signup"
            className="rounded-full border border-white/15 bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200"
          >
            Get started
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          className="inline-flex size-9 items-center justify-center rounded-md border border-white/15 text-zinc-200 lg:hidden"
          aria-label={t("a11y.toggleMenu")}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="size-4" /> : <Menu className="size-4" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-white/10 bg-black/98 lg:hidden">
          <div className="max-h-[calc(100dvh-3.5rem)] overflow-y-auto px-4 pb-6 pt-3">
            <Link
              href="/"
              onClick={() => setMobileOpen(false)}
              className="mb-4 inline-flex items-center gap-2 text-white transition-opacity hover:opacity-90"
            >
              <SynaroLogo className="h-7 w-auto shrink-0 text-white" />
              <span className="text-lg font-semibold tracking-tight">Synaro</span>
            </Link>
            <div className="rounded-2xl border border-white/10 bg-[#0c0c0d] p-3">
              <div className="flex flex-col">
                {dropdowns.map((menu) => {
                  const isOpen = activeMobileMenu === menu.key;
                  return (
                    <div key={menu.key} className="border-b border-white/10 last:border-b-0">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveMobileMenu((current) =>
                            current === menu.key ? null : menu.key,
                          )
                        }
                        className="flex w-full items-center justify-between py-3 text-left text-base font-medium text-white"
                      >
                        {menu.label}
                        <ChevronDown
                          className={`size-4 text-zinc-400 transition ${isOpen ? "rotate-180" : ""}`}
                        />
                      </button>
                      {isOpen && (
                        <div className="pb-4">
                          <div className="flex flex-col gap-1">
                            {menu.links.map((item) =>
                              item.href ? (
                                <Link
                                  key={item.title}
                                  href={item.href}
                                  onClick={() => setMobileOpen(false)}
                                  className="inline-flex items-center gap-2 rounded-md px-2 py-2 text-sm text-zinc-300 transition hover:bg-white/[0.04] hover:text-white"
                                >
                                  <item.icon className="size-3.5 text-zinc-400" />
                                  {item.title}
                                </Link>
                              ) : (
                                <a
                                  key={item.title}
                                  href="#"
                                  onClick={() => setMobileOpen(false)}
                                  className="inline-flex items-center gap-2 rounded-md px-2 py-2 text-sm text-zinc-300 transition hover:bg-white/[0.04] hover:text-white"
                                >
                                  <item.icon className="size-3.5 text-zinc-400" />
                                  {item.title}
                                </a>
                              ),
                            )}
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-2">
                            {menu.cards.map((card) => (
                              <a
                                key={card.title}
                                href="#"
                                onClick={() => setMobileOpen(false)}
                                className="group relative overflow-hidden rounded-lg border border-white/10 bg-zinc-900"
                              >
                                <div className="relative h-24 w-full">
                                  <Image
                                    src={card.image}
                                    alt={card.title}
                                    fill
                                    className="object-cover"
                                  />
                                </div>
                                <div className="absolute inset-0 bg-gradient-to-t from-black/85 to-transparent" />
                                <p className="absolute bottom-2 left-2 pr-1 text-[11px] text-white">
                                  {card.title}
                                </p>
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-3">
            <Link
              href="/documentation"
              onClick={() => setMobileOpen(false)}
              className="text-sm font-medium text-zinc-200"
            >
              Docs
            </Link>
            <Link
              href="/pricing"
              onClick={() => setMobileOpen(false)}
              className="text-sm font-medium text-zinc-200"
            >
              Pricing
            </Link>
            </div>

            <div className="mt-6 flex gap-3">
              <Link
                href="/login"
                onClick={() => setMobileOpen(false)}
                className="flex-1 rounded-full border border-white/20 px-4 py-2.5 text-center text-sm font-medium text-white"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                onClick={() => setMobileOpen(false)}
                className="flex-1 rounded-full bg-white px-4 py-2.5 text-center text-sm font-medium text-black"
              >
                Get started
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
