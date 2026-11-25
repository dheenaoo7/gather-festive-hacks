// Dummy data layer: SQLite via Node's built-in node:sqlite. Seeded with one demo event.
import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';

export const eventId = 'marigold-evening';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('guest','host','vendor')), service TEXT);
CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, title TEXT NOT NULL, venue TEXT NOT NULL, starts_at TEXT NOT NULL, host_id TEXT NOT NULL REFERENCES users(id));
CREATE TABLE IF NOT EXISTS assignments (event_id TEXT REFERENCES events(id), vendor_id TEXT REFERENCES users(id), PRIMARY KEY (event_id, vendor_id));
CREATE TABLE IF NOT EXISTS invitations (event_id TEXT REFERENCES events(id), guest_id TEXT REFERENCES users(id), PRIMARY KEY (event_id, guest_id));
CREATE TABLE IF NOT EXISTS rsvps (event_id TEXT, guest_id TEXT, response TEXT NOT NULL CHECK (response IN ('yes','no')), updated_at TEXT NOT NULL,
  PRIMARY KEY (event_id, guest_id), FOREIGN KEY (event_id, guest_id) REFERENCES invitations(event_id, guest_id));
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS calls (id TEXT PRIMARY KEY, guest_id TEXT NOT NULL, event_id TEXT NOT NULL, status TEXT NOT NULL, update_json TEXT, updated_at TEXT NOT NULL);
`;

const SEED = {
  users: [
    ['guest', 'Asha (guest)', 'guest', null],
    ['uninvited', 'Ravi (not invited)', 'guest', null],
    ['host', 'Meera (host)', 'host', null],
    ['photographer', 'Marigold Studio', 'vendor', 'Photography'],
    ['caterer', 'Festival Kitchen', 'vendor', 'Catering'],
    ['unassigned', 'Courtyard Films (unassigned)', 'vendor', 'Videography'],
  ],
  event: [eventId, 'Marigold Evening', 'The Courtyard, Bengaluru', '2026-11-28T18:00:00+05:30', 'host'],
  assignments: ['photographer', 'caterer'],
  invitations: ['guest'],
};

export function createStore(filename = ':memory:') {
  // timeout: wait for other processes (e.g. parallel build workers) instead of failing with SQLITE_BUSY.
  const db = new DatabaseSync(filename, { timeout: 5000 });
  db.exec('PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;');
  if (filename !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  if (!db.prepare('SELECT 1 FROM events WHERE id = ?').get(eventId)) {
    db.exec('BEGIN IMMEDIATE');
    const u = db.prepare('INSERT OR IGNORE INTO users VALUES (?,?,?,?)');
    for (const row of SEED.users) u.run(...row);
    db.prepare('INSERT OR IGNORE INTO events VALUES (?,?,?,?,?)').run(...SEED.event);
    for (const v of SEED.assignments) db.prepare('INSERT OR IGNORE INTO assignments VALUES (?,?)').run(eventId, v);
    for (const g of SEED.invitations) db.prepare('INSERT OR IGNORE INTO invitations VALUES (?,?)').run(eventId, g);
    db.exec('COMMIT');
  }

  const user = id => (typeof id === 'string' ? db.prepare('SELECT id, name, role, service FROM users WHERE id = ?').get(id) ?? null : null);
  const event = id => db.prepare('SELECT id, title, venue, starts_at AS startsAt FROM events WHERE id = ?').get(id) ?? null;
  const isInvited = (u, e) => !!db.prepare('SELECT 1 FROM invitations WHERE event_id = ? AND guest_id = ?').get(e, u);
  const canSeeTotals = (u, e) =>
    !!db.prepare('SELECT 1 FROM events WHERE id = ? AND host_id = ?').get(e, u) ||
    !!db.prepare('SELECT 1 FROM assignments WHERE event_id = ? AND vendor_id = ?').get(e, u);
  const totals = e => {
    const t = { yes: 0, no: 0 };
    for (const r of db.prepare('SELECT response, COUNT(*) AS n FROM rsvps WHERE event_id = ? GROUP BY response').all(e)) t[r.response] = r.n;
    return t;
  };

  return {
    users: () => db.prepare('SELECT id, name, role, service FROM users ORDER BY rowid').all(),
    user,
    // Guests get their own response only; host and assigned vendors get totals only; everyone else gets null.
    view(userId, e) {
      const u = user(userId), ev = event(e);
      if (!u || !ev) return null;
      if (u.role === 'guest' && isInvited(u.id, e)) {
        const r = db.prepare('SELECT response FROM rsvps WHERE event_id = ? AND guest_id = ?').get(e, u.id);
        return { event: ev, response: r?.response ?? null };
      }
      if (u.role !== 'guest' && canSeeTotals(u.id, e)) return { event: ev, totals: totals(e) };
      return null;
    },
    eventsFor(userId) {
      return db.prepare('SELECT id FROM events').all().map(r => r.id).filter(e => this.view(userId, e)).map(event);
    },
    saveRsvp(userId, e, response) {
      const u = user(userId);
      if (!u || u.role !== 'guest' || !['yes', 'no'].includes(response) || !isInvited(u.id, e)) return false;
      db.prepare(`INSERT INTO rsvps VALUES (?,?,?,?) ON CONFLICT(event_id, guest_id) DO UPDATE SET response = excluded.response, updated_at = excluded.updated_at`)
        .run(e, u.id, response, new Date().toISOString());
      return true;
    },
    newSession(userId) {
      if (!user(userId)) return null;
      const token = randomBytes(24).toString('base64url');
      db.prepare('INSERT INTO sessions VALUES (?,?,?)').run(token, userId, new Date().toISOString());
      return token;
    },
    fromSession(token) {
      if (typeof token !== 'string') return null;
      const s = db.prepare('SELECT user_id FROM sessions WHERE token = ?').get(token);
      return s ? user(s.user_id) : null;
    },
    endSession(token) { if (typeof token === 'string') db.prepare('DELETE FROM sessions WHERE token = ?').run(token); },
    recordCall(id, guestId, e) {
      db.prepare('INSERT OR REPLACE INTO calls VALUES (?,?,?,?,null,?)')
        .run(id, guestId, e, 'initiated', new Date().toISOString());
    },
    updateCall(id, status, updateData = null) {
      const json = updateData ? JSON.stringify(updateData) : null;
      db.prepare('UPDATE calls SET status = ?, update_json = COALESCE(?, update_json), updated_at = ? WHERE id = ?')
        .run(status, json, new Date().toISOString(), id);
    },
    call(id) {
      return db.prepare('SELECT id, guest_id, event_id, status, update_json, updated_at FROM calls WHERE id = ?').get(id) ?? null;
    },
    callsFor(userId, e) {
      const u = user(userId);
      if (!u || u.role !== 'host') return null;
      return db.prepare('SELECT guest_id AS guest, status, updated_at AS updatedAt FROM calls WHERE event_id = ? ORDER BY updated_at DESC').all(e);
    },
    close: () => db.close(),
  };
}
