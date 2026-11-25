import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getStore, currentUser } from '@/lib/db.mjs';
import { saveProfile } from '@/app/actions';
import { fmtDate } from '@/lib/format.mjs';

export const dynamic = 'force-dynamic';

// Public Instagram post/reel URL -> embeddable URL; anything else falls back to a direct link.
function embedUrl(u) {
  const m = /^https?:\/\/(?:www\.)?instagram\.com\/(p|reel|tv)\/([A-Za-z0-9_-]+)/.exec(u ?? '');
  return m ? `https://www.instagram.com/${m[1]}/${m[2]}/embed` : null;
}
const Stars = ({ n }) => <span className="stars" aria-label={`${n} of 5`}>{'★'.repeat(n)}{'☆'.repeat(5 - n)}</span>;
function Reviews({ title, list }) {
  return (
    <section>
      <h3>{title} <span className="small">({list.length})</span></h3>
      {list.length ? <ul className="plain">{list.map((r, i) => <li key={i}><Stars n={r.rating} /> <span className="small">· {r.event} · {fmtDate(r.at)}</span>{r.text && <p style={{ margin: '4px 0 0' }}>{r.text}</p>}</li>)}</ul> : <p className="small">None yet.</p>}
    </section>
  );
}

export default async function Vendor({ params, searchParams }) {
  const { id } = await params;
  const { saved } = await searchParams;
  const user = await currentUser();
  if (!user) redirect(`/?next=/vendors/${encodeURIComponent(id)}`);
  const v = getStore().vendorProfile(id);
  if (!v) notFound();
  const own = user.id === v.id;
  const embed = embedUrl(v.postUrl);
  const avg = l => (l.length ? (l.reduce((s, r) => s + r.rating, 0) / l.length).toFixed(1) : '–');
  return (
    <>
      <p className="small"><Link href="/vendors">← Vendors</Link></p>
      <div className="eyebrow">{v.service}{v.city ? ` · ${v.city}` : ''}</div>
      <h1>{v.name}</h1>
      {v.bio && <p>{v.bio}</p>}
      <dl className="stats">
        <div><dt>Completed events</dt><dd>{v.completedEvents}</dd></div>
        <div><dt>Guest check-ins</dt><dd>{v.guestCheckins}</dd><span className="small">at those events</span></div>
        <div><dt>Guests ★</dt><dd>{avg(v.guestReviews)}</dd></div>
        <div><dt>Hosts ★</dt><dd>{avg(v.hostReviews)}</dd></div>
      </dl>
      <section className="card">
        <div className="eyebrow">Contact directly</div>
        <div className="row">
          {v.phone && <a className="btn primary" href={`tel:${v.phone.replace(/\s/g, '')}`}>Call</a>}
          {v.phone && <a className="btn" href={`https://wa.me/${v.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">WhatsApp</a>}
          {v.email && <a className="btn" href={`mailto:${v.email}`}>Email</a>}
          {v.instagram && <a className="btn" href={`https://instagram.com/${v.instagram}`} target="_blank" rel="noreferrer">@{v.instagram}</a>}
        </div>
        <p className="small">No booking or payment through Gather — talk to the vendor.</p>
      </section>
      <section>
        <div className="eyebrow">Work</div>
        {embed ? (
          <><iframe className="ig" src={embed} title={`${v.name} on Instagram`} loading="lazy" allowTransparency sandbox="allow-scripts allow-same-origin allow-popups" />
            <p className="small"><a href={v.postUrl} target="_blank" rel="noreferrer">Open on Instagram →</a></p></>
        ) : v.instagram ? <p><a href={`https://instagram.com/${v.instagram}`} target="_blank" rel="noreferrer">See their work on Instagram →</a></p> : <p className="small">No work linked yet.</p>}
      </section>
      <Reviews title="Guest reviews" list={v.guestReviews} />
      <Reviews title="Host reviews" list={v.hostReviews} />
      {own && (
        <section className="card" id="edit">
          <div className="eyebrow">Edit your profile</div>
          {saved && <p className="ok">Saved.</p>}
          <form action={saveProfile}>
            <label htmlFor="bio">About</label><textarea id="bio" name="bio" defaultValue={v.bio ?? ''} />
            <label htmlFor="city">City</label><input id="city" name="city" defaultValue={v.city ?? ''} />
            <label htmlFor="ig">Instagram handle</label><input id="ig" name="instagram" defaultValue={v.instagram ?? ''} placeholder="yourstudio" />
            <label htmlFor="post">Public post or Reel URL to embed</label><input id="post" name="postUrl" defaultValue={v.postUrl ?? ''} placeholder="https://www.instagram.com/p/…" style={{ width: '100%' }} />
            <label htmlFor="ph">Phone</label><input id="ph" name="phone" defaultValue={v.phone ?? ''} />
            <label htmlFor="em">Email</label><input id="em" name="email" defaultValue={v.email ?? ''} />
            <p><button className="primary" style={{ marginTop: 10 }}>Save profile</button></p>
          </form>
        </section>
      )}
    </>
  );
}
