import { useState, useEffect } from 'react';
import { X, Loader2, Upload, Trash2, KeyRound } from 'lucide-react';
import { cn } from '../../lib/utils';
import { keyApi, parseKeyCodes } from '../../lib/keyApi';
import toast from 'react-hot-toast';

const STATUS_STYLES = {
  AVAILABLE: 'bg-green-100 text-green-800',
  RESERVED: 'bg-yellow-100 text-yellow-800',
  SOLD: 'bg-neutral-200 text-neutral-700',
  REVOKED: 'bg-red-100 text-red-800'
};

export default function KeyUploadModal({ open, onClose, onChanged, product }) {
  const [raw, setRaw] = useState('');
  const [keys, setKeys] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const parsed = parseKeyCodes(raw);
  const uniqueParsed = [...new Set(parsed)];
  const dupesInPaste = parsed.length - uniqueParsed.length;

  const loadKeys = async () => {
    if (!product) return;
    setIsLoading(true);
    try {
      const data = await keyApi.getKeysForProduct(product.id);
      setKeys(data.keys || []);
    } catch {
      toast.error('Failed to load keys');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setRaw('');
      loadKeys();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product?.id]);

  if (!open) return null;

  const handleUpload = async (e) => {
    e.preventDefault();
    if (uniqueParsed.length === 0) return toast.error('Paste at least one key');

    setIsUploading(true);
    try {
      const result = await keyApi.bulkUploadKeys(product.id, uniqueParsed);
      toast.success(
        result.skipped > 0
          ? `Added ${result.added} keys (${result.skipped} duplicates skipped)`
          : `Added ${result.added} keys`
      );
      setRaw('');
      await loadKeys();
      onChanged?.();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to add keys');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (key) => {
    try {
      await keyApi.deleteKey(key.id);
      toast.success('Key deleted');
      await loadKeys();
      onChanged?.();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete key');
    }
  };

  const counts = keys.reduce((acc, k) => {
    acc[k.status] = (acc[k.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-neutral-100 rounded-xl shadow-large w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 sticky top-0 bg-neutral-100">
          <div>
            <h2 className="text-xl font-semibold text-neutral-900 flex items-center gap-2">
              <KeyRound size={20} /> Keys
            </h2>
            <p className="text-sm text-neutral-600">{product?.name}</p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex gap-2 flex-wrap">
            {['AVAILABLE', 'RESERVED', 'SOLD', 'REVOKED'].map((s) => (
              <span key={s} className={cn('px-2 py-1 rounded-full text-xs font-medium', STATUS_STYLES[s])}>
                {counts[s] || 0} {s.toLowerCase()}
              </span>
            ))}
          </div>

          <form onSubmit={handleUpload} className="space-y-3">
            <label className="block text-sm font-medium text-neutral-700" htmlFor="ku-codes">
              Paste keys — one per line, or CSV (first column is used)
            </label>
            <textarea
              id="ku-codes"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={'ABCDE-FGHJK-LMNPQ\nRSTUV-WXYZ2-34567'}
              className="w-full h-32 px-3 py-2 border border-neutral-300 rounded-lg font-mono text-xs resize-y focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <div className="flex items-center justify-between">
              <p className="text-sm text-neutral-600">
                {uniqueParsed.length} key{uniqueParsed.length === 1 ? '' : 's'} ready
                {dupesInPaste > 0 && ` (${dupesInPaste} duplicate${dupesInPaste === 1 ? '' : 's'} in paste ignored)`}
              </p>
              <button
                type="submit"
                disabled={isUploading || uniqueParsed.length === 0}
                className={cn(
                  'px-4 py-2 rounded-lg font-medium text-white flex items-center gap-2',
                  isUploading || uniqueParsed.length === 0
                    ? 'bg-neutral-300 cursor-not-allowed'
                    : 'bg-primary-600 hover:bg-primary-700'
                )}
              >
                {isUploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                {isUploading ? 'Adding…' : 'Add keys'}
              </button>
            </div>
          </form>

          <div>
            <h3 className="text-sm font-medium text-neutral-700 mb-2">
              Existing keys {keys.length > 0 && `(${keys.length})`}
            </h3>
            {isLoading ? (
              <div className="flex items-center gap-2 text-neutral-500 text-sm py-4">
                <Loader2 size={16} className="animate-spin" /> Loading…
              </div>
            ) : keys.length === 0 ? (
              <p className="text-sm text-neutral-500 py-4">
                No keys yet. This game shows as out of stock until you add some.
              </p>
            ) : (
              <div className="border border-neutral-200 rounded-lg divide-y divide-neutral-100 max-h-64 overflow-y-auto">
                {keys.map((key) => (
                  <div key={key.id} className="flex items-center justify-between px-3 py-2">
                    <code className="text-xs font-mono text-neutral-700">{key.code}</code>
                    <div className="flex items-center gap-2">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', STATUS_STYLES[key.status])}>
                        {key.status.toLowerCase()}
                      </span>
                      {key.status === 'AVAILABLE' && (
                        <button
                          onClick={() => handleDelete(key)}
                          className="text-neutral-400 hover:text-error-600"
                          title="Delete key"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
