'use client';

import { HttpError, Order } from '@/app/types';
import React, { useState, useEffect, useRef } from 'react';
import appConfigData from '../../../../app.config.json';
import { focusContextItem } from '../../../components/ShellBridge';
import styles from './page.module.css';

const formatDate = (s: string) => {
  try {
    return new Date(s)
      .toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: '2-digit' })
      .replace(/ /g, '-');
  } catch {
    return s;
  }
};

const statusClass = (s: string) => s.toLowerCase().replace(/\s+/g, '');

const OrdersGetAllPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<HttpError | null>(null);
  const [search, setSearch] = useState('');
  const didFetchRef = useRef(false);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${appConfigData.config.ordersBffUrl}/api/orders/view-all`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`API error ${res.status} ${res.statusText}: ${text || 'No body'}`);
      }

      const data = await res.json();
      const rows: Order[] = data.data.orderReport.nodes;
      if (!Array.isArray(rows)) {
        throw new HttpError('Received unexpected data format from API.', 500);
      }

      setOrders(rows);

      if (rows.length) {
        // The old current focus (Product/Category/etc.) is automatically moved
        // to retainedContext and Order ID becomes the new currentContext.
        focusContextItem({ title: 'Order ID', value: rows[0].orderId });
      }
    } catch (err: any) {
      if (err.message?.includes('401 Unauthorized') || err.message?.includes('"statusCode":401')) {
        setError(new HttpError('User is not authenticated.', 401));
      } else {
        setError(new HttpError(err?.message ?? 'Failed to fetch orders.', err?.status || 500));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!didFetchRef.current) {
      didFetchRef.current = true;
      fetchOrders();
    }
  }, []);

  const filtered = orders.filter((o) => {
    const q = search.trim().toLowerCase();
    return !q
      || String(o.orderId).includes(q)
      || o.customerName.toLowerCase().includes(q)
      || o.invoiceNumber.toLowerCase().includes(q)
      || o.dispatchStatus.toLowerCase().includes(q);
  });

  if (error) {
    return (
      <main className={styles.page}>
        <div className={styles.error}>
          {error.statusCode === 401
            ? <><h2>Authentication Required</h2><p>User is not authenticated. Please login from <a href={appConfigData.config.pmsLoginUrl}>Platform Management System</a>.</p></>
            : <>Error loading orders: {error.message}</>}
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.eyebrow}>Order Management</div>
          <h1 className={styles.title}>All Orders</h1>
          <p className={styles.subtitle}>Review order activity, payment details and fulfilment status.</p>
        </div>
        <div className={styles.tools}>
          <input className={styles.search} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search orders…" aria-label="Search orders" />
          <button className={styles.refresh} onClick={fetchOrders} disabled={loading}>{loading ? 'Refreshing…' : 'Refresh'}</button>
        </div>
      </header>

      <div className={styles.summary}>
        <span className={styles.pill}>{filtered.length} shown</span>
        {search && <span className={styles.pill}>Filter: {search}</span>}
      </div>

      {loading
        ? <div className={styles.loading}><span className={styles.spinner} /><p>Loading orders…</p></div>
        : filtered.length === 0
          ? <div className={styles.empty}>No orders match your search.</div>
          : <div className={styles.tableWrap}>
              <table>
                <thead><tr><th>Order ID</th><th>Date</th><th>Customer</th><th>Invoice</th><th>Payment</th><th>Items</th><th>Amount</th><th>Status</th></tr></thead>
                <tbody>
                  {filtered.map((o, i) => (
                    <tr key={o.orderId || i}>
                      <td className={styles.orderId}>#{o.orderId}</td>
                      <td>{formatDate(o.dateOfOrder)}</td>
                      <td>{o.customerName}</td>
                      <td>{o.invoiceNumber}</td>
                      <td>{o.paymentMethod}</td>
                      <td>{o.numberOfItems}</td>
                      <td className={styles.amount}>$ {o.totalAmount.toFixed(2)}</td>
                      <td><span className={`${styles.status} ${styles[statusClass(o.dispatchStatus)] || styles.pending}`}>{o.dispatchStatus}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
    </main>
  );
};

export default OrdersGetAllPage;
