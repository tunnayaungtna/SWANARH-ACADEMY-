import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

declare global {
  interface Window {
    __swanarhMounted?: boolean;
    __swanarhForceRecover?: (manual?: boolean) => void;
  }
}

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('RootErrorBoundary caught error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
          <div className="max-w-sm bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900">
              SwanArh Classroom ပြန်လည်ချိတ်ဆက်ရန် လိုအပ်ပါသည်
            </h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              အချိန်အတော်ကြာ ပိတ်ထားပြီး ပြန်ဖွင့်ချိန်တွင် Cache အဟောင်းကြောင့် ခေတ္တရပ်တန့်သွားခြင်း ဖြစ်ပါသည်။ အောက်ပါခလုတ်ကို နှိပ်၍ ချက်ချင်း ပြန်ဖွင့်နိုင်ပါသည်။
            </p>
            <button
              type="button"
              onClick={() => {
                if (window.__swanarhForceRecover) {
                  window.__swanarhForceRecover(true);
                } else {
                  window.location.reload();
                }
              }}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer"
            >
              ချက်ချင်း ပြန်ဖွင့်ရန် (Reload Classroom)
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

window.__swanarhMounted = true;

// Clean up any temporary ?wake=... cache-busting query parameter from URL bar
try {
  if (window.location.search.includes('wake=')) {
    const url = new URL(window.location.href);
    url.searchParams.delete('wake');
    window.history.replaceState({}, '', url.pathname + url.search + url.hash);
  }
} catch {
  // ignore
}

createRoot(document.getElementById('root')!).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
);

