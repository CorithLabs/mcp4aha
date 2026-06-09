import React, { useEffect, useState } from 'react';

interface ConfigStatus {
  company: string | null;
  hasToken: boolean;
}

interface Props {
  onBack: () => void;
  onSaved: (config: ConfigStatus) => void;
}

export function SetupPage({ onBack, onSaved }: Props) {
  const [company, setCompany] = useState('');
  const [savedCompany, setSavedCompany] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [tokenPreview, setTokenPreview] = useState<string | null>(null);
  const [savingCompany, setSavingCompany] = useState(false);
  const [generatingToken, setGeneratingToken] = useState(false);
  const [companyError, setCompanyError] = useState('');
  const [tokenError, setTokenError] = useState('');
  const [copied, setCopied] = useState(false);
  const [snippetCopied, setSnippetCopied] = useState(false);

  // Load existing config
  useEffect(() => {
    fetch('/api/config')
      .then((r) => r.json())
      .then((data: ConfigStatus) => {
        if (data.company) {
          setCompany(data.company);
          setSavedCompany(data.company);
        }
      });

    fetch('/api/token')
      .then((r) => r.json())
      .then((data: { exists: boolean; preview?: string }) => {
        if (data.exists && data.preview) setTokenPreview(data.preview);
      });
  }, []);

  const handleSaveCompany = async () => {
    setCompanyError('');
    if (!company.trim()) {
      setCompanyError('Please enter your Aha subdomain');
      return;
    }
    setSavingCompany(true);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: company.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCompanyError(data.error || 'Failed to save subdomain');
        return;
      }
      setSavedCompany(data.company);
      onSaved({ company: data.company, hasToken: !!tokenPreview });
    } catch {
      setCompanyError('Network error — please try again');
    } finally {
      setSavingCompany(false);
    }
  };

  const handleGenerateToken = async () => {
    setTokenError('');
    if (window.confirm('This will generate a new MCP token. Any existing token will be invalidated and all Claude Desktop users will need to update their config. Continue?')) {
      setGeneratingToken(true);
      try {
        const res = await fetch('/api/token/generate', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) {
          setTokenError(data.error || 'Failed to generate token');
          return;
        }
        setToken(data.token);
        setTokenPreview(`${data.token.slice(0, 4)}...${data.token.slice(-4)}`);
        onSaved({ company: savedCompany, hasToken: true });
      } catch {
        setTokenError('Network error — please try again');
      } finally {
        setGeneratingToken(false);
      }
    }
  };

  const handleCopyToken = async () => {
    if (!token) return;
    await navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const mcpServerUrl = window.location.origin.replace(':3000', ':3001');
  const configSnippet = `{
  "mcpServers": {
    "aha": {
      "url": "${mcpServerUrl}/sse",
      "headers": {
        "Authorization": "Bearer ${token || '<YOUR_MCP_TOKEN>'}",
        "X-Aha-Api-Key": "<YOUR_AHA_API_KEY>"
      }
    }
  }
}`;

  const handleCopySnippet = async () => {
    await navigator.clipboard.writeText(configSnippet);
    setSnippetCopied(true);
    setTimeout(() => setSnippetCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="max-w-xl w-full bg-white rounded-2xl shadow-lg p-8 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-400 hover:text-gray-600 text-sm">
            ← Back
          </button>
          <h2 className="text-xl font-bold text-gray-900">Server Setup</h2>
        </div>

        {/* Step 1: Aha Subdomain */}
        <section>
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Step 1 — Aha Subdomain
          </h3>
          <p className="text-sm text-gray-500 mb-3">
            Enter your Aha company subdomain (e.g. <code className="bg-gray-100 px-1 rounded">mycompany</code> from{' '}
            <code className="bg-gray-100 px-1 rounded">mycompany.aha.io</code>).
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="mycompany"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Aha company subdomain"
            />
            <button
              onClick={handleSaveCompany}
              disabled={savingCompany}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {savingCompany ? 'Saving…' : 'Save'}
            </button>
          </div>
          {companyError && <p className="text-red-500 text-sm mt-2">{companyError}</p>}
          {savedCompany && !companyError && (
            <p className="text-green-600 text-sm mt-2">
              ✓ Saved: <strong>{savedCompany}.aha.io</strong>
            </p>
          )}
        </section>

        {/* Step 2: Generate Token */}
        <section>
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Step 2 — Generate MCP Token
          </h3>
          <p className="text-sm text-gray-500 mb-3">
            Generate a token for Claude Desktop to authenticate with this MCP server.
          </p>

          {tokenPreview && !token && (
            <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600 mb-3 border border-gray-200">
              Current token: <code>{tokenPreview}</code>
            </div>
          )}

          <button
            onClick={handleGenerateToken}
            disabled={generatingToken || !savedCompany}
            title={!savedCompany ? 'Save a subdomain first' : ''}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {generatingToken ? 'Generating…' : tokenPreview ? 'Regenerate Token' : 'Generate Token'}
          </button>
          {tokenError && <p className="text-red-500 text-sm mt-2">{tokenError}</p>}

          {token && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Your MCP Token (copy now — shown once):</p>
              <div className="flex gap-2 items-center">
                <input
                  readOnly
                  value={token}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono bg-gray-50"
                  aria-label="MCP Token"
                />
                <button
                  onClick={handleCopyToken}
                  className="bg-gray-700 hover:bg-gray-800 text-white px-3 py-2 rounded-lg text-sm transition-colors"
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Step 3: Claude Desktop Config Snippet */}
        {(token || tokenPreview) && (
          <section>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Step 3 — Claude Desktop Config
            </h3>
            <p className="text-sm text-gray-500 mb-3">
              Add this to your{' '}
              <code className="bg-gray-100 px-1 rounded">claude_desktop_config.json</code>. Replace{' '}
              <code className="bg-gray-100 px-1 rounded">&lt;YOUR_AHA_API_KEY&gt;</code> with your personal Aha API key.
            </p>
            <div className="relative">
              <pre className="bg-gray-900 text-green-300 text-xs rounded-lg p-4 overflow-x-auto leading-relaxed">
                {configSnippet}
              </pre>
              <button
                onClick={handleCopySnippet}
                className="absolute top-2 right-2 bg-gray-700 hover:bg-gray-600 text-white text-xs px-2 py-1 rounded transition-colors"
              >
                {snippetCopied ? '✓ Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              💡 Your Aha API key is passed per-request by Claude and never stored on this server.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
