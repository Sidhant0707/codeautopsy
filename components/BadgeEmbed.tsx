import { useState } from 'react';
import { Copy, Check } from 'lucide-react'; // Make sure lucide-react is installed

// You can pass these as props from your parent component
interface BadgeEmbedProps {
  repoName: string; // e.g., "Sidhant0707/codeautopsy"
}

export function BadgeEmbed({ repoName }: BadgeEmbedProps) {
  const [format, setFormat] = useState<'html' | 'markdown'>('html');
  const [copied, setCopied] = useState(false);

  // Dynamically generate the URLs based on the repo passed in
  const analyzeUrl = `https://codeautopsy-lyart.vercel.app/analyze?repo=${repoName}`;
  const badgeUrl = `https://codeautopsy-lyart.vercel.app/api/badge?repo=${repoName}&v=1`;

  // The two string templates
  const markdownCode = `[![CodeAutopsy Health](${badgeUrl})](${analyzeUrl})`;
  const htmlCode = `<a href="${analyzeUrl}">\n  <img src="${badgeUrl}" alt="CodeAutopsy Health" />\n</a>`;

  const activeCode = format === 'html' ? htmlCode : markdownCode;

  const handleCopy = () => {
    navigator.clipboard.writeText(activeCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000); // Reset the checkmark after 2 seconds
  };

  return (
    <div className="mt-6 border border-zinc-800 rounded-xl p-4 bg-[#0a0a0a]">
      {/* Header & Toggle Switch */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-zinc-300">Embed Health Badge</h3>
        
        {/* The Toggle */}
        <div className="flex items-center bg-zinc-900 rounded-lg p-1 border border-zinc-800">
          <button
            onClick={() => setFormat('html')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
              format === 'html' 
                ? 'bg-zinc-800 text-emerald-400 shadow-sm' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            HTML
          </button>
          <button
            onClick={() => setFormat('markdown')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
              format === 'markdown' 
                ? 'bg-zinc-800 text-emerald-400 shadow-sm' 
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Markdown
          </button>
        </div>
      </div>

      {/* Code Display Area */}
      <div className="relative group">
        <pre className="p-4 rounded-lg bg-[#111111] text-zinc-300 text-sm overflow-x-auto border border-zinc-800 font-mono whitespace-pre-wrap break-all transition-all duration-300">
          <code>{activeCode}</code>
        </pre>
        
        {/* Copy Button (appears on hover) */}
        <button
          onClick={handleCopy}
          className="absolute top-3 right-3 p-2 rounded-md bg-zinc-800/80 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-white hover:bg-zinc-700 backdrop-blur-sm"
          title="Copy to clipboard"
        >
          {copied ? (
            <Check size={16} className="text-emerald-500" />
          ) : (
            <Copy size={16} />
          )}
        </button>
      </div>
    </div>
  );
}