import Link from 'next/link';

export default function BriefDesk({ user, role, event, store }) {
  const totals = store.view(user.id, event.id).totals;
  const brief = role.service === 'Videography'
    ? ['Arrive 45 min before guests for B-roll of the decor.', 'Capture the welcome, lamp lighting and the photo-booth queue.', 'Deliver a 60-second reel to the host.']
    : ['Marigold torans at the entrance and stage.', 'Diya rows along the walkway; keep the check-in and food desks clear.', 'Rangoli at the photo-booth backdrop.'];
  return (
    <>
      <dl className="stats"><div><dt>Going</dt><dd>{totals.yes}</dd></div><div><dt>Not going</dt><dd>{totals.no}</dd></div></dl>
      <section className="card"><div className="eyebrow">{role.service} brief</div><ul>{brief.map(b => <li key={b}>{b}</li>)}</ul></section>
      <p className="small">You see this event because the host assigned you. <Link href={`/vendors/${user.id}`}>Edit your profile →</Link></p>
    </>
  );
}
