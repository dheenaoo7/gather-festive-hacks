import './globals.css';
import Link from 'next/link';
import Lights from '@/components/Lights';
import { currentUser } from '@/lib/db.mjs';
import { signOut } from './actions';

export const metadata = { title: 'Gather', description: 'Festive event coordination for guests, hosts and vendors' };
export const viewport = { width: 'device-width', initialScale: 1, themeColor: '#692c3b' };

export default async function RootLayout({ children }) {
  const user = await currentUser();
  return (
    <html lang="en">
      <body>
        <Lights side="left" /><Lights side="right" />
        <main>
          <header>
            <Link href={user ? '/calendar' : '/'} className="brand">❖ Gather</Link>
            {user && (
              <nav>
                <Link href="/calendar">Calendar</Link>
                <Link href={user.role === 'vendor' ? `/vendors/${user.id}` : '/vendors'}>{user.role === 'vendor' ? 'My profile' : 'Vendors'}</Link>
                <form action={signOut}><button className="link" title={`Signed in as ${user.name}`}>Switch</button></form>
              </nav>
            )}
          </header>
          {children}
        </main>
      </body>
    </html>
  );
}
