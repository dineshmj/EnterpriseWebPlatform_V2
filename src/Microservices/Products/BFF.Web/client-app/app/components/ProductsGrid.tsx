'use client';
import React from 'react';
import styles from './CatalogGrid.module.css';

interface Product { id:number; name:string; price:number; categoryName:string; stockQuantity:number; }
interface Props { products: Product[]; }

const stockState = (n:number) => n <= 0 ? 'out' : n <= 10 ? 'low' : 'healthy';

const ProductsGrid: React.FC<Props> = ({ products }) => {
  if (!products?.length) return <div className={styles.empty}>No products found.</div>;
  return <div className={styles.grid}>
    {products.map(p => {
      const state = stockState(p.stockQuantity);
      return <article className={styles.card} key={p.id}>
        <div className={styles.cardTop}><span className={styles.id}>#{p.id}</span><span className={`${styles.stock} ${styles[state]}`}>{state === 'healthy' ? 'In stock' : state === 'low' ? 'Low stock' : 'Out of stock'}</span></div>
        <h3>{p.name}</h3>
        <div className={styles.price}>$ {p.price.toFixed(2)}</div>
        <div className={styles.meta}><span>Category</span><strong>{p.categoryName}</strong></div>
        <div className={styles.meta}><span>Available units</span><strong>{p.stockQuantity}</strong></div>
      </article>;
    })}
  </div>;
};
export default ProductsGrid;
