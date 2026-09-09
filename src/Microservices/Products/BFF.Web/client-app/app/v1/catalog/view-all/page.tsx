'use client';

import { useEffect } from 'react';
import { AuthGuard } from '../../../components/AuthGuard';
import { useAuth } from '../../../hooks/useAuth';
import ProductsGrid from '../../../components/ProductsGrid';
import { useDispatch, useSelector } from 'react-redux';
import { fetchProducts } from '../../../store/productsSlice';
import type { RootState, AppDispatch } from '../../../store/store';
import { updateContext, getContext } from '../../../components/ShellBridge';

function ProductsContent() {
    const { user } = useAuth(false);
    const dispatch = useDispatch<AppDispatch>();

    const { data: products, loading, error, hasLoaded } = useSelector(
        (state: RootState) => state.products
    );

    const handleFetch = () => {
        dispatch(fetchProducts());
    };

    useEffect(() => {
        // Load data if user is present AND it hasn't been loaded yet AND we don't have an existing error from a previous failed attempt
        if (user && !hasLoaded && !error) {
            dispatch(fetchProducts());
        }
    }, [user, hasLoaded, error, dispatch]);

    useEffect(() => {
        // Report the first record's ID back to the Shell whenever the products
        // list (re)loads, preserving whatever context (e.g. categoryId,
        // orderId) was already there.
        if (products && products.length > 0) {
            updateContext({ ...getContext(), productId: products[0].id });
        }
    }, [products]);

    if (!user) return null;

    const showGrid = products !== null;

    return (
        <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
            <h1>View All Products</h1>

            {loading && !showGrid && <p>Loading products...</p>}
            {error && (
                <div style={{ marginTop: '1rem', color: 'red' }}>
                    {error}
                </div>
            )}
            {showGrid ? (
                <>
                    <ProductsGrid products={products} />
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
                !loading && !error && user && <p>No products available.</p>
            )}
        </div>
    );
}

export default function Home() {
    return (
        <AuthGuard>
            <ProductsContent />
        </AuthGuard>
    );
}