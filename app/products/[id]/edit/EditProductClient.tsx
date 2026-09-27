'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { updateProductAction } from '../actions';
import { useToast } from '@/components/Toast';

interface EditableProduct {
  id: string;
  productCode: string;
  name: string;
  shortDesc: string | null;
  description: string | null;
  price: number;
  costPrice: number | null;
  quantity: number;
  isUnique: boolean;
  primaryColour: string | null;
  secondaryColours: string | null;
  collectionId: string | null;
  categoryName: string;
  images: string[];
  attributes: Record<string, string>;
}

interface AttributeDefinition {
  id: string;
  name: string;
  fieldType: string;
  required: boolean;
  options: string | null;
}

interface EditProductClientProps {
  product: EditableProduct;
  attributeDefinitions: AttributeDefinition[];
  collections: { id: string; name: string }[];
}

const inputClass =
  'w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary focus:ring-0 py-2 font-body-md text-base';
const labelClass = 'font-label-md text-xs text-on-surface-variant uppercase';

function parseOptions(options: string | null): string[] {
  try {
    const parsed = JSON.parse(options || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function EditProductClient({ product, attributeDefinitions, collections }: EditProductClientProps) {
  const router = useRouter();
  const toast = useToast();

  const [name, setName] = useState(product.name);
  const [shortDesc, setShortDesc] = useState(product.shortDesc ?? '');
  const [description, setDescription] = useState(product.description ?? '');
  const [price, setPrice] = useState(String(product.price));
  const [costPrice, setCostPrice] = useState(product.costPrice != null ? String(product.costPrice) : '');
  const [quantity, setQuantity] = useState(String(product.quantity));
  const [primaryColour, setPrimaryColour] = useState(product.primaryColour ?? '');
  const [secondaryColours, setSecondaryColours] = useState(product.secondaryColours ?? '');
  const [collectionId, setCollectionId] = useState(product.collectionId ?? '');
  const [images, setImages] = useState<string[]>(product.images);
  const [attributes, setAttributes] = useState<Record<string, string>>(product.attributes);

  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    setFormError('');
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append('files', files[i]);
    }

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.error) {
        setFormError(data.error);
      } else if (data.urls) {
        setImages((prev) => [...prev, ...data.urls]);
      }
    } catch {
      setFormError('Failed to upload images.');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const moveImage = (from: number, to: number) => {
    setImages((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const priceNum = Number(price);
    const costNum = costPrice.trim() === '' ? null : Number(costPrice);
    const qtyNum = Number(quantity);

    if (!name.trim()) return setFormError('Product name is required.');
    if (!(priceNum > 0)) return setFormError('Price must be greater than zero.');
    if (costNum != null && (Number.isNaN(costNum) || costNum < 0)) return setFormError('Cost price must be 0 or more.');
    if (!product.isUnique && (!Number.isInteger(qtyNum) || qtyNum < 0)) {
      return setFormError('Quantity must be a whole number (0 or more).');
    }
    if (images.length === 0) return setFormError('Add at least one photo.');
    const missing = attributeDefinitions.find((d) => d.required && !attributes[d.id]?.trim());
    if (missing) return setFormError(`${missing.name} is required.`);

    setIsSaving(true);
    try {
      const res = await updateProductAction(product.id, {
        name,
        shortDesc,
        description,
        price: priceNum,
        costPrice: costNum,
        quantity: product.isUnique ? product.quantity : qtyNum,
        primaryColour,
        secondaryColours,
        collectionId: collectionId || null,
        images,
        attributes: attributeDefinitions.map((d) => ({ definitionId: d.id, value: attributes[d.id] ?? '' })),
      });
      if (res.error) {
        setFormError(res.error);
        return;
      }
      toast.success(`${product.productCode} saved.`);
      router.push(`/products/${product.id}`);
      router.refresh();
    } catch (err) {
      console.error(err);
      setFormError('Failed to save changes.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="max-w-3xl flex flex-col gap-8 pb-28 md:pb-8">
      {/* Photos */}
      <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 md:p-6 flex flex-col gap-4">
        <div>
          <h2 className="font-headline-sm text-base text-on-surface">Photos</h2>
          <p className="text-xs text-on-surface-variant mt-1">The first photo is the main image in the shop.</p>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {images.map((url, idx) => (
            <div key={`${url}-${idx}`} className="relative aspect-[3/4] rounded-lg overflow-hidden border border-outline-variant/30 bg-surface-container-low">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
              {idx === 0 && (
                <span className="absolute top-1.5 left-1.5 bg-primary text-on-primary text-[11px] px-2 py-0.5 rounded-full">Main</span>
              )}
              <div className="absolute bottom-0 inset-x-0 flex justify-between bg-black/45 p-1">
                <button
                  type="button"
                  onClick={() => moveImage(idx, idx - 1)}
                  disabled={idx === 0}
                  className="w-9 h-9 flex items-center justify-center text-white disabled:opacity-30 cursor-pointer"
                  aria-label={`Move photo ${idx + 1} earlier`}
                >
                  <span className="material-symbols-outlined text-[20px]">chevron_left</span>
                </button>
                <button
                  type="button"
                  onClick={() => setImages((prev) => prev.filter((_, i) => i !== idx))}
                  className="w-9 h-9 flex items-center justify-center text-white cursor-pointer"
                  aria-label={`Remove photo ${idx + 1}`}
                >
                  <span className="material-symbols-outlined text-[20px]">delete</span>
                </button>
                <button
                  type="button"
                  onClick={() => moveImage(idx, idx + 1)}
                  disabled={idx === images.length - 1}
                  className="w-9 h-9 flex items-center justify-center text-white disabled:opacity-30 cursor-pointer"
                  aria-label={`Move photo ${idx + 1} later`}
                >
                  <span className="material-symbols-outlined text-[20px]">chevron_right</span>
                </button>
              </div>
            </div>
          ))}
          <label className="aspect-[3/4] rounded-lg border-2 border-dashed border-outline-variant/60 flex flex-col items-center justify-center gap-1 text-on-surface-variant cursor-pointer hover:border-primary hover:text-primary transition-colors">
            <span className="material-symbols-outlined text-[28px]">{isUploading ? 'progress_activity' : 'add_a_photo'}</span>
            <span className="text-xs">{isUploading ? 'Uploading…' : 'Add photos'}</span>
            <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} disabled={isUploading} className="sr-only" />
          </label>
        </div>
      </section>

      {/* Details */}
      <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 md:p-6 flex flex-col gap-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-headline-sm text-base text-on-surface">Details</h2>
          <span className="text-xs text-on-surface-variant">
            {product.categoryName} · <span className="font-mono">{product.productCode}</span>
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="name" className={labelClass}>Name *</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="flex flex-col gap-2">
            <label htmlFor="price" className={labelClass}>Price (₹) *</label>
            <input id="price" type="number" inputMode="decimal" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} required />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="costPrice" className={labelClass}>Cost price (₹)</label>
            <input id="costPrice" type="number" inputMode="decimal" min="0" step="0.01" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} className={inputClass} />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="quantity" className={labelClass}>Quantity</label>
            {product.isUnique ? (
              <p className="py-2 text-sm text-on-surface-variant">Unique piece (1)</p>
            ) : (
              <input id="quantity" type="number" inputMode="numeric" min="0" step="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputClass} />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="shortDesc" className={labelClass}>Short description</label>
          <input id="shortDesc" value={shortDesc} onChange={(e) => setShortDesc(e.target.value)} className={inputClass} />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="description" className={labelClass}>Description</label>
          <textarea
            id="description"
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-transparent border border-outline-variant focus:border-primary focus:ring-0 rounded-lg p-3 font-body-md text-base"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            <label htmlFor="primaryColour" className={labelClass}>Primary colour</label>
            <input id="primaryColour" value={primaryColour} onChange={(e) => setPrimaryColour(e.target.value)} className={inputClass} />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="secondaryColours" className={labelClass}>Other colours</label>
            <input id="secondaryColours" value={secondaryColours} onChange={(e) => setSecondaryColours(e.target.value)} placeholder="e.g. Gold, Ivory" className={inputClass} />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="collection" className={labelClass}>Collection</label>
          <select id="collection" value={collectionId} onChange={(e) => setCollectionId(e.target.value)} className={inputClass}>
            <option value="">No collection</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </section>

      {/* Category specifications */}
      {attributeDefinitions.length > 0 && (
        <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-5 md:p-6 flex flex-col gap-6">
          <h2 className="font-headline-sm text-base text-on-surface">{product.categoryName} specifications</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {attributeDefinitions.map((def) => {
              const value = attributes[def.id] ?? '';
              const onChange = (val: string) => setAttributes((prev) => ({ ...prev, [def.id]: val }));
              const inputId = `attr-${def.id}`;
              return (
                <div key={def.id} className="flex flex-col gap-2">
                  <label htmlFor={inputId} className={labelClass}>
                    {def.name} {def.required && '*'}
                  </label>
                  {def.fieldType === 'SELECT' ? (
                    <select id={inputId} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
                      <option value="">-- Select --</option>
                      {/* Keep a legacy value selectable even if it's no longer an option */}
                      {value && !parseOptions(def.options).includes(value) && <option value={value}>{value}</option>}
                      {parseOptions(def.options).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={inputId}
                      type={def.fieldType === 'NUMBER' ? 'number' : 'text'}
                      value={value}
                      onChange={(e) => onChange(e.target.value)}
                      className={inputClass}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {formError && (
        <p role="alert" className="text-sm text-error flex items-center gap-1.5">
          <span className="material-symbols-outlined text-base">error</span>
          {formError}
        </p>
      )}

      {/* Actions: sticky above the mobile bottom nav */}
      <div className="fixed md:static bottom-20 inset-x-0 z-30 md:z-auto px-4 md:px-0">
        <div className="max-w-3xl mx-auto md:mx-0 flex gap-3 bg-surface/95 md:bg-transparent backdrop-blur-sm md:backdrop-blur-none p-3 md:p-0 rounded-xl border md:border-0 border-outline-variant/30 shadow-lg md:shadow-none">
          <Link
            href={`/products/${product.id}`}
            className="flex-1 md:flex-none text-center border border-outline text-on-surface py-3 px-6 rounded text-sm hover:bg-surface-container-low transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSaving || isUploading}
            className="flex-1 md:flex-none bg-primary text-on-primary py-3 px-8 rounded text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
          >
            {isSaving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </form>
  );
}
