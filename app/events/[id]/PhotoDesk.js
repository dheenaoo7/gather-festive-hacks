import Timeline from './Timeline';
import { photoAction } from '@/app/actions';

const NEXT = { open: [['start', 'Start batch', true]], shooting: [['pause', 'Pause', false], ['finish', 'Finish batch', true]], paused: [['resume', 'Resume same batch', true], ['finish', 'Finish batch', false]], finished: [] };
const LABEL = { open: 'Waiting', shooting: 'Shooting', paused: 'Paused', finished: 'Finished' };

export default function PhotoDesk({ user, event, store, sp }) {
  const e = event.id;
  const batches = store.photoBatches(user.id, e);
  const totals = store.view(user.id, e).totals;
  const active = batches.find(b => ['shooting', 'paused'].includes(b.status));
  const nextUp = batches.find(b => b.status === 'open' && b.size > 0);
  const current = active ?? nextUp;
  return (
    <>
      <dl className="stats"><div><dt>Going</dt><dd>{totals.yes}</dd></div><div><dt>Batches</dt><dd>{batches.length}</dd></div><div><dt>Done</dt><dd>{batches.filter(b => b.status === 'finished').length}</dd></div></dl>
      {sp.uploaded && <p className="ok">Uploaded {sp.uploaded} photo{sp.uploaded === '1' ? '' : 's'}.</p>}
      {event.status !== 'live' && <p className="small">The queue fills once the host starts the event and guests check in.</p>}
      {current ? <BatchCard b={current} e={e} hero blocked={!!active && current !== active} /> : <p>No guests in the photo queue yet.</p>}
      <section>
        <h2>Run sheet</h2>
        {batches.filter(b => b !== current).map(b => <BatchCard key={b.no} b={b} e={e} blocked={!!active} />)}
        {batches.length <= 1 && <p className="small">Other batches appear here as guests join.</p>}
      </section>
    </>
  );
}

function BatchCard({ b, e, hero, blocked }) {
  return (
    <section className={hero ? 'status' : 'card'}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Batch {b.no}</h2><span className="pill">{LABEL[b.status]}</span>
      </div>
      <p>{b.size} guest{b.size === 1 ? '' : 's'}{b.status !== 'open' ? ' · roster locked' : ''} · {b.photos} photo{b.photos === 1 ? '' : 's'}</p>
      <Timeline log={b.log} />
      <form action={photoAction} className="row" style={{ marginTop: 8 }}>
        <input type="hidden" name="eventId" value={e} /><input type="hidden" name="no" value={b.no} />
        {NEXT[b.status].map(([a, label, primary]) => <button key={a} name="action" value={a} className={primary ? 'primary' : ''} disabled={a === 'start' && (blocked || !b.size)}>{label}</button>)}
      </form>
      {b.status !== 'open' && (
        <form action="/api/photos" method="post" encType="multipart/form-data" className="row" style={{ marginTop: 8 }}>
          <input type="hidden" name="eventId" value={e} /><input type="hidden" name="no" value={b.no} />
          <input type="file" name="photos" accept="image/*" multiple required aria-label={`Photos for batch ${b.no}`} style={{ flex: 1 }} />
          <button>Upload to batch {b.no}</button>
        </form>
      )}
    </section>
  );
}
