"use client";

import * as React from "react";
import type { ItemInstance } from "@headless-tree/core";
import { ChevronDownIcon } from "lucide-react";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";

type HeadlessTreeLike = {
  getContainerProps?: () => React.HTMLAttributes<HTMLDivElement>;
};

type TreeCssVars = React.CSSProperties & {
  ["--tree-indent"]?: string;
  ["--tree-padding"]?: string;
};

interface TreeContextValue<T = unknown> {
  indent: number;
  currentItem?: ItemInstance<T>;
  tree?: HeadlessTreeLike;
}

const TreeContext = React.createContext<TreeContextValue>({
  indent: 20,
  currentItem: undefined,
  tree: undefined,
});

function useTreeContext<T = unknown>() {
  return React.useContext(TreeContext) as TreeContextValue<T>;
}

interface TreeProps extends React.HTMLAttributes<HTMLDivElement> {
  indent?: number;
  tree?: HeadlessTreeLike;
}

function Tree({ indent = 20, tree, className, ...props }: TreeProps) {
  const containerProps =
    tree && typeof tree.getContainerProps === "function" ? tree.getContainerProps() : {};
  const mergedProps = { ...props, ...containerProps };

  const { style: propStyle, ...otherProps } = mergedProps;
  const mergedStyle: TreeCssVars = {
    ...(propStyle as React.CSSProperties),
    ["--tree-indent"]: `${indent}px`,
  };

  return (
    <TreeContext.Provider value={{ indent, tree }}>
      <div
        data-slot="tree"
        style={mergedStyle}
        className={cn("flex flex-col", className)}
        {...otherProps}
      />
    </TreeContext.Provider>
  );
}

interface TreeItemProps<T = unknown> extends React.HTMLAttributes<HTMLButtonElement> {
  item: ItemInstance<T>;
  asChild?: boolean;
}

function TreeItem<T = unknown>({ item, className, asChild, children, ...props }: TreeItemProps<T>) {
  const { indent } = useTreeContext<T>();

  const itemProps = typeof item.getProps === "function" ? item.getProps() : {};
  const mergedProps = { ...props, ...itemProps };

  const { style: propStyle, ...otherProps } = mergedProps;
  const mergedStyle: TreeCssVars = {
    ...(propStyle as React.CSSProperties),
    ["--tree-padding"]: `${item.getItemMeta().level * indent}px`,
  };

  const Comp = (asChild ? Slot : "button") as React.ElementType;

  return (
    <TreeContext.Provider value={{ indent, currentItem: item }}>
      <Comp
        data-slot="tree-item"
        style={mergedStyle}
        className={cn(
          "z-10 ps-(--tree-padding) outline-hidden select-none not-last:pb-0.5 focus:z-20 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
          className,
        )}
        data-focus={typeof item.isFocused === "function" ? item.isFocused() || false : undefined}
        data-folder={typeof item.isFolder === "function" ? item.isFolder() || false : undefined}
        data-selected={
          typeof item.isSelected === "function" ? item.isSelected() || false : undefined
        }
        aria-expanded={item.isExpanded()}
        {...otherProps}
      >
        {children}
      </Comp>
    </TreeContext.Provider>
  );
}

interface TreeItemLabelProps<T = unknown> extends React.HTMLAttributes<HTMLSpanElement> {
  item?: ItemInstance<T>;
}

function TreeItemLabel<T = unknown>({
  item: propItem,
  children,
  className,
  ...props
}: TreeItemLabelProps<T>) {
  const { currentItem } = useTreeContext<T>();
  const item = propItem || currentItem;

  if (!item) return null;

  return (
    <span
      data-slot="tree-item-label"
      className={cn(
        "flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm transition-colors",
        "bg-background hover:bg-accent",
        "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground",
        "focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20",
        "not-data-[folder=true]:ps-7",
        className,
      )}
      {...props}
    >
      {item.isFolder() && (
        <ChevronDownIcon className="size-4 text-muted-foreground aria-[expanded=false]:-rotate-90 transition-transform" />
      )}
      {children || (typeof item.getItemName === "function" ? item.getItemName() : null)}
    </span>
  );
}

export { Tree, TreeItem, TreeItemLabel };

