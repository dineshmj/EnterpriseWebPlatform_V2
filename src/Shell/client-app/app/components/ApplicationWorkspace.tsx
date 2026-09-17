'use client';

import type { WorkspaceContext, WorkspaceContextItem } from '../workspace-context';
import styles from './ApplicationWorkspace.module.css';

interface ApplicationWorkspaceProps {
  context: WorkspaceContext;
}

function ContextItem({ item, emphasis = false }: { item: WorkspaceContextItem; emphasis?: boolean }) {
  return (
    <div className={emphasis ? `${styles.item} ${styles.currentItem}` : styles.item}>
      <span className={styles.itemTitle}>{item.title}</span>
      <span className={styles.itemValue}>{String(item.value)}</span>
    </div>
  );
}

export function ApplicationWorkspace({ context }: ApplicationWorkspaceProps) {
  const persistent = context?.persistentContext ?? [];
  const current = context?.currentContext ?? [];
  const retained = context?.retainedContext ?? [];
  const hasVisibleContext = persistent.length > 0 || current.length > 0;

  return (
    <section className={styles.workspace} aria-label="Application workspace context">
      <div className={styles.headingBlock}>
        <span className={styles.heading}>Application Workspace</span>
        {!hasVisibleContext && (
          <span className={styles.hint}>Select an operation from the menu</span>
        )}
      </div>

      {hasVisibleContext && (
        <div className={styles.visibleContext}>
          {persistent.map((item, index) => (
            <ContextItem key={`persistent-${item.title}-${index}`} item={item} />
          ))}
          {current.map((item, index) => (
            <ContextItem key={`current-${item.title}-${index}`} item={item} emphasis />
          ))}
        </div>
      )}

      {/* retainedContext deliberately remains invisible.  The Shell stores and
          relays it mechanically, but only persistent/current context is shown. */}
      <span className={styles.contextCount} aria-label={`${retained.length} retained context items`}>
        {retained.length > 0 ? `${retained.length} retained` : ''}
      </span>
    </section>
  );
}
