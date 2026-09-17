'use client';

import { useEffect, useRef, useState } from 'react';
import { redirectToLogout, getUserDisplayName, getClaimValue, type BffUser } from '../lib/auth';
import { getDiscoveredMicroservices } from '../lib/auth-utils';
import styles from './UserProfile.module.css';

interface UserProfileProps { claims: BffUser[]; }

type IconName = 'bell' | 'chevron' | 'user' | 'settings' | 'logout' | 'profile';
function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = { width:size, height:size, viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:1.8, strokeLinecap:'round' as const, strokeLinejoin:'round' as const, 'aria-hidden':true };
  if (name === 'bell') return <svg {...common}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>;
  if (name === 'chevron') return <svg {...common}><path d="m6 9 6 6 6-6"/></svg>;
  if (name === 'settings') return <svg {...common}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.8 1.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5v.2h-2.6v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1-1.8-1.8.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H5v-2.6h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 1.8-1.8.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V4h2.6v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.8 1.8-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1h.2v2.6h-.2a1.7 1.7 0 0 0-1.5 1.3Z"/></svg>;
  if (name === 'logout') return <svg {...common}><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M13 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5"/></svg>;
  return <svg {...common}><circle cx="12" cy="8" r="3.2"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></svg>;
}

export function UserProfile({ claims }: UserProfileProps) {
  const displayName = getUserDisplayName(claims);
  const email = getClaimValue(claims, 'email') || getClaimValue(claims, 'preferred_username') || 'Signed-in user';
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (event: MouseEvent) => { if (!containerRef.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const handleLogout = async () => {
    for (const baseURL of getDiscoveredMicroservices()) {
      try {
        const response = await fetch(`${baseURL}/api/auth/silent-logout`, { method:'POST', credentials:'include' });
        if (response.status !== 200) console.warn(`Logout failed for ${baseURL} with status: ${response.status}`);
      } catch (error) { console.error(`Error during logout for ${baseURL}:`, error); }
    }
    redirectToLogout(claims);
  };

  const preventDummyLink = (event: React.MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); setOpen(false); };

  return <div ref={containerRef} className={styles.profileArea}>
    <button type="button" className={styles.notificationButton} aria-label="Notifications — 3 unread" title="Notifications" onClick={() => setOpen(false)}>
      <Icon name="bell" size={19} /><span className={styles.notificationDot} aria-hidden="true" />
    </button>

    <button type="button" className={styles.profileButton} onClick={() => setOpen(v => !v)} aria-expanded={open} aria-haspopup="menu">
      <span className={styles.avatar} aria-hidden="true"><Icon name="user" size={20} /><span className={styles.avatarStatus} /></span>
      <span className={styles.identity}><span className={styles.name}>{displayName}</span><span className={styles.role}>Signed in</span></span>
      <span className={styles.profileChevron}><Icon name="chevron" size={15} /></span>
    </button>

    {open && <div className={styles.menu} role="menu">
      <div className={styles.menuHeader}><span className={styles.menuAvatar}><Icon name="user" size={21} /></span><span><strong>{displayName}</strong><small>{email}</small></span></div>
      <div className={styles.menuDivider} />
      <a href="#" role="menuitem" className={styles.menuItem} onClick={preventDummyLink}><Icon name="profile" size={17} /><span>Edit Profile</span></a>
      <a href="#" role="menuitem" className={styles.menuItem} onClick={preventDummyLink}><Icon name="settings" size={17} /><span>Settings</span></a>
      <a href="#" role="menuitem" className={styles.menuItem} onClick={preventDummyLink}><Icon name="bell" size={17} /><span>Notifications</span><span className={styles.unreadBadge}>3</span></a>
      <div className={styles.menuDivider} />
      <button type="button" role="menuitem" className={styles.logoutItem} onClick={handleLogout}><Icon name="logout" size={17} /><span>Sign out</span></button>
    </div>}
  </div>;
}
