"use client";

import Image from "next/image";
import { Github } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

type FounderCardProps = {
  name: string;
  role: string;
  bio: string;
  github: string;
  photoSrc: string;
  initials: string;
  className?: string;
};

export function FounderCard({
  name,
  role,
  bio,
  github,
  photoSrc,
  initials,
  className,
}: FounderCardProps) {
  const [photoError, setPhotoError] = useState(false);

  return (
    <article
      className={cn(
        "flex flex-col rounded-2xl border border-white/10 bg-zinc-950/80 p-5 sm:p-6",
        className,
      )}
    >
      <div className="relative mx-auto size-28 overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 sm:size-32">
        {!photoError ? (
          <Image
            src={photoSrc}
            alt={name}
            fill
            className="object-cover"
            sizes="128px"
            onError={() => setPhotoError(true)}
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-950 text-2xl font-semibold text-zinc-300">
            {initials}
          </div>
        )}
      </div>

      <div className="mt-5 text-center">
        <h3 className="text-lg font-semibold text-white">{name}</h3>
        <p className="mt-1 text-sm text-amber-200/90">{role}</p>
        <p className="mt-3 text-sm leading-relaxed text-zinc-400">{bio}</p>
      </div>

      <a
        href={github}
        target="_blank"
        rel="noreferrer"
        className="mt-5 inline-flex items-center justify-center gap-2 self-center rounded-full border border-white/15 px-4 py-2 text-sm text-zinc-300 transition hover:border-white/30 hover:bg-white/5 hover:text-white"
        aria-label={`${name} on GitHub`}
      >
        <Github className="size-4" />
        GitHub
      </a>
    </article>
  );
}
