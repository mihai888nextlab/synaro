"use client";

import * as React from "react";

type WorkspaceChatPreviewContextValue = {
  previewPath: string | null;
  openFile: (path: string) => void;
  closePreview: () => void;
};

const WorkspaceChatPreviewContext = React.createContext<WorkspaceChatPreviewContextValue | null>(
  null,
);

export function WorkspaceChatPreviewProvider({ children }: { children: React.ReactNode }) {
  const [previewPath, setPreviewPath] = React.useState<string | null>(null);

  const value = React.useMemo(
    () => ({
      previewPath,
      openFile: (path: string) => setPreviewPath(path),
      closePreview: () => setPreviewPath(null),
    }),
    [previewPath],
  );

  return (
    <WorkspaceChatPreviewContext.Provider value={value}>
      {children}
    </WorkspaceChatPreviewContext.Provider>
  );
}

export function useWorkspaceChatPreview() {
  return React.useContext(WorkspaceChatPreviewContext);
}
