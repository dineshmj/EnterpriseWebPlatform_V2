'use client';

import { useEffect } from 'react';
import { AuthGuard } from '../../../components/AuthGuard';
import { useAuth } from '../../../hooks/useAuth';
import CategoriesGrid from '../../../components/CategoriesGrid';
import { useDispatch, useSelector } from 'react-redux';
import { fetchCategories } from '../../../store/categoriesSlice';
import type { RootState, AppDispatch } from '../../../store/store';
import { updateContext, getContext } from '../../../components/ShellBridge';

function CategoriesContent() {
    const { user } = useAuth(false);
    const dispatch = useDispatch<AppDispatch>();

    const { data: categories, loading, error, hasLoaded } = useSelector(
        (state: RootState) => state.categories
    );

    const handleFetch = () => {
        dispatch(fetchCategories());
    };

    useEffect(() => {
        // Load data if user is present AND it hasn't been loaded yet AND we don't have an existing error from a previous failed attempt
        if (user && !hasLoaded && !error) {
            dispatch(fetchCategories());
        }
    }, [user, hasLoaded, error, dispatch]);

    useEffect(() => {
        // Report the first record's ID back to the Shell whenever the
        // categories list (re)loads, preserving whatever context (e.g.
        // productId, orderId) was already there.
        if (categories && categories.length > 0) {
            updateContext({ ...getContext(), categoryId: categories[0].id });
        }
    }, [categories]);

    if (!user) return null;

    const showGrid = categories !== null;

    return (
        <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
            <h1>View All Categories</h1>

            {loading && !showGrid && <p>Loading categories...</p>}
            {error && (
                <div style={{ marginTop: '1rem', color: 'red' }}>
                    {error}
                </div>
            )}
            {showGrid ? (
                <>
                    <CategoriesGrid categories={categories} />
                    <button
                        onClick={handleFetch}
                        disabled={loading}
                        style={{
                            marginTop: '1rem',
                            padding: '12px 22px',
                            fontWeight: 600,
                            borderRadius: '12px',
                            border: 'none',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            background: 'linear-gradient(135deg, #1e88e5, #42a5f5)',
                            color: 'white',
                            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.35)',
                            transition: 'all 0.25s ease',
                            opacity: loading ? 0.65 : 1
                        }}
                    >
                        {loading ? 'Fetching...' : 'Fetch Records Again'}
                    </button>
                </>
            ) : (
                !loading && !error && user && <p>No categories available.</p>
            )}
        </div>
    );
}

export default function Home() {
    return (
        <AuthGuard>
            <CategoriesContent />
        </AuthGuard>
    );
}