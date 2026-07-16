"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pencil, Plus, RotateCcw } from "lucide-react";

import { DashboardGrid } from "@/components/ui/dashboard/dashboard-grid";
import { DashboardMobileMonitor } from "@/components/ui/dashboard/dashboard-mobile-monitor";
import { DashboardWidgetPicker } from "@/components/ui/dashboard/dashboard-widget-picker";
import { useTranslation } from "@/components/ui/locale-provider";
import type { DashboardLayout, DashboardPageData } from "@/lib/dashboard/layout-schema";
import type { PendingWidgetDrag } from "@/lib/dashboard/widget-drag";
import { Button } from "@/components/ui/button";

type DashboardPageClientProps = DashboardPageData & {
  initialLayout: DashboardLayout;
  isDefaultLayout: boolean;
};

async function persistLayout(layout: DashboardLayout): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/account/dashboard-layout", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(layout),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      return { ok: false, error: body?.error ?? `Save failed (${res.status})` };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not reach the server" };
  }
}

export function DashboardPageClient({
  initialLayout,
  isDefaultLayout,
  ...data
}: DashboardPageClientProps) {
  const { t } = useTranslation();
  const [layout, setLayout] = useState<DashboardLayout>(initialLayout);
  const [editMode, setEditMode] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingWidgetDrag, setPendingWidgetDrag] = useState<PendingWidgetDrag | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isDefault, setIsDefault] = useState(isDefaultLayout);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const scheduleSave = useCallback((next: DashboardLayout) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void (async () => {
        setSaving(true);
        setSaveError(null);
        const result = await persistLayout(next);
        if (result.ok) setIsDefault(false);
        else setSaveError(result.error);
        setSaving(false);
      })();
    }, 500);
  }, []);

  const handleLayoutChange = useCallback(
    (next: DashboardLayout) => {
      setLayout(next);
      if (editMode) scheduleSave(next);
    },
    [editMode, scheduleSave],
  );

  useEffect(
    () => () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    },
    [],
  );

  const finishEditing = async () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    setSaving(true);
    setSaveError(null);
    const result = await persistLayout(layoutRef.current);
    if (result.ok) {
      setIsDefault(false);
      setEditMode(false);
    } else {
      setSaveError(result.error);
    }
    setSaving(false);
  };

  const resetLayout = async () => {
    const res = await fetch("/api/account/dashboard-layout?reset=1", { method: "POST" });
    if (!res.ok) return;
    const body = (await res.json()) as { layout: DashboardLayout };
    setLayout(body.layout);
    setIsDefault(true);
    setEditMode(false);
  };

  return (
    <div className="mx-auto flex w-full min-w-0 max-w-7xl flex-col gap-4 sm:gap-6">
      <h1 className="sr-only">{t("nav.dashboard")}</h1>
      {/* Mobile: read-only monitoring stack — desktop grid is unchanged below */}
      <div className="md:hidden">
        <DashboardMobileMonitor layout={layout} data={data} />
      </div>

      <div className="hidden md:contents">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            {editMode ? (
              <p className="text-sm font-medium text-foreground">{t("dashboard.customizeTitle")}</p>
            ) : null}
            {editMode ? (
              <p className="text-xs text-muted-foreground">{t("dashboard.resizeHint")}</p>
            ) : null}
            {saving ? <p className="text-xs text-muted-foreground">{t("common.saving")}</p> : null}
            {saveError ? <p className="text-xs text-destructive">{saveError}</p> : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {editMode ? (
              <>
                <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
                  <Plus className="size-4" aria-hidden />
                  {t("dashboard.addWidget")}
                </Button>
                {!isDefault ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => void resetLayout()}>
                    <RotateCcw className="size-4" aria-hidden />
                    {t("dashboard.reset")}
                  </Button>
                ) : null}
                <Button type="button" size="sm" onClick={() => void finishEditing()}>
                  {t("dashboard.done")}
                </Button>
              </>
            ) : (
              <Button type="button" variant="outline" size="sm" onClick={() => setEditMode(true)}>
                <Pencil className="size-4" aria-hidden />
                {t("dashboard.edit")}
              </Button>
            )}
          </div>
        </div>

        <DashboardGrid
          layout={layout}
          data={data}
          editMode={editMode}
          pendingWidgetDrag={pendingWidgetDrag}
          onPendingWidgetDragEnd={() => setPendingWidgetDrag(null)}
          onLayoutChange={handleLayoutChange}
        />

        <DashboardWidgetPicker
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          layout={layout}
          data={data}
          onPendingWidgetDragStart={setPendingWidgetDrag}
          onPendingWidgetDragEnd={() => setPendingWidgetDrag(null)}
          onAdd={(next) => {
            setLayout(next);
            scheduleSave(next);
          }}
        />
      </div>
    </div>
  );
}
