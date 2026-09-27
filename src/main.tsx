import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import HeadsUpStandalone from './HeadsUpStandalone.tsx';
import './index.css';

const Root = window.location.pathname === '/headsup' ? HeadsUpStandalone : App;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
