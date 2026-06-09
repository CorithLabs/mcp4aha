import React, { useEffect, useState } from 'react';
import { SetupPage } from './pages/SetupPage';

interface ConfigStatus {
  company: string | null;
  hasToken: boolean;
}

export default function App() {
  const [page, setPage] = useState<'home' | 'setup'>('home');
  const [config, setConfig] = useState<ConfigStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((data: ConfigStatus) => {
        setConfig(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (page === 'setup') {
    return <SetupPage onBack={() => setPage('home')} onSaved={(c) => setConfig(c)} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-lg p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-lg">A</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Aha MCP Server</h1>
            <p className="text-sm text-gray-500">Claude Desktop Integration Portal</p>
          </div>
        </div>

        {/* Description */}
        <p className="text-gray-600 mb-6 leading-relaxed">
          This portal connects your{' '}
          <a href="https://www.aha.io" className="text-indigo-600 underline" target="_blank" rel="noreferrer">
            Aha.io
          </a>{' '}
          workspace to Claude Desktop via the Model Context Protocol (MCP). Configure your
          Aha subdomain, generate an MCP token, and paste the config snippet into Claude.
        </p>

        {/* Status banner */}
        {!loading && (
          <div
            className={`rounded-lg px-4 py-3 mb-6 text-sm ${
              config?.company && config?.hasToken
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-amber-50 text-amber-800 border border-amber-200'
            }`}
          >
            {config?.company && config?.hasToken ? (
              <span>
                ✅ Server is configured for <strong>{config.company}.aha.io</strong> — MCP token is active.
              </span>
            ) : config?.company && !config?.hasToken ? (
              <span>⚠️ Subdomain is set but no MCP token has been generated yet.</span>
            ) : (
              <span>⚠️ Server is not yet configured. Click below to set up.</span>
            )}
          </div>
        )}

        {/* CTA */}
        <button
          onClick={() => setPage('setup')}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
        >
          {config?.company && config?.hasToken ? 'View Setup' : 'Configure Server →'}
        </button>

        <p className="text-xs text-gray-400 mt-4 text-center">
          MCP server runs on port 3001 · Portal on port 3000
        </p>
      </div>
    </div>
  );
}
