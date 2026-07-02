"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pencil, Plus, RotateCcw } from "lucide-react";

import { DashboardGrid } from "@/components/ui/dashboard/dashboard-grid";
import { DashboardWidgetPicker } from "@/components/ui/dashboard/dashboard-widget-picker";
import { useTranslation } from "@/components/ui/locale-provider";
import type { DashboardLayout, DashboardPageData } from "@/lib/dashboard/layout-schema";
import type { PendingWidgetDrag } from "@/lib/dashboard/widget-drag";
import { Button } from "@/components/ui/button";

type DashboardPageClientProps = DashboardPageData & {
  initialLayout: DashboardLayout;
  isDefaultLayout: boolean;
};

async function persistLayout(layout: DashboardLayout): Promise<boolean> {
  const res = await fetch("/api/account/dashboard-layout", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(layout),
  });
  return res.ok;
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
  const [isDefault, setIsDefault] = useState(isDefaultLayout);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleSave = useCallback((next: DashboardLayout) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void (async () => {
        setSaving(true);
        const ok = await persistLayout(next);
        if (ok) setIsDefault(false);
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
    await persistLayout(layout);
    setIsDefault(false);
    setSaving(false);
    setEditMode(false);
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          {editMode ? (
            <p className="text-sm font-medium text-foreground">{t("dashboard.customizeTitle")}</p>
          ) : null}
          {saving ? <p className="text-xs text-muted-foreground">{t("common.saving")}</p> : null}
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
  );
}
