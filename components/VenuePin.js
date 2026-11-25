'use client';
import { useState } from 'react';
import { setPin } from '@/app/actions';

export default function VenuePin({ eventId, hasPin }) {
  const [msg, setMsg] = useState(hasPin ? 'Venue pin is set.' : 'No venue pin yet.');
  const pin = () => {
    setMsg('Reading location…');
    navigator.geolocation?.getCurrentPosition(
      p => setPin(eventId, p.coords.latitude, p.coords.longitude).then(ok => setMsg(ok ? `Pin set here (±${Math.round(p.coords.accuracy)} m).` : 'Could not set pin.')),
      () => setMsg('Location permission denied.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };
  return (<div className="row center"><button onClick={pin}>Set venue pin to where I stand</button><span className="small">{msg}</span></div>);
}
