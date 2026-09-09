'use client';

import { HttpError, Order } from '@/app/types';
import React, { useState, useEffect, useRef } from 'react';
import appConfigData from '../../../../app.config.json';
import { updateContext, getContext } from '../../../components/ShellBridge';

//
// Utility function for date formatting: dd-MMM-yyyy
//
const formatDate = (dateString: string): string => {
  try {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    };
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', options).replace(/ /g, '-');
  } catch (e) {
    console.error('Date formatting failed:', e);
    return dateString;
  }
};

const OrdersGetAllPage: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<HttpError | null>(null);

  const didFetchRef = useRef(false);

  useEffect(() => {
  const fetchOrders = async () => {
    try {
      const res = await fetch(`${appConfigData.config.ordersBffUrl}/api/orders/view-all`, {
        method: 'GET',
        credentials: 'include', // This ensures that the BFF auth cookie is sent back to the BFF server.
      });

      if (!res.ok) {
        const text = await res.text();
        console.error(
          'BFF /api/orders/view-all failed:',
          'status =', res.status,
          'statusText =', res.statusText,
          'body =', text,
        );
        throw new Error(
          `API error ${res.status} ${res.statusText}: ${text || 'No body'}`,
        );
      }

      const data = await res.json();
      const ordersData: Order[] = data.data.orderReport.nodes;

      if (Array.isArray(ordersData)) {
        setOrders(ordersData);

        // Report the first record's ID back to the Shell, preserving
        // whatever context (e.g. productId, categoryId) was already there.
        if (ordersData.length > 0) {
          updateContext({ ...getContext(), orderId: ordersData[0].orderId });
        }
      } else {
        setError(new HttpError('Received unexpected data format from API.', 500));
      }
    } catch (err: any) {
      //
      // If error message contains "401 Unauthorized", set Response Status Code to 401
      //
      if (err.message && (err.message.includes('401 Unauthorized') || err.message.includes('"statusCode":401'))) {
        setError(new HttpError('User is not authenticated.', 401));
        return;
      }
      else {
        const errorMessage = err?.message ?? 'Failed to fetch orders.';
        const errorStatus = (err as any)?.status || 500;

        setError(new HttpError(errorMessage, errorStatus));
      }
    } finally {
      setLoading(false);
    }
  };

  if (!didFetchRef.current) {
    didFetchRef.current = true;
    fetchOrders();
  }
}, []);


  if (loading) {
    return (
      <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
        Loading Orders...
      </div>
    );
  }

  if (error) {
    if (error.statusCode === 401) {
      return (
        <div style={{ padding: '2rem', fontFamily: 'system-ui', textAlign: 'center' }}>
          <h1>Authentication Required</h1>
          
          <p>
            User is not authenticated. Please login from
            <a href={appConfigData.config.pmsLoginUrl} style={{ marginLeft: '0.5rem' }}>Platform Management System</a>.
          </p>
        </div>
      );
    }

    return (
      <div
        style={{
          padding: '20px',
          color: 'red',
          fontFamily: 'sans-serif',
          whiteSpace: 'pre-wrap',
        }}
      >
        Error loading orders: {error?.message}
      </div>
    );
  }

  const columns = [
    { key: 'orderId', header: 'Order ID' },
    { key: 'dateOfOrder', header: 'Date' },
    { key: 'totalAmount', header: 'Amount' },
    { key: 'paymentMethod', header: 'Payment' },
    { key: 'invoiceNumber', header: 'Invoice #' },
    { key: 'numberOfItems', header: 'Items' },
    { key: 'dispatchStatus', header: 'Status' },
    { key: 'customerName', header: 'Customer' },
  ];

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1 style={{ marginBottom: '20px' }}>All Orders</h1>

      {/* Header row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns.length}, minmax(100px, 1fr))`,
          gap: '10px',
          borderBottom: '2px solid #ccc',
          padding: '10px 0',
          fontWeight: 'bold',
        }}
      >
        {columns.map((col) => (
          <div key={col.key}>{col.header}</div>
        ))}
      </div>

      {/* Data rows */}
      {orders.map((order, index) => (
        <div
          key={order.orderId || index}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns.length}, minmax(100px, 1fr))`,
            gap: '10px',
            padding: '10px 0',
            borderBottom:
              index % 2 === 0 ? '1px solid #eee' : '1px solid #f7f7f7',
          }}
        >
          <div
            style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {order.orderId}
          </div>

          <div>{formatDate(order.dateOfOrder)}</div>

          <div>$ {order.totalAmount.toFixed(2)}</div>

          <div
            style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {order.paymentMethod}
          </div>

          <div
            style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {order.invoiceNumber}
          </div>

          <div>{order.numberOfItems}</div>

          <div>{order.dispatchStatus}</div>
          
          <div
            style={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {order.customerName}
          </div>
        </div>
      ))}

      {!loading && orders.length === 0 && <p>No orders found.</p>}
    </div>
  );
};

export default OrdersGetAllPage;