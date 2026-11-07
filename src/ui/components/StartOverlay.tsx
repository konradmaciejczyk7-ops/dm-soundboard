import { useState } from 'react';
import { startAudio } from '../../app/session';

/** Przeglądarka pozwala uruchomić dźwięk dopiero po kliknięciu – stąd ten ekran. */
export function StartOverlay() {
  const [error, setError] = useState<string | null>(null);

  const start = () => {
    startAudio().catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  };

  return (
    <div className="overlay">
      <div className="overlay__card">
        <div className="overlay__sigil" aria-hidden>
          🐉
        </div>
        <h2>Ready for the session?</h2>
        <p>Click to start the audio engine.</p>
        <button type="button" className="overlay__start" onClick={start} autoFocus>
          Start session
        </button>
        {error && <p className="overlay__error">Could not start audio: {error}</p>}
      </div>
    </div>
  );
}
