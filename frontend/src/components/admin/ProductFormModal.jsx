import { useState, useEffect } from 'react';
import { X, Loader2, Save } from 'lucide-react';
import { cn } from '../../lib/utils';
import { productApi } from '../../lib/productApi';
import toast from 'react-hot-toast';

const PLATFORMS = ['STEAM', 'EPIC', 'GOG', 'XBOX', 'PLAYSTATION', 'BATTLENET', 'UBISOFT', 'NINTENDO'];
const REGIONS = ['GLOBAL', 'NA', 'EU', 'UK', 'ASIA', 'LATAM'];

// Mirrors the backend slugify so the generated value passes isSlug() validation
const slugify = (name) =>
  name
    .toLowerCase()
    .replace(/['‘’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const EMPTY = {
  name: '',
  slug: '',
  description: '',
  price: '',
  categoryId: '',
  platform: 'STEAM',
  region: 'GLOBAL',
  developer: '',
  publisher: '',
  releaseDate: '',
  images: '',
  isActive: true
};

export default function ProductFormModal({ open, onClose, onSaved, product, categories }) {
  const [form, setForm] = useState(EMPTY);
  const [isSaving, setIsSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  const isEdit = Boolean(product);

  useEffect(() => {
    if (!open) return;
    if (product) {
      setForm({
        name: product.name ?? '',
        slug: product.slug ?? '',
        description: product.description ?? '',
        price: String(product.price ?? ''),
        categoryId: product.categoryId ?? '',
        platform: product.platform ?? 'STEAM',
        region: product.region ?? 'GLOBAL',
        developer: product.developer ?? '',
        publisher: product.publisher ?? '',
        releaseDate: product.releaseDate ? product.releaseDate.slice(0, 10) : '',
        images: (product.images ?? []).join('\n'),
        isActive: product.isActive ?? true
      });
      setSlugTouched(true);
    } else {
      setForm(EMPTY);
      setSlugTouched(false);
    }
  }, [open, product]);

  if (!open) return null;

  const set = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => {
      // Keep slug in step with the name until the user edits it directly
      if (field === 'name' && !slugTouched) {
        return { ...f, name: value, slug: slugify(value) };
      }
      return { ...f, [field]: value };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const images = form.images.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

    if (!form.categoryId) return toast.error('Pick a genre');
    if (images.length === 0) return toast.error('Add at least one image URL');
    if (!form.slug) return toast.error('Slug is required');

    // The API takes categoryId, not a category name, and wants a real number
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      description: form.description.trim(),
      price: Number(form.price),
      categoryId: form.categoryId,
      images,
      platform: form.platform,
      region: form.region,
      developer: form.developer.trim() || undefined,
      publisher: form.publisher.trim() || undefined,
      releaseDate: form.releaseDate ? new Date(form.releaseDate).toISOString() : undefined
    };

    if (isEdit) payload.isActive = form.isActive;

    setIsSaving(true);
    try {
      if (isEdit) {
        await productApi.updateProduct(product.id, payload);
        toast.success(`${payload.name} updated`);
      } else {
        await productApi.createProduct(payload);
        toast.success(`${payload.name} added`);
      }
      onSaved?.();
      onClose();
    } catch (error) {
      const detail =
        error.response?.data?.errors?.[0]?.msg ||
        error.response?.data?.message ||
        'Failed to save game';
      toast.error(detail);
    } finally {
      setIsSaving(false);
    }
  };

  const field = 'w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500';
  const label = 'block text-sm font-medium text-neutral-700 mb-1';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-neutral-100 rounded-xl shadow-large w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 sticky top-0 bg-neutral-100">
          <h2 className="text-xl font-semibold text-neutral-900">
            {isEdit ? `Edit ${product.name}` : 'Add a game'}
          </h2>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={label} htmlFor="pf-name">Title</label>
              <input id="pf-name" className={field} value={form.name} onChange={set('name')} required maxLength={255} />
            </div>
            <div>
              <label className={label} htmlFor="pf-slug">Slug</label>
              <input
                id="pf-slug"
                className={field}
                value={form.slug}
                onChange={(e) => { setSlugTouched(true); set('slug')(e); }}
                required
              />
            </div>
          </div>

          <div>
            <label className={label} htmlFor="pf-desc">Description</label>
            <textarea id="pf-desc" className={cn(field, 'h-24 resize-y')} value={form.description} onChange={set('description')} required />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className={label} htmlFor="pf-price">Price (USD)</label>
              <input id="pf-price" type="number" step="0.01" min="0" className={field} value={form.price} onChange={set('price')} required />
            </div>
            <div>
              <label className={label} htmlFor="pf-genre">Genre</label>
              <select id="pf-genre" className={field} value={form.categoryId} onChange={set('categoryId')} required>
                <option value="">Select…</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="pf-release">Release date</label>
              <input id="pf-release" type="date" className={field} value={form.releaseDate} onChange={set('releaseDate')} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={label} htmlFor="pf-platform">Platform</label>
              <select id="pf-platform" className={field} value={form.platform} onChange={set('platform')}>
                {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="pf-region">Region</label>
              <select id="pf-region" className={field} value={form.region} onChange={set('region')}>
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={label} htmlFor="pf-dev">Developer</label>
              <input id="pf-dev" className={field} value={form.developer} onChange={set('developer')} />
            </div>
            <div>
              <label className={label} htmlFor="pf-pub">Publisher</label>
              <input id="pf-pub" className={field} value={form.publisher} onChange={set('publisher')} />
            </div>
          </div>

          <div>
            <label className={label} htmlFor="pf-images">Image URLs (one per line)</label>
            <textarea
              id="pf-images"
              className={cn(field, 'h-20 resize-y font-mono text-xs')}
              value={form.images}
              onChange={set('images')}
              placeholder="https://…/cover.jpg"
              required
            />
          </div>

          {isEdit && (
            <label className="flex items-center gap-2 text-sm text-neutral-700">
              <input type="checkbox" checked={form.isActive} onChange={set('isActive')} className="rounded border-neutral-300" />
              Listed in the store
            </label>
          )}

          <p className="text-xs text-neutral-500">
            Stock is not set here. A game is sellable once keys are added to it.
          </p>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border border-neutral-300 rounded-lg text-neutral-700 hover:bg-neutral-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className={cn(
                'px-4 py-2 rounded-lg font-medium text-white flex items-center gap-2',
                isSaving ? 'bg-neutral-300 cursor-not-allowed' : 'bg-primary-600 hover:bg-primary-700'
              )}
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {isSaving ? 'Saving…' : isEdit ? 'Save changes' : 'Add game'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
