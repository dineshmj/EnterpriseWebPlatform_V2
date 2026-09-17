'use client';

import { useEffect } from 'react';
import { AuthGuard } from '../../../components/AuthGuard';
import { useAuth } from '../../../hooks/useAuth';
import ProductsGrid from '../../../components/ProductsGrid';
import { useDispatch, useSelector } from 'react-redux';
import { fetchProducts } from '../../../store/productsSlice';
import type { RootState, AppDispatch } from '../../../store/store';
import { focusContextItem } from '../../../components/ShellBridge';
import styles from '../../../components/ViewAll.module.css';

function ProductsContent() {
  const { user } = useAuth(false);
  const dispatch = useDispatch<AppDispatch>();
  const { data: products, loading, error, hasLoaded } = useSelector((s: RootState) => s.products);

  useEffect(() => {
    if (user && !hasLoaded && !error) dispatch(fetchProducts());
  }, [user, hasLoaded, error, dispatch]);

  useEffect(() => {
    if (products?.length) {
      focusContextItem({ title: 'Product ID', value: products[0].id });
    }
  }, [products]);

  if (!user) return null;
  const count = products?.length ?? 0;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Product Catalog</div>
          <h1 className={styles.title}>All Products</h1>
          <p className={styles.subtitle}>Browse products, pricing and current stock availability.</p>
        </div>
        <div className={styles.toolbar}>
          <span className={styles.count}>{count} {count === 1 ? 'product' : 'products'}</span>
          <button className={styles.refresh} onClick={() => dispatch(fetchProducts())} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      {error && <div className={styles.alert}>{error}</div>}
      {loading && !products
        ? <div className={styles.loading}><span className={styles.spinner} /><p>Loading products…</p></div>
        : <ProductsGrid products={products ?? []} />}
    </main>
  );
}

export default function Home() {
  return <AuthGuard><ProductsContent /></AuthGuard>;
}
