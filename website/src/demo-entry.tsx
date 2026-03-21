import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import DemoPreview from './DemoPreview';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DemoPreview />
  </StrictMode>,
);
