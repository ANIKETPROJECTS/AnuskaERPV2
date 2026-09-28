import type { KeyboardEvent } from "react";

export type HubModuleNavItem<T extends string = string> = {
  id: T;
  label: string;
};

export function HubModuleNav<T extends string>({
  active,
  ariaLabel,
  idPrefix,
  items,
  onSelect,
}: {
  active: T;
  ariaLabel: string;
  idPrefix: string;
  items: readonly HubModuleNavItem<T>[];
  onSelect: (id: T) => void;
}) {
  function handleKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % items.length;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + items.length) % items.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = items.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextItem = items[nextIndex];
    if (!nextItem) return;
    onSelect(nextItem.id);
    event.currentTarget.parentElement
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]
      ?.focus();
  }

  return (
    <nav aria-label={ariaLabel}>
      <div className="flex min-w-0 gap-1 overflow-x-auto" role="tablist">
        {items.map((item, index) => {
          const selected = item.id === active;
          return (
            <button
              key={item.id}
              id={`${idPrefix}-tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`${idPrefix}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onSelect(item.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-3 text-base font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                selected
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}