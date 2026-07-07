import { useCallback, useRef } from "react";

/**
 * Guard a CRUD dialog: if the form is dirty, confirm before closing.
 *
 * Usage:
 *   const guard = useDialogDirtyGuard(() => isDirty);
 *   <Dialog open={open} onOpenChange={guard.wrap(setOpen)}>
 */
export function useDialogDirtyGuard(isDirtyFn: () => boolean) {
  const isDirtyRef = useRef(isDirtyFn);
  isDirtyRef.current = isDirtyFn;

  const wrap = useCallback(
    (setOpen: (open: boolean) => void) =>
      (next: boolean) => {
        if (!next && isDirtyRef.current()) {
          const ok = window.confirm(
            "Discard unsaved changes?",
          );
          if (!ok) return;
        }
        setOpen(next);
      },
    [],
  );

  return { wrap };
}