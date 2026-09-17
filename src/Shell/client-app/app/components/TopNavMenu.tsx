'use client';
import React, { useRef, useState } from 'react';
import { Microservice, MenuItem } from '../types';
import styles from './TopNavMenu.module.css';

interface TopNavMenuProps { microservices: Microservice[]; handleMenuItemClick: (item: MenuItem) => void; loading: boolean; }
const AREA_HOVER_DELAY_MS = 350;

export const TopNavMenu: React.FC<TopNavMenuProps> = ({ microservices, handleMenuItemClick, loading }) => {
  const [openMicroservice, setOpenMicroservice] = useState<string | null>(null);
  const [openArea, setOpenArea] = useState<string | null>(null);
  const areaHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearAreaTimer = () => { if (areaHoverTimer.current) { clearTimeout(areaHoverTimer.current); areaHoverTimer.current = null; } };
  const closeAll = () => { setOpenMicroservice(null); setOpenArea(null); clearAreaTimer(); };
  const handleAreaEnter = (areaName: string) => { clearAreaTimer(); setOpenArea(null); areaHoverTimer.current = setTimeout(() => setOpenArea(areaName), AREA_HOVER_DELAY_MS); };
  const handleAreaLeave = () => clearAreaTimer();

  return <nav className={styles.navBar} onMouseLeave={closeAll}>
    {microservices.map(microservice => <div key={microservice.name} className={styles.navItem} onMouseEnter={() => setOpenMicroservice(microservice.name)}>
      <button type="button" className={styles.navButton}><span className={styles.navIcon} aria-hidden="true">{microservice.name.trim().charAt(0).toUpperCase()}</span>{microservice.name}<span className={styles.arrow}>&#9662;</span></button>
      {openMicroservice === microservice.name && <div className={styles.dropdown}>
        {microservice.managementAreas.map(area => <div key={area.name} className={styles.areaRow} onMouseEnter={() => handleAreaEnter(area.name)} onMouseLeave={handleAreaLeave}>
          <span className={styles.areaLabel}>{area.name}</span><span className={styles.areaArrow}>&#9656;</span>
          {openArea === area.name && <div className={styles.flyout}><ul className={styles.flyoutList}>
            {area.menuItems.map(item => <li key={item.taskName}><a href="#" className={loading ? `${styles.leafLink} ${styles.leafLinkDisabled}` : styles.leafLink} onClick={e => { e.preventDefault(); if (!loading) { handleMenuItemClick({ ...item, managementAreaName: area.name, microserviceName: microservice.name, baseURL: microservice.baseURL }); closeAll(); } }}>{item.taskName}{loading && ' ...'}</a></li>)}
          </ul></div>}
        </div>)}
      </div>}
    </div>)}
  </nav>;
};
