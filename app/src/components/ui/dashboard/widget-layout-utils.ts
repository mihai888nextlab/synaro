import { cn } from "@/lib/utils";

export type WidgetLayoutMode = "grid" | "fluid";

/** Root wrapper classes: grid fills the cell; fluid sizes to natural content (edit mode). */
export function widgetRootClass(mode: WidgetLayoutMode, preview?: boolean) {
  return cn(
    mode === "grid" ? "h-full min-h-0" : "h-auto",
    preview && "pointer-events-none overflow-hidden",
  );
}

export function widgetChildClass(mode: WidgetLayoutMode, className?: string) {
  return cn(mode === "grid" ? "h-full" : "h-auto", className);
}

export function showcaseSectionClass(mode: WidgetLayoutMode, className?: string) {
  return cn(
    "flex flex-col rounded-2xl border-0 bg-muted/15 shadow-none dark:bg-muted/10",
    mode === "grid" ? "overflow-hidden" : "overflow-visible",
    className,
  );
}
