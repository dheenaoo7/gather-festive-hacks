import './globals.css';

export const metadata = { title: 'Gather', description: 'Event-day coordination (dummy build)' };
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#742c37' };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <main>
          <header><span className="brand">❖ Gather</span><span className="tag">Dummy build</span></header>
          {children}
        </main>
      </body>
    </html>
  );
}
