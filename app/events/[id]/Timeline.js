import { fmtSec } from '@/lib/format.mjs';
import Ticker from '@/components/Ticker';

// Started / Paused / Resumed / Finished, inline with local times to the second.
export default function Timeline({ log }) {
  if (!log.length) return <p className="small">Not started yet.</p>;
  return (
    <>
      <ol className="timeline">{log.map((l, i) => <li key={i}><span className="k">{l.kind}</span><time dateTime={l.at}>{fmtSec(l.at)}</time></li>)}</ol>
      <Ticker log={log} />
    </>
  );
}
