import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './styles.css';

const root = document.getElementById('radice');
if (!root) throw new Error('Contenitore dell’applicazione non trovato');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
