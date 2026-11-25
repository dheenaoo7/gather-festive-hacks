// Gather data layer: SQLite via Node's built-in node:sqlite.
// Roles are per event: lead host (events.host_id), co-host (event_cohosts), assigned vendor (assignments), invited guest (invitations).
// Privacy rules enforced here: hosts/vendors only ever get aggregates; guest coordinates are never stored.
import { DatabaseSync } from 'node:sqlite';
import { randomBytes } from 'node:crypto';

export const eventId = 'marigold-evening';
export const DUTIES = ['Welcome', 'Photo', 'Dining', 'Goodies'];
export const ACTIVITIES = ['Photo booth', 'Dinner', 'Rangoli', 'Music & dance'];
export const SERVICES = ['Photography', 'Videography', 'Decoration', 'Catering'];
export const PHOTO_BATCH_SIZE = 5;
export const FOOD_BATCH_SIZE = 8;
export const CHECKIN_RADIUS_M = 300;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL CHECK (role IN ('guest','host','vendor')), service TEXT, phone TEXT);
CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, title TEXT NOT NULL, venue TEXT NOT NULL, starts_at TEXT NOT NULL, host_id TEXT NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','live','completed')), venue_lat REAL, venue_lng REAL, checkin_code TEXT);
CREATE TABLE IF NOT EXISTS event_cohosts (event_id TEXT REFERENCES events(id), user_id TEXT REFERENCES users(id), duty TEXT, PRIMARY KEY (event_id, user_id));
CREATE TABLE IF NOT EXISTS assignments (event_id TEXT REFERENCES events(id), vendor_id TEXT REFERENCES users(id), PRIMARY KEY (event_id, vendor_id));
CREATE TABLE IF NOT EXISTS invitations (event_id TEXT REFERENCES events(id), guest_id TEXT REFERENCES users(id), PRIMARY KEY (event_id, guest_id));
CREATE TABLE IF NOT EXISTS rsvps (event_id TEXT, guest_id TEXT, response TEXT NOT NULL CHECK (response IN ('yes','no')), updated_at TEXT NOT NULL,
  PRIMARY KEY (event_id, guest_id), FOREIGN KEY (event_id, guest_id) REFERENCES invitations(event_id, guest_id));
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS calls (id TEXT PRIMARY KEY, guest_id TEXT NOT NULL, event_id TEXT NOT NULL, status TEXT NOT NULL, update_json TEXT, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS checkins (event_id TEXT, guest_id TEXT, at TEXT NOT NULL, method TEXT NOT NULL, PRIMARY KEY (event_id, guest_id));
CREATE TABLE IF NOT EXISTS photo_batches (event_id TEXT, no INTEGER, status TEXT NOT NULL CHECK (status IN ('open','shooting','paused','finished')), PRIMARY KEY (event_id, no));
CREATE TABLE IF NOT EXISTS photo_log (event_id TEXT, no INTEGER, kind TEXT NOT NULL, at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS photo_queue (event_id TEXT, guest_id TEXT, no INTEGER NOT NULL, joined_at TEXT NOT NULL, PRIMARY KEY (event_id, guest_id));
CREATE TABLE IF NOT EXISTS photos (id TEXT PRIMARY KEY, event_id TEXT NOT NULL, no INTEGER NOT NULL, file TEXT NOT NULL, mime TEXT NOT NULL, uploaded_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS food_optins (event_id TEXT, guest_id TEXT, no INTEGER NOT NULL, at TEXT NOT NULL, PRIMARY KEY (event_id, guest_id));
CREATE TABLE IF NOT EXISTS food_calls (event_id TEXT, no INTEGER, at TEXT NOT NULL, PRIMARY KEY (event_id, no));
CREATE TABLE IF NOT EXISTS goodies (event_id TEXT, guest_id TEXT, activities TEXT NOT NULL, code TEXT NOT NULL UNIQUE, completed_at TEXT NOT NULL, redeemed_at TEXT, PRIMARY KEY (event_id, guest_id));
CREATE TABLE IF NOT EXISTS reviews (vendor_id TEXT, event_id TEXT, author_id TEXT, author_role TEXT NOT NULL CHECK (author_role IN ('guest','host')), rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5), text TEXT, at TEXT NOT NULL,
  PRIMARY KEY (vendor_id, event_id, author_id));
CREATE TABLE IF NOT EXISTS vendor_profiles (vendor_id TEXT PRIMARY KEY, bio TEXT, city TEXT, instagram TEXT, post_url TEXT, phone TEXT, email TEXT);
`;

const SEED = {
  users: [
    ['guest', 'Asha', 'guest', null, null],
    ['kabir', 'Kabir', 'guest', null, null],
    ['nila', 'Nila', 'guest', null, null],
    ['uninvited', 'Ravi (not invited)', 'guest', null, null],
    ['host', 'Meera', 'host', null, null],
    ['kiran', 'Kiran', 'host', null, null],
    ['photographer', 'Marigold Studio', 'vendor', 'Photography', null],
    ['caterer', 'Festival Kitchen', 'vendor', 'Catering', null],
    ['videographer', 'Reel Ritual', 'vendor', 'Videography', null],
    ['decorator', 'Toran & Co', 'vendor', 'Decoration', null],
    ['unassigned', 'Courtyard Films', 'vendor', 'Videography', null],
  ],
  events: [
    [eventId, 'Marigold Evening', 'The Courtyard, Bengaluru', '2026-11-25T18:00:00+05:30', 'host', 'upcoming', 12.9716, 77.5946],
    ['diya-lane-potluck', 'Diya Lane Potluck', 'Asha’s terrace, Indiranagar', '2026-11-29T19:30:00+05:30', 'guest', 'upcoming', null, null],
    ['deepam-night', 'Karthigai Deepam Night', 'Kabir’s home, Jayanagar', '2026-12-03T18:30:00+05:30', 'kabir', 'upcoming', null, null],
    ['harvest-lunch', 'Harvest Lunch', 'Lalbagh Pavilion', '2026-11-18T12:30:00+05:30', 'host', 'completed', null, null],
  ],
  cohosts: [[eventId, 'kiran', 'Welcome'], ['diya-lane-potluck', 'host', 'Dining']],
  assignments: [[eventId, 'photographer'], [eventId, 'caterer'], [eventId, 'videographer'], [eventId, 'decorator'],
    ['diya-lane-potluck', 'caterer'], ['deepam-night', 'photographer'], ['deepam-night', 'decorator'],
    ['harvest-lunch', 'photographer'], ['harvest-lunch', 'caterer']],
  invitations: [[eventId, 'guest'], [eventId, 'kabir'], [eventId, 'nila'],
    ['diya-lane-potluck', 'kabir'], ['diya-lane-potluck', 'nila'],
    ['deepam-night', 'guest'], ['deepam-night', 'host'],
    ['harvest-lunch', 'guest'], ['harvest-lunch', 'nila'], ['harvest-lunch', 'kabir']],
  harvestCheckins: ['guest', 'nila', 'kabir'],
  profiles: [
    ['photographer', 'Candid festival and family portraits. Batch shoots so nobody waits long.', 'Bengaluru', 'marigoldstudio', '', '+91 98450 00001', 'hello@marigold.studio'],
    ['caterer', 'South Indian festive menus, banana-leaf service, live dosa counter.', 'Bengaluru', 'festivalkitchen', '', '+91 98450 00002', 'orders@festivalkitchen.in'],
    ['videographer', 'Short cinematic reels of your evening, delivered in a week.', 'Bengaluru', 'reelritual', '', '+91 98450 00003', 'hi@reelritual.in'],
    ['decorator', 'Marigold torans, diyas and floral rangoli setups.', 'Chennai', 'toranandco', '', '+91 98450 00004', 'studio@toran.co'],
    ['unassigned', 'Documentary-style event films.', 'Mysuru', 'courtyardfilms', '', '+91 98450 00005', 'team@courtyard.films'],
  ],
  reviews: [
    ['photographer', 'harvest-lunch', 'nila', 'guest', 5, 'Our batch was called on time and the photos are lovely.'],
    ['photographer', 'harvest-lunch', 'host', 'host', 5, 'Kept the queue moving; zero chaos.'],
    ['caterer', 'harvest-lunch', 'host', 'host', 4, 'Great food, batch calls worked well.'],
  ],
};

const now = () => new Date().toISOString();
const code = n => randomBytes(8).toString('base64url').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, n).padEnd(n, 'X');

export function distanceM(lat1, lng1, lat2, lng2) {
  const R = 6371000, rad = d => (d * Math.PI) / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Seconds spent shooting vs paused, derived from the log (started/paused/resumed/finished).
export function batchDurations(log, at = new Date()) {
  let shooting = 0, paused = 0, mode = null, since = null;
  for (const e of log) {
    const t = new Date(e.at).getTime();
    if (mode === 'shooting') shooting += t - since;
    if (mode === 'paused') paused += t - since;
    mode = e.kind === 'started' || e.kind === 'resumed' ? 'shooting' : e.kind === 'paused' ? 'paused' : null;
    since = t;
  }
  if (mode === 'shooting') shooting += at.getTime() - since;
  if (mode === 'paused') paused += at.getTime() - since;
  return { shooting: Math.round(shooting / 1000), paused: Math.round(paused / 1000) };
}

export function createStore(filename = ':memory:') {
  const db = new DatabaseSync(filename, { timeout: 5000 });
  db.exec('PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;');
  if (filename !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  const q = (sql, ...a) => db.prepare(sql).all(...a);
  const one = (sql, ...a) => db.prepare(sql).get(...a) ?? null;
  const run = (sql, ...a) => db.prepare(sql).run(...a);

  if (!one('SELECT 1 FROM events WHERE id = ?', eventId)) {
    db.exec('BEGIN IMMEDIATE');
    for (const r of SEED.users) run('INSERT OR IGNORE INTO users VALUES (?,?,?,?,?)', ...r);
    for (const [id, t, v, s, h, st, la, ln] of SEED.events) run('INSERT OR IGNORE INTO events VALUES (?,?,?,?,?,?,?,?,?)', id, t, v, s, h, st, la, ln, code(4));
    for (const r of SEED.cohosts) run('INSERT OR IGNORE INTO event_cohosts VALUES (?,?,?)', ...r);
    for (const r of SEED.assignments) run('INSERT OR IGNORE INTO assignments VALUES (?,?)', ...r);
    for (const r of SEED.invitations) run('INSERT OR IGNORE INTO invitations VALUES (?,?)', ...r);
    for (const g of SEED.harvestCheckins) {
      run('INSERT OR IGNORE INTO rsvps VALUES (?,?,?,?)', 'harvest-lunch', g, 'yes', '2026-11-15T10:00:00.000Z');
      run('INSERT OR IGNORE INTO checkins VALUES (?,?,?,?)', 'harvest-lunch', g, '2026-11-18T07:05:00.000Z', 'location');
    }
    for (const r of SEED.profiles) run('INSERT OR IGNORE INTO vendor_profiles VALUES (?,?,?,?,?,?,?)', ...r);
    for (const r of SEED.reviews) run('INSERT OR IGNORE INTO reviews VALUES (?,?,?,?,?,?,?)', ...r, '2026-11-19T10:00:00.000Z');
    db.exec('COMMIT');
  }

  const user = id => (typeof id === 'string' ? one('SELECT id, name, role, service, phone FROM users WHERE id = ?', id) : null);
  const event = id => one(`SELECT id, title, venue, starts_at AS startsAt, host_id AS hostId, status, venue_lat AS venueLat, venue_lng AS venueLng FROM events WHERE id = ?`, id);
  const isInvited = (u, e) => !!one('SELECT 1 FROM invitations WHERE event_id = ? AND guest_id = ?', e, u);
  const isLead = (u, e) => !!one('SELECT 1 FROM events WHERE id = ? AND host_id = ?', e, u);
  const cohost = (u, e) => one('SELECT duty FROM event_cohosts WHERE event_id = ? AND user_id = ?', e, u);
  const isAssigned = (u, e) => !!one('SELECT 1 FROM assignments WHERE event_id = ? AND vendor_id = ?', e, u);
  const totals = e => {
    const t = { yes: 0, no: 0 };
    for (const r of q('SELECT response, COUNT(*) AS n FROM rsvps WHERE event_id = ? GROUP BY response', e)) t[r.response] = r.n;
    return t;
  };
  const checkedIn = (u, e) => !!one('SELECT 1 FROM checkins WHERE event_id = ? AND guest_id = ?', e, u);
  const batchLog = (e, no) => q('SELECT kind, at FROM photo_log WHERE event_id = ? AND no = ? ORDER BY rowid', e, no);
  const isPhotographer = (u, e) => { const r = roleAt(u, e); return r?.kind === 'vendor' && r.service === 'Photography'; };
  const isCaterer = (u, e) => { const r = roleAt(u, e); return r?.kind === 'vendor' && r.service === 'Catering'; };

  // Which hat does this user wear at this event? lead > cohost > vendor > guest.
  function roleAt(userId, e) {
    const u = user(userId);
    if (!u || !event(e)) return null;
    if (isLead(u.id, e)) return { kind: 'host', lead: true, duty: null };
    const c = cohost(u.id, e);
    if (c) return { kind: 'host', lead: false, duty: c.duty };
    if (u.role === 'vendor' && isAssigned(u.id, e)) return { kind: 'vendor', service: u.service };
    if (u.role !== 'vendor' && isInvited(u.id, e)) return { kind: 'guest' };
    return null;
  }

  const store = {
    users: () => q('SELECT id, name, role, service FROM users ORDER BY rowid'),
    user,
    event,
    roleAt,
    view(userId, e) {
      const r = roleAt(userId, e);
      if (!r) return null;
      const ev = event(e);
      if (r.kind === 'guest') return { event: ev, response: one('SELECT response FROM rsvps WHERE event_id = ? AND guest_id = ?', e, userId)?.response ?? null };
      return { event: ev, totals: totals(e) };
    },
    eventsFor(userId) {
      return q('SELECT id FROM events ORDER BY starts_at').map(r => r.id).filter(e => roleAt(userId, e)).map(event);
    },
    calendarFor(userId) {
      return q('SELECT id FROM events ORDER BY starts_at').map(r => ({ event: event(r.id), role: roleAt(userId, r.id) })).filter(x => x.role);
    },
    saveRsvp(userId, e, response) {
      const u = user(userId);
      if (!u || roleAt(u.id, e)?.kind !== 'guest' || !['yes', 'no'].includes(response)) return false;
      run(`INSERT INTO rsvps VALUES (?,?,?,?) ON CONFLICT(event_id, guest_id) DO UPDATE SET response = excluded.response, updated_at = excluded.updated_at`, e, u.id, response, now());
      return true;
    },

    // ---- host controls ----
    setStatus(userId, e, status) {
      if (!isLead(userId, e) || !['upcoming', 'live', 'completed'].includes(status)) return false;
      run('UPDATE events SET status = ? WHERE id = ?', status, e);
      return true;
    },
    setVenuePin(userId, e, lat, lng) {
      if (!isLead(userId, e) || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
      run('UPDATE events SET venue_lat = ?, venue_lng = ? WHERE id = ?', lat, lng, e);
      return true;
    },
    checkinCode(userId, e) {
      return roleAt(userId, e)?.kind === 'host' ? one('SELECT checkin_code AS c FROM events WHERE id = ?', e).c : null;
    },
    cohosts(userId, e) {
      if (roleAt(userId, e)?.kind !== 'host') return null;
      return q('SELECT u.id, u.name, c.duty FROM event_cohosts c JOIN users u ON u.id = c.user_id WHERE c.event_id = ? ORDER BY u.name', e);
    },
    assignDuty(userId, e, cohostId, duty) {
      if (!isLead(userId, e) || !cohost(cohostId, e) || (duty !== null && !DUTIES.includes(duty))) return false;
      db.exec('BEGIN IMMEDIATE');
      if (duty) run('UPDATE event_cohosts SET duty = NULL WHERE event_id = ? AND duty = ?', e, duty);
      run('UPDATE event_cohosts SET duty = ? WHERE event_id = ? AND user_id = ?', duty, e, cohostId);
      db.exec('COMMIT');
      return true;
    },
    // Aggregates for the host desk. No names, no individual answers.
    hostSummary(userId, e) {
      if (roleAt(userId, e)?.kind !== 'host') return null;
      const n = sql => one(sql, e).n;
      return {
        invited: n('SELECT COUNT(*) AS n FROM invitations WHERE event_id = ?'),
        rsvp: totals(e),
        arrived: n('SELECT COUNT(*) AS n FROM checkins WHERE event_id = ?'),
        photo: {
          queued: n('SELECT COUNT(*) AS n FROM photo_queue WHERE event_id = ?'),
          batches: n('SELECT COUNT(*) AS n FROM photo_batches WHERE event_id = ?'),
          finished: n(`SELECT COUNT(*) AS n FROM photo_batches WHERE event_id = ? AND status = 'finished'`),
        },
        food: { optedIn: n('SELECT COUNT(*) AS n FROM food_optins WHERE event_id = ?'), called: n('SELECT COUNT(*) AS n FROM food_calls WHERE event_id = ?') },
        goodies: { issued: n('SELECT COUNT(*) AS n FROM goodies WHERE event_id = ?'), redeemed: n('SELECT COUNT(*) AS n FROM goodies WHERE event_id = ? AND redeemed_at IS NOT NULL') },
      };
    },
    vendorsAt(e) {
      return q('SELECT u.id, u.name, u.service FROM assignments a JOIN users u ON u.id = a.vendor_id WHERE a.event_id = ? ORDER BY u.service', e);
    },
    // Invitee names + whether a phone is on file, with last call status. Never the RSVP answer.
    callList(userId, e) {
      if (roleAt(userId, e)?.kind !== 'host') return null;
      const last = g => one('SELECT status, updated_at AS updatedAt FROM calls WHERE event_id = ? AND guest_id = ? ORDER BY updated_at DESC LIMIT 1', e, g);
      return q('SELECT u.id, u.name, u.phone FROM invitations i JOIN users u ON u.id = i.guest_id WHERE i.event_id = ? ORDER BY u.name', e)
        .map(g => ({ id: g.id, name: g.name, hasPhone: !!g.phone, lastCall: last(g.id) }));
    },
    setPhone(id, phone) { run('UPDATE users SET phone = ? WHERE id = ?', phone, id); },

    // ---- arrival ----
    checkIn(userId, e, { lat, lng, code: c } = {}) {
      if (roleAt(userId, e)?.kind !== 'guest') return { ok: false, reason: 'not_invited' };
      const ev = one('SELECT status, venue_lat AS la, venue_lng AS ln, checkin_code AS c FROM events WHERE id = ?', e);
      if (ev.status !== 'live') return { ok: false, reason: 'not_live' };
      if (checkedIn(userId, e)) return { ok: true, already: true };
      let method;
      if (typeof c === 'string' && c.trim()) {
        if (c.trim().toUpperCase() !== ev.c) return { ok: false, reason: 'bad_code' };
        method = 'code';
      } else {
        if (ev.la == null) return { ok: false, reason: 'no_pin' };
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { ok: false, reason: 'no_location' };
        const d = distanceM(lat, lng, ev.la, ev.ln);
        if (d > CHECKIN_RADIUS_M) return { ok: false, reason: 'too_far', distance: Math.round(d) };
        method = 'location';
      }
      // Coordinates are only compared above; only the arrival is stored.
      run('INSERT OR IGNORE INTO checkins VALUES (?,?,?,?)', e, userId, now(), method);
      return { ok: true };
    },
    checkedIn,

    // ---- photo queue ----
    joinPhotoQueue(userId, e) {
      if (roleAt(userId, e)?.kind !== 'guest' || !checkedIn(userId, e)) return null;
      const existing = one('SELECT no FROM photo_queue WHERE event_id = ? AND guest_id = ?', e, userId);
      if (existing) return existing.no;
      db.exec('BEGIN IMMEDIATE');
      const b = one(`SELECT b.no FROM photo_batches b WHERE b.event_id = ? AND b.status = 'open'
        AND (SELECT COUNT(*) FROM photo_queue p WHERE p.event_id = b.event_id AND p.no = b.no) < ? ORDER BY b.no LIMIT 1`, e, PHOTO_BATCH_SIZE);
      let no = b?.no;
      if (!no) {
        no = (one('SELECT MAX(no) AS m FROM photo_batches WHERE event_id = ?', e).m ?? 0) + 1;
        run(`INSERT INTO photo_batches VALUES (?,?,'open')`, e, no);
      }
      run('INSERT INTO photo_queue VALUES (?,?,?,?)', e, userId, no, now());
      db.exec('COMMIT');
      return no;
    },
    leavePhotoQueue(userId, e) {
      const r = one(`SELECT p.no, b.status FROM photo_queue p JOIN photo_batches b ON b.event_id = p.event_id AND b.no = p.no WHERE p.event_id = ? AND p.guest_id = ?`, e, userId);
      if (!r || r.status !== 'open') return false; // roster locks when the batch starts
      run('DELETE FROM photo_queue WHERE event_id = ? AND guest_id = ?', e, userId);
      return true;
    },
    guestPhoto(userId, e) {
      const r = one('SELECT no FROM photo_queue WHERE event_id = ? AND guest_id = ?', e, userId);
      if (!r) return null;
      const b = one('SELECT status FROM photo_batches WHERE event_id = ? AND no = ?', e, r.no);
      const ahead = one(`SELECT COUNT(*) AS n FROM photo_batches WHERE event_id = ? AND no < ? AND status != 'finished'`, e, r.no).n;
      return { no: r.no, status: b.status, ahead, log: batchLog(e, r.no) };
    },
    photoBatches(userId, e) {
      if (!isPhotographer(userId, e)) return null;
      return q('SELECT no, status FROM photo_batches WHERE event_id = ? ORDER BY no', e).map(b => ({
        ...b,
        size: one('SELECT COUNT(*) AS n FROM photo_queue WHERE event_id = ? AND no = ?', e, b.no).n,
        photos: one('SELECT COUNT(*) AS n FROM photos WHERE event_id = ? AND no = ?', e, b.no).n,
        log: batchLog(e, b.no),
      }));
    },
    // start | pause | resume | finish. Only one batch may be shooting or paused at a time; resume keeps the same batch.
    photoAction(userId, e, no, action) {
      if (!isPhotographer(userId, e)) return false;
      const b = one('SELECT status FROM photo_batches WHERE event_id = ? AND no = ?', e, no);
      if (!b) return false;
      const active = one(`SELECT no FROM photo_batches WHERE event_id = ? AND status IN ('shooting','paused')`, e);
      const size = one('SELECT COUNT(*) AS n FROM photo_queue WHERE event_id = ? AND no = ?', e, no).n;
      const t = {
        start: b.status === 'open' && !active && size > 0 ? ['shooting', 'started'] : null,
        pause: b.status === 'shooting' ? ['paused', 'paused'] : null,
        resume: b.status === 'paused' ? ['shooting', 'resumed'] : null,
        finish: ['shooting', 'paused'].includes(b.status) ? ['finished', 'finished'] : null,
      }[action];
      if (!t) return false;
      run('UPDATE photo_batches SET status = ? WHERE event_id = ? AND no = ?', t[0], e, no);
      run('INSERT INTO photo_log VALUES (?,?,?,?)', e, no, t[1], now());
      return true;
    },
    addPhoto(userId, e, no, file, mime) {
      if (!isPhotographer(userId, e)) return null;
      const b = one('SELECT status FROM photo_batches WHERE event_id = ? AND no = ?', e, no);
      if (!b || b.status === 'open') return null;
      const id = randomBytes(12).toString('base64url');
      run('INSERT INTO photos VALUES (?,?,?,?,?,?)', id, e, no, file, mime, now());
      return id;
    },
    // After Event gallery: a guest sees only their own batch, and only once it is finished.
    galleryFor(userId, e) {
      const g = one(`SELECT p.no FROM photo_queue p JOIN photo_batches b ON b.event_id = p.event_id AND b.no = p.no
        WHERE p.event_id = ? AND p.guest_id = ? AND b.status = 'finished'`, e, userId);
      if (!g) return null;
      return { no: g.no, photos: q('SELECT id, uploaded_at AS at FROM photos WHERE event_id = ? AND no = ? ORDER BY uploaded_at', e, g.no) };
    },
    photoFor(userId, photoId) {
      const p = one('SELECT id, event_id AS e, no, file, mime FROM photos WHERE id = ?', photoId);
      if (!p) return null;
      if (isPhotographer(userId, p.e)) return p;
      const g = store.galleryFor(userId, p.e);
      return g && g.no === p.no ? p : null;
    },

    // ---- food ----
    foodOptIn(userId, e) {
      if (roleAt(userId, e)?.kind !== 'guest' || !checkedIn(userId, e)) return null;
      const ex = one('SELECT no FROM food_optins WHERE event_id = ? AND guest_id = ?', e, userId);
      if (ex) return ex.no;
      db.exec('BEGIN IMMEDIATE');
      let no = (one('SELECT MAX(no) AS m FROM food_calls WHERE event_id = ?', e).m ?? 0) + 1;
      while (one('SELECT COUNT(*) AS n FROM food_optins WHERE event_id = ? AND no = ?', e, no).n >= FOOD_BATCH_SIZE) no++;
      run('INSERT INTO food_optins VALUES (?,?,?,?)', e, userId, no, now());
      db.exec('COMMIT');
      return no;
    },
    foodOptOut(userId, e) {
      const r = one('SELECT no FROM food_optins WHERE event_id = ? AND guest_id = ?', e, userId);
      if (!r || one('SELECT 1 FROM food_calls WHERE event_id = ? AND no = ?', e, r.no)) return false;
      run('DELETE FROM food_optins WHERE event_id = ? AND guest_id = ?', e, userId);
      return true;
    },
    guestFood(userId, e) {
      const r = one('SELECT no FROM food_optins WHERE event_id = ? AND guest_id = ?', e, userId);
      if (!r) return null;
      const call = one('SELECT at FROM food_calls WHERE event_id = ? AND no = ?', e, r.no);
      const nowServing = one('SELECT MAX(no) AS m FROM food_calls WHERE event_id = ?', e).m ?? 0;
      return { no: r.no, calledAt: call?.at ?? null, nowServing };
    },
    foodBatches(userId, e) {
      if (!isCaterer(userId, e)) return null;
      const rows = q('SELECT no, COUNT(*) AS optedIn FROM food_optins WHERE event_id = ? GROUP BY no ORDER BY no', e);
      const calls = Object.fromEntries(q('SELECT no, at FROM food_calls WHERE event_id = ?', e).map(c => [c.no, c.at]));
      return rows.map(b => ({ ...b, calledAt: calls[b.no] ?? null }));
    },
    callNextFood(userId, e) {
      if (!isCaterer(userId, e)) return null;
      const next = (one('SELECT MAX(no) AS m FROM food_calls WHERE event_id = ?', e).m ?? 0) + 1;
      if (!one('SELECT 1 FROM food_optins WHERE event_id = ? AND no = ?', e, next)) return null;
      run('INSERT INTO food_calls VALUES (?,?,?)', e, next, now());
      return next;
    },

    // ---- goodies ----
    submitGoodies(userId, e, activities) {
      if (roleAt(userId, e)?.kind !== 'guest' || !checkedIn(userId, e)) return null;
      const ex = one('SELECT code FROM goodies WHERE event_id = ? AND guest_id = ?', e, userId);
      if (ex) return ex.code;
      const picked = [...new Set((activities ?? []).filter(a => ACTIVITIES.includes(a)))];
      const c = code(6);
      run('INSERT INTO goodies VALUES (?,?,?,?,?,NULL)', e, userId, JSON.stringify(picked), c, now());
      return c;
    },
    guestGoodies(userId, e) {
      return one('SELECT code, redeemed_at AS redeemedAt FROM goodies WHERE event_id = ? AND guest_id = ?', e, userId);
    },
    canRedeem(userId, e) {
      const r = roleAt(userId, e);
      return r?.kind === 'host' && (r.lead || r.duty === 'Goodies');
    },
    redeemGoodies(userId, e, c) {
      if (!store.canRedeem(userId, e) || typeof c !== 'string') return { ok: false, reason: 'not_allowed' };
      const k = c.trim().toUpperCase();
      const g = one('SELECT redeemed_at FROM goodies WHERE event_id = ? AND code = ?', e, k);
      if (!g) return { ok: false, reason: 'unknown' };
      if (g.redeemed_at) return { ok: false, reason: 'already' };
      run('UPDATE goodies SET redeemed_at = ? WHERE event_id = ? AND code = ?', now(), e, k);
      return { ok: true };
    },
    activityCounts(userId, e) {
      if (roleAt(userId, e)?.kind !== 'host') return null;
      const counts = Object.fromEntries(ACTIVITIES.map(a => [a, 0]));
      for (const r of q('SELECT activities FROM goodies WHERE event_id = ?', e)) for (const a of JSON.parse(r.activities)) counts[a]++;
      return counts;
    },

    // ---- vendors, profiles, reviews ----
    vendors(service) {
      return q(`SELECT u.id, u.name, u.service, p.city FROM users u LEFT JOIN vendor_profiles p ON p.vendor_id = u.id WHERE u.role = 'vendor' ${service ? 'AND u.service = ?' : ''} ORDER BY u.name`, ...(service ? [service] : []));
    },
    vendorProfile(id) {
      const u = user(id);
      if (!u || u.role !== 'vendor') return null;
      const p = one('SELECT bio, city, instagram, post_url AS postUrl, phone, email FROM vendor_profiles WHERE vendor_id = ?', id) ?? {};
      const done = q(`SELECT e.id FROM assignments a JOIN events e ON e.id = a.event_id WHERE a.vendor_id = ? AND e.status = 'completed'`, id).map(r => r.id);
      const checkins = done.reduce((s, e) => s + one('SELECT COUNT(*) AS n FROM checkins WHERE event_id = ?', e).n, 0);
      const reviews = role => q(`SELECT r.rating, r.text, r.at, ev.title AS event FROM reviews r JOIN events ev ON ev.id = r.event_id WHERE r.vendor_id = ? AND r.author_role = ? ORDER BY r.at DESC`, id, role);
      const { phone: _ignored, ...pub } = u;
      return { ...pub, ...p, completedEvents: done.length, guestCheckins: checkins, guestReviews: reviews('guest'), hostReviews: reviews('host') };
    },
    saveProfile(userId, fields) {
      const u = user(userId);
      if (!u || u.role !== 'vendor') return false;
      const f = k => (typeof fields[k] === 'string' ? fields[k].trim().slice(0, 400) : '');
      run(`INSERT INTO vendor_profiles VALUES (?,?,?,?,?,?,?) ON CONFLICT(vendor_id) DO UPDATE SET bio=excluded.bio, city=excluded.city, instagram=excluded.instagram, post_url=excluded.post_url, phone=excluded.phone, email=excluded.email`,
        userId, f('bio'), f('city'), f('instagram').replace(/^@/, ''), f('postUrl'), f('phone'), f('email'));
      return true;
    },
    // Guests review vendors of events they checked in to; hosts review vendors of their events. Kept separate by author_role.
    review(userId, e, vendorId, rating, text) {
      const r = roleAt(userId, e);
      if (!isAssigned(vendorId, e) || !(rating >= 1 && rating <= 5)) return false;
      let role;
      if (r?.kind === 'guest' && checkedIn(userId, e)) role = 'guest';
      else if (r?.kind === 'host') role = 'host';
      else return false;
      run(`INSERT INTO reviews VALUES (?,?,?,?,?,?,?) ON CONFLICT(vendor_id, event_id, author_id) DO UPDATE SET rating=excluded.rating, text=excluded.text, at=excluded.at`,
        vendorId, e, userId, role, Math.round(rating), String(text ?? '').slice(0, 500), now());
      return true;
    },
    myReviews(userId, e) {
      return Object.fromEntries(q('SELECT vendor_id, rating FROM reviews WHERE event_id = ? AND author_id = ?', e, userId).map(r => [r.vendor_id, r.rating]));
    },

    // ---- sessions ----
    newSession(userId) {
      if (!user(userId)) return null;
      const token = randomBytes(24).toString('base64url');
      run('INSERT INTO sessions VALUES (?,?,?)', token, userId, now());
      return token;
    },
    fromSession(token) {
      if (typeof token !== 'string') return null;
      const s = one('SELECT user_id FROM sessions WHERE token = ?', token);
      return s ? user(s.user_id) : null;
    },
    endSession(token) { if (typeof token === 'string') run('DELETE FROM sessions WHERE token = ?', token); },

    // ---- voice calls ----
    recordCall(id, guestId, e) { run(`INSERT OR REPLACE INTO calls VALUES (?,?,?,'initiated',null,?)`, id, guestId, e, now()); },
    updateCall(id, status, updateData = null) {
      run('UPDATE calls SET status = ?, update_json = COALESCE(?, update_json), updated_at = ? WHERE id = ?', status, updateData ? JSON.stringify(updateData) : null, now(), id);
    },
    call(id) { return one('SELECT id, guest_id, event_id, status, update_json, updated_at FROM calls WHERE id = ?', id); },
    callsFor(userId, e) {
      if (roleAt(userId, e)?.kind !== 'host') return null;
      return q('SELECT guest_id AS guest, status, updated_at AS updatedAt FROM calls WHERE event_id = ? ORDER BY updated_at DESC', e);
    },
    close: () => db.close(),
  };
  return store;
}
