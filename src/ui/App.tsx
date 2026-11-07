import { useEffect } from 'react';
import { installHotkeys } from '../app/hotkeys';
import { useAppStore } from '../state/store';
import { AmbientPanel } from './components/AmbientPanel';
import { MixerStrip } from './components/MixerStrip';
import { MoodBar } from './components/MoodBar';
import { MoodEditor } from './components/MoodEditor';
import { NowPlaying } from './components/NowPlaying';
import { PanicButton } from './components/PanicButton';
import { SoundboardPanel } from './components/SoundboardPanel';
import { StartOverlay } from './components/StartOverlay';

export function App() {
  const audioStarted = useAppStore((s) => s.audioStarted);
  const assignMode = useAppStore((s) => s.ui.assignMode);

  useEffect(() => installHotkeys(), []);

  return (
    <div className={`app${assignMode ? ' is-assigning' : ''}`}>
      <header className="topbar">
        <h1 className="brand">
          <span aria-hidden>🎲</span> DM Soundboard
        </h1>
        <MoodBar />
        <PanicButton />
      </header>

      <main className="workspace">
        <div className="workspace__left">
          <AmbientPanel />
          <NowPlaying />
        </div>
        <SoundboardPanel />
      </main>

      <MixerStrip />

      <MoodEditor />
      {!audioStarted && <StartOverlay />}
    </div>
  );
}
