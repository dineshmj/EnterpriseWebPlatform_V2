'use client';

import { useEffect, useState } from 'react';
import styles from './ShellBridge.module.css';

const SHELL_ORIGIN = process.env.NEXT_PUBLIC_SHELL_ORIGIN!;

// ---- Unsaved-changes guard state (existing behavior preserved) ----
let hasUnsavedChanges = true;
export function setUnsavedChanges(value: boolean) {
  hasUnsavedChanges = value;
}

// ---- Generic cross-MFE workspace context contract ----
export interface WorkspaceContextItem {
  title: string;
  value: string | number | boolean;
}

export interface WorkspaceContext {
  persistentContext: WorkspaceContextItem[];
  currentContext: WorkspaceContextItem[];
  retainedContext: WorkspaceContextItem[];
}

const emptyContext = (): WorkspaceContext => ({
  persistentContext: [],
  currentContext: [],
  retainedContext: [],
});

function normalizeContext(context: unknown): WorkspaceContext {
  if (!context || typeof context !== 'object') return emptyContext();

  const candidate = context as Partial<WorkspaceContext>;
  return {
    persistentContext: Array.isArray(candidate.persistentContext) ? candidate.persistentContext : [],
    currentContext: Array.isArray(candidate.currentContext) ? candidate.currentContext : [],
    retainedContext: Array.isArray(candidate.retainedContext) ? candidate.retainedContext : [],
  };
}

let currentContext: WorkspaceContext = emptyContext();
const contextSubscribers = new Set<(ctx: WorkspaceContext) => void>();

function setContextInternal(ctx: WorkspaceContext) {
  currentContext = normalizeContext(ctx);
  contextSubscribers.forEach((notify) => notify(currentContext));
}

function upsertByTitle(items: WorkspaceContextItem[], item: WorkspaceContextItem) {
  return [...items.filter((existing) => existing.title !== item.title), item];
}

/**
 * Makes an item the current page focus.
 *
 * - The previous current focus is moved to retainedContext.
 * - An item with the same title is removed from retainedContext ("take from retained").
 * - If the current page changes the value for the same title, it simply replaces it.
 * - persistentContext is untouched.
 *
 * The helper is deliberately business-neutral: it knows only title/value pairs.
 */
export function focusContextItem(item: WorkspaceContextItem): WorkspaceContext {
  const existing = getContext();
  const sameCurrentTitle = existing.currentContext.every((current) => current.title === item.title);

  let retained = existing.retainedContext.filter((retainedItem) => retainedItem.title !== item.title);

  if (!sameCurrentTitle) {
    for (const previousCurrent of existing.currentContext) {
      if (previousCurrent.title !== item.title) {
        retained = upsertByTitle(retained, previousCurrent);
      }
    }
  }

  const next: WorkspaceContext = {
    persistentContext: existing.persistentContext,
    currentContext: [item],
    retainedContext: retained,
  };

  updateContext(next);
  return next;
}

/** Add or replace a context item that should stay visible across MFE navigation. */
export function setPersistentContextItem(item: WorkspaceContextItem): WorkspaceContext {
  const existing = getContext();
  const next: WorkspaceContext = {
    ...existing,
    persistentContext: upsertByTitle(existing.persistentContext, item),
  };
  updateContext(next);
  return next;
}

/** Sends the complete context object. Shell performs a full mechanical replace. */
export function updateContext(ctx: WorkspaceContext) {
  const normalized = normalizeContext(ctx);
  setContextInternal(normalized);
  window.parent.postMessage({ type: 'PAS_CONTEXT_UPDATE', context: normalized }, SHELL_ORIGIN);
}

export function getContext(): WorkspaceContext {
  return currentContext;
}

export function useMfeContext(): WorkspaceContext {
  const [ctx, setCtx] = useState(currentContext);

  useEffect(() => {
    contextSubscribers.add(setCtx);
    return () => {
      contextSubscribers.delete(setCtx);
    };
  }, []);

  return ctx;
}

// ---- Navigation guard + Shell handshake ----
interface PendingRequest {
  requestId: string;
  source: MessageEventSource;
  origin: string;
}

export function ShellBridge() {
  const [pendingRequest, setPendingRequest] = useState<PendingRequest | null>(null);

  useEffect(() => {
    window.parent.postMessage({ type: 'PAS_MFE_READY' }, SHELL_ORIGIN);

    function handleMessage(event: MessageEvent) {
      if (event.origin !== SHELL_ORIGIN) return;

      if (event.data?.type === 'PAS_CONTEXT_HANDOFF') {
        setContextInternal(normalizeContext(event.data.context));
        return;
      }

      if (event.data?.type === 'PAS_NAVIGATION_REQUEST') {
        if (!event.source) return;
        const { requestId } = event.data;

        if (!hasUnsavedChanges) {
          (event.source as Window)?.postMessage(
            { type: 'PAS_NAVIGATION_RESPONSE', requestId, allowed: true },
            event.origin,
          );
          return;
        }

        setPendingRequest({ requestId, source: event.source, origin: event.origin });
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const respond = (allowed: boolean) => {
    if (!pendingRequest) return;
    (pendingRequest.source as Window)?.postMessage(
      { type: 'PAS_NAVIGATION_RESPONSE', requestId: pendingRequest.requestId, allowed },
      pendingRequest.origin,
    );
    setPendingRequest(null);
  };

  if (!pendingRequest) return null;

  return (
    <div className={styles.overlay} role="presentation">
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="nav-guard-title"
        aria-describedby="nav-guard-desc"
      >
        <h2 id="nav-guard-title" className={styles.title}>Unsaved changes</h2>
        <p id="nav-guard-desc" className={styles.message}>
          You have unsaved changes on this page. If you leave now, they will be lost.
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.stayButton} onClick={() => respond(false)} autoFocus>
            Stay on this page
          </button>
          <button type="button" className={styles.leaveButton} onClick={() => respond(true)}>
            Leave without saving
          </button>
        </div>
      </div>
    </div>
  );
}
