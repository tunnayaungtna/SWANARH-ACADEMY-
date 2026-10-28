import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

declare global {
  interface Window {
    __swanarhMounted?: boolean;
  }
}

window.__swanarhMounted = true;
createRoot(document.getElementById('root')!).render(<App />);

