'use client';

import { useEffect } from 'react';
import { AuthGuard } from '../../../components/AuthGuard';
import { useAuth } from '../../../hooks/useAuth';
import CategoriesGrid from '../../../components/CategoriesGrid';
import { useDispatch, useSelector } from 'react-redux';
import { fetchCategories } from '../../../store/categoriesSlice';
import type { RootState, AppDispatch } from '../../../store/store';
import { focusContextItem } from '../../../components/ShellBridge';
import styles from '../../../components/ViewAll.module.css';

function CategoriesContent() {
  const { user } = useAuth(false);
  const dispatch = useDispatch<AppDispatch>();
  const { data: categories, loading, error, hasLoaded } = useSelector((s: RootState) => s.categories);

  useEffect(() => {
    if (user && !hasLoaded && !error) dispatch(fetchCategories());
  }, [user, hasLoaded, error, dispatch]);

  useEffect(() => {
    if (categories?.length) {
      focusContextItem({ title: 'Category ID', value: categories[0].id });
    }
  }, [categories]);

  if (!user) return null;
  const count = categories?.length ?? 0;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Category Management</div>
          <h1 className={styles.title}>All Categories</h1>
          <p className={styles.subtitle}>Browse and organize the categories used by the product catalog.</p>
        </div>
        <div className={styles.toolbar}>
          <span className={styles.count}>{count} {count === 1 ? 'category' : 'categories'}</span>
          <button className={styles.refresh} onClick={() => dispatch(fetchCategories())} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      {error && <div className={styles.alert}>{error}</div>}
      {loading && !categories
        ? <div className={styles.loading}><span className={styles.spinner} /><p>Loading categories…</p></div>
        : <CategoriesGrid categories={categories ?? []} />}
    </main>
  );
}

export default function Home() {
  return <AuthGuard><CategoriesContent /></AuthGuard>;
}
