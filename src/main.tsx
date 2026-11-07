import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { bootstrap } from './app/session';
import './ui/styles.css';

const root = createRoot(document.getElementById('root')!);

void bootstrap().then(() => {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
