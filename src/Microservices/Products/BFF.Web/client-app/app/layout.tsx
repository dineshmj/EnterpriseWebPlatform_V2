import type { Metadata } from 'next';
import './globals.css';
import ErrorBoundary from './components/ErrorBoundary';
import ReduxProviderWrapper from './components/ReduxProviderWrapper';
import { ShellBridge } from './components/ShellBridge';
import { ContextStatusStrip } from './components/ContextStatusStrip';

export const metadata: Metadata = {
  title: 'Products Microsrevice BFF',
  description: 'Next.js BFF for Products Microservice',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ReduxProviderWrapper>
          <ErrorBoundary>
            <ShellBridge />
            {/* paddingBottom reserves space so page content never sits behind the fixed strip below */}
            <div style={{ paddingBottom: '2.25rem' }}>
               {children}
            </div>
            <ContextStatusStrip />
          </ErrorBoundary>
        </ReduxProviderWrapper>
      </body>
    </html>
  );
}