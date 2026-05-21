import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Outline action for dashboard section headers — icon squircle on mobile, text from `sm` up. */
export function DashboardSectionLink({
  href,
  label,
  className,
}: {
  href: string;
  label: string;
  className?: string;
}) {
  return (
    <Button
      variant="outline"
      size="icon"
      className={cn(
        "size-9 shrink-0 rounded-xl border-border/70 text-muted-foreground",
        "sm:size-auto sm:h-8 sm:min-w-0 sm:rounded-xl sm:px-3 sm:text-xs",
        className,
      )}
      asChild
    >
      <Link href={href} aria-label={label} className="inline-flex items-center justify-center gap-1.5">
        <ArrowRight className="size-4 sm:hidden" aria-hidden />
        <span className="hidden sm:inline">{label}</span>
      </Link>
    </Button>
  );
}
