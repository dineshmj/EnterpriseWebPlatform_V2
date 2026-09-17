'use client';
import React from 'react';
import styles from './CatalogGrid.module.css';
interface Category { id:number; name:string; }
interface Props { categories: Category[]; }
const CategoriesGrid: React.FC<Props> = ({ categories }) => {
  if (!categories?.length) return <div className={styles.empty}>No categories found.</div>;
  return <div className={styles.grid}>
    {categories.map(c => <article className={styles.card} key={c.id}>
      <div className={styles.categoryIcon}>C</div><div className={styles.cardTop}><span className={styles.id}>Category #{c.id}</span></div>
      <h3>{c.name}</h3><div className={styles.meta}><span>Category ID</span><strong>{c.id}</strong></div>
    </article>)}
  </div>;
};
export default CategoriesGrid;
