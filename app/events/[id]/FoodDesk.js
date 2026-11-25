import { callFood } from '@/app/actions';
import { fmtSec } from '@/lib/format.mjs';

export default function FoodDesk({ user, event, store }) {
  const e = event.id;
  const batches = store.foodBatches(user.id, e);
  const totals = store.view(user.id, e).totals;
  const next = batches.find(b => !b.calledAt);
  return (
    <>
      <dl className="stats"><div><dt>Going</dt><dd>{totals.yes}</dd></div><div><dt>Opted in</dt><dd>{batches.reduce((s, b) => s + b.optedIn, 0)}</dd></div><div><dt>Called</dt><dd>{batches.filter(b => b.calledAt).length}</dd></div></dl>
      <p className="small">Opt-ins show demand per batch. They are not a count of meals served.</p>
      <section className="status">
        <div className="eyebrow">Next up</div>
        {next ? (
          <form action={callFood}>
            <input type="hidden" name="eventId" value={e} />
            <h2>Batch {next.no} · {next.optedIn} opted in</h2>
            <p>Calling alerts only the guests in this batch, in the app.</p>
            <button className="primary big">Call batch {next.no}</button>
          </form>
        ) : <p>{batches.length ? 'All batches called.' : 'No food opt-ins yet.'}</p>}
      </section>
      <ul className="plain">{batches.map(b => (
        <li key={b.no} className="row" style={{ justifyContent: 'space-between' }}><b>Batch {b.no}</b><span>{b.optedIn} opted in</span><span className="mono">{b.calledAt ? `Called ${fmtSec(b.calledAt)}` : 'Waiting'}</span></li>
      ))}</ul>
    </>
  );
}
