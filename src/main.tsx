import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Fontes auto-hospedadas (nada é buscado de servidores externos), só subset latino.
// Poppins (marca/títulos) + Inter (corpo/números).
import '@fontsource/poppins/latin-500.css';
import '@fontsource/poppins/latin-600.css';
import '@fontsource/poppins/latin-700.css';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
