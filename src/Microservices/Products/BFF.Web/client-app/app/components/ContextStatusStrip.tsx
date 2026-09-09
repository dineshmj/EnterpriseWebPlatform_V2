'use client';

import { useMfeContext } from './ShellBridge';
import styles from './ContextStatusStrip.module.css';

export function ContextStatusStrip() {
  const context = useMfeContext();

  return (
    <div className={styles.strip}>
      Context received: {JSON.stringify(context)}
    </div>
  );
}
