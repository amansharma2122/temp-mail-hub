import { useEffect, useRef, useState, useCallback } from "react";
import { useBlocker } from "react-router-dom";

/**
 * Track dirty (unsaved changes) state for a form/page.
 * - `markDirty()` / `markClean()` to toggle
 * - Blocks in-app navigation (react-router) with a confirm
 * - Warns on tab close via beforeunload
 * - Preserves state on window focus/blur (does NOT reset on tab refocus)
 */
export function useDirty(initialDirty = false) {
  const [isDirty, setIsDirty] = useState(initialDirty);
  const dirtyRef = useRef(isDirty);
  dirtyRef.current = isDirty;

  const markDirty = useCallback(() => setIsDirty(true), []);
  const markClean = useCallback(() => setIsDirty(false), []);

  // beforeunload warning
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // Block react-router navigation when dirty
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    dirtyRef.current && currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    if (blocker.state === "blocked") {
      const ok = window.confirm(
        "You have unsaved changes. Leave without saving?"
      );
      if (ok) blocker.proceed();
      else blocker.reset();
    }
  }, [blocker]);

  return { isDirty, markDirty, markClean, setDirty: setIsDirty };
}

/**
 * Wrap a save handler so dirty flag is cleared on success.
 */
export function useDirtySaver<T extends (...a: any[]) => Promise<any>>(
  save: T,
  markClean: () => void,
) {
  return useCallback(
    async (...args: Parameters<T>) => {
      const res = await save(...args);
      markClean();
      return res;
    },
    [save, markClean],
  ) as T;
}