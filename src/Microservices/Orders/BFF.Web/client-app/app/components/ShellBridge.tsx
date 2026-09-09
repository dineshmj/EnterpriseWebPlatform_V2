'use client';

import { useEffect, useState } from 'react';
import styles from './ShellBridge.module.css';

const SHELL_ORIGIN = process.env.NEXT_PUBLIC_SHELL_ORIGIN!;

// ---- Unsaved-changes guard state (unchanged behavior from before) ----
let hasUnsavedChanges = true;
export function setUnsavedChanges(value: boolean) {
    hasUnsavedChanges = value;
}

// ---- Cross-MFE context relay ----
// This is intentionally opaque: we never interpret what's inside `context`,
// only store it, expose it, and relay it back to the Shell. The Shell does
// the exact same thing on its side — nobody here knows what a "customerId"
// or "orderId" means, they're just JSON.
type MfeContext = Record<string, unknown>;

let currentContext: MfeContext = {};
const contextSubscribers = new Set<(ctx: MfeContext) => void>();

function setContextInternal(ctx: MfeContext) {
    currentContext = ctx;
    contextSubscribers.forEach((notify) => notify(currentContext));
}

/**
 * Call this whenever this MFE's "current focus" changes (e.g. the user opens
 * a different customer or order). Sends the FULL context object — it fully
 * replaces whatever the Shell was holding, so include every field that
 * should still apply, not just the one that changed.
 *
 * Example: updateContext({ customerId: 'CX12345', orderId: 34567 });
 */
export function updateContext(ctx: MfeContext) {
    setContextInternal(ctx);
    window.parent.postMessage({ type: 'PAS_CONTEXT_UPDATE', context: ctx }, SHELL_ORIGIN);
}

/** Synchronous read of the current context. Does not subscribe to changes —
 *  use useMfeContext() in a component if you need re-renders on updates. */
export function getContext(): MfeContext {
    return currentContext;
}

/**
 * React hook — re-renders the calling component whenever the context
 * changes, including the initial handoff the Shell sends right after this
 * MFE announces itself ready.
 */
export function useMfeContext(): MfeContext {
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
        // Announce our real origin to the Shell as soon as we mount. The Shell
        // can't reliably infer this from the URL it assigned to the iframe, and
        // it replies to this specific message with PAS_CONTEXT_HANDOFF.
        window.parent.postMessage({ type: 'PAS_MFE_READY' }, SHELL_ORIGIN);

        function handleMessage(event: MessageEvent) {
            if (event.origin !== SHELL_ORIGIN) return;

            if (event.data?.type === 'PAS_CONTEXT_HANDOFF') {
                setContextInternal(event.data.context ?? {});
                return;
            }

            if (event.data?.type === 'PAS_NAVIGATION_REQUEST') {
                if (!event.source) return;
                const { requestId } = event.data;

                if (!hasUnsavedChanges) {
                    // No conflict — reply immediately, no modal needed.
                    (event.source as Window)?.postMessage(
                        { type: 'PAS_NAVIGATION_RESPONSE', requestId, allowed: true },
                        event.origin,
                    );
                    return;
                }

                // Defer the reply until the user answers the modal below.
                setPendingRequest({ requestId, source: event.source, origin: event.origin });
                return;
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
                <h2 id="nav-guard-title" className={styles.title}>
                    Unsaved changes
                </h2>
                <p id="nav-guard-desc" className={styles.message}>
                    You have unsaved changes on this page. If you leave now, they will be lost.
                </p>
                <div className={styles.actions}>
                    <button
                        type="button"
                        className={styles.stayButton}
                        onClick={() => respond(false)}
                        autoFocus
                    >
                        Stay on this page
                    </button>
                    <button
                        type="button"
                        className={styles.leaveButton}
                        onClick={() => respond(true)}
                    >
                        Leave without saving
                    </button>
                </div>
            </div>
        </div>
    );
}