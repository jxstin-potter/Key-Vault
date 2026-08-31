import { useState } from 'react';
import { Eye, EyeOff, Copy, Check, ExternalLink } from 'lucide-react';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';

// Where each storefront wants you to paste the code
const REDEEM_URLS = {
  STEAM: 'https://store.steampowered.com/account/registerkey',
  EPIC: 'https://www.epicgames.com/store/en-US/redeem',
  GOG: 'https://www.gog.com/redeem',
  XBOX: 'https://redeem.microsoft.com',
  PLAYSTATION: 'https://store.playstation.com/redeem',
  BATTLENET: 'https://battle.net/account/management/redeem-code.html',
  UBISOFT: 'https://store.ubisoft.com/redeem',
  NINTENDO: 'https://ec.nintendo.com/redeem'
};

export default function KeyReveal({ code, platform }) {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setRevealed(true);
      toast.success('Key copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access needs a secure context and can be blocked outright
      setRevealed(true);
      toast.error('Could not copy - the key is revealed, copy it manually');
    }
  };

  const redeemUrl = REDEEM_URLS[platform];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <code
        className={cn(
          'flex-1 min-w-[12rem] px-3 py-2 rounded-lg bg-neutral-100 font-mono text-sm text-neutral-900 select-all transition',
          !revealed && 'blur-sm select-none'
        )}
        aria-hidden={!revealed}
      >
        {code}
      </code>

      <button
        onClick={() => setRevealed((r) => !r)}
        className="p-2 rounded-lg border border-neutral-300 text-neutral-600 hover:bg-neutral-50 transition-colors"
        title={revealed ? 'Hide key' : 'Reveal key'}
      >
        {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>

      <button
        onClick={handleCopy}
        className="p-2 rounded-lg border border-neutral-300 text-neutral-600 hover:bg-neutral-50 transition-colors"
        title="Copy key"
      >
        {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
      </button>

      {redeemUrl && (
        <a
          href={redeemUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          Redeem <ExternalLink size={14} />
        </a>
      )}
    </div>
  );
}
