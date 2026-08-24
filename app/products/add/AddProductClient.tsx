'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createProduct } from './actions';

interface AddProductClientProps {
  categories: any[];
  collections: any[];
}

export default function AddProductClient({ categories, collections }: AddProductClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Wizard state
  const [step, setStep] = useState(1);
  const [successProduct, setSuccessProduct] = useState<any | null>(null);

  // Form fields state
  const [images, setImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [shortDesc, setShortDesc] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [isUnique, setIsUnique] = useState(true);
  const [primaryColour, setPrimaryColour] = useState('');
  const [secondaryColours, setSecondaryColours] = useState('');
  const [collectionId, setCollectionId] = useState('');
  const [attributes, setAttributes] = useState<{ [key: string]: string }>({});
  const [publishStatus, setPublishStatus] = useState<'DRAFT' | 'PUBLISHED'>('PUBLISHED');

  // AI analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiSuggestionsReceived, setAiSuggestionsReceived] = useState(false);

  const [formError, setFormError] = useState('');

  // Handle Photo upload
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
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.error) {
        setFormError(data.error);
      } else if (data.urls) {
        setImages((prev) => [...prev, ...data.urls]);
      }
    } catch (err) {
      setFormError('Failed to upload images.');
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = (idxToRemove: number) => {
    setImages((prev) => prev.filter((_, idx) => idx !== idxToRemove));
  };

  // When category changes, set defaults for Rida or reset fields
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setCategoryId(id);
    const selectedCategory = categories.find((c) => c.id === id);
    if (selectedCategory && selectedCategory.name.toLowerCase() === 'rida') {
      setQuantity('1');
      setIsUnique(true);
    } else {
      setQuantity('10');
      setIsUnique(false);
    }
    setAttributes({});
    setAiSuggestionsReceived(false);
  };

  // Call AI suggestions API
  const handleAIAssist = async () => {
    if (images.length === 0) {
      setFormError('Please upload at least one image first.');
      return;
    }
    const selectedCategory = categories.find((c) => c.id === categoryId);
    if (!selectedCategory) {
      setFormError('Please select a category.');
      return;
    }

    setIsAnalyzing(true);
    setFormError('');

    try {
      const res = await fetch('/api/ai/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: images[0].startsWith('http') ? images[0] : (window.location.origin + images[0]),
          categoryName: selectedCategory.name,
        }),
      });

      const data = await res.json();
      if (data.error) {
        setFormError(data.error);
      } else {
        setName(data.name || '');
        setShortDesc(data.shortDesc || '');
        setDescription(data.description || '');
        setPrimaryColour(data.primaryColour || '');
        setSecondaryColours(data.secondaryColours || '');
        
        // Map dynamic attributes suggestions
        const newAttrs: { [key: string]: string } = {};
        if (data.attributes) {
          const catDefs = selectedCategory.attributeDefinitions || [];
          catDefs.forEach((def: any) => {
            if (data.attributes[def.key]) {
              newAttrs[def.id] = data.attributes[def.key];
            }
          });
        }
        setAttributes(newAttrs);
        setAiSuggestionsReceived(true);
      }
    } catch (err) {
      setFormError('AI analysis failed. Please fill manually.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle final product creation
  const handlePublish = (statusOverride?: 'DRAFT' | 'PUBLISHED') => {
    const finalPublishStatus = statusOverride || publishStatus;
    setFormError('');

    const parsedPrice = parseFloat(price);
    const parsedCost = costPrice ? parseFloat(costPrice) : undefined;
    const parsedQty = parseInt(quantity, 10);

    if (isNaN(parsedPrice) || parsedPrice <= 0) {
      setFormError('Please enter a valid price.');
      return;
    }

    const payload = {
      name,
      categoryId,
      shortDesc,
      description,
      price: parsedPrice,
      costPrice: parsedCost,
      quantity: parsedQty,
      isUnique,
      publishStatus: finalPublishStatus,
      primaryColour,
      secondaryColours,
      collectionId,
      images,
      attributes: Object.entries(attributes).map(([definitionId, value]) => ({
        definitionId,
        value,
      })),
    };

    startTransition(async () => {
      const res = await createProduct(payload);
      if (res.error) {
        setFormError(res.error);
      } else {
        setSuccessProduct({
          id: res.productId,
          name,
          price: parsedPrice,
          images,
        });
        setStep(6); // Success screen
      }
    });
  };

  // Helpers
  const selectedCategory = categories.find((c) => c.id === categoryId);
  const activeCollectionName = collections.find((c) => c.id === collectionId)?.name || '';

  const stepsList = [
    { num: 1, label: 'Photos' },
    { num: 2, label: 'Category' },
    { num: 3, label: 'AI Assist' },
    { num: 4, label: 'Pricing & Stock' },
    { num: 5, label: 'Review' },
  ];

  return (
    <div className="max-w-2xl mx-auto bg-surface-container-lowest border border-outline-variant/30 rounded-xl p-4 sm:p-8 shadow-sm relative overflow-hidden">
      {/* Decorative Brand watermark background */}
      <span className="material-symbols-outlined absolute -top-10 -right-4 text-[120px] text-primary/5 pointer-events-none z-0" style={{ fontVariationSettings: "'FILL' 1" }}>
        local_florist
      </span>

      {step <= 5 && (
        <>
          {/* Progress Header */}
          <div className="border-b border-outline-variant/20 pb-6 mb-8 relative z-10">
            <h2 className="font-display-lg text-on-surface text-2xl md:text-3xl mb-4">Add Boutique Product</h2>
            <div className="flex items-center justify-between text-xs font-label-md">
              {stepsList.map((s) => (
                <div
                  key={s.num}
                  className={`flex flex-col items-center gap-1.5 transition-colors ${
                    step === s.num
                      ? 'text-primary font-bold'
                      : step > s.num
                      ? 'text-primary-container'
                      : 'text-outline/50'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center border text-[10px] ${
                      step === s.num
                        ? 'border-primary bg-primary text-on-primary'
                        : step > s.num
                        ? 'border-primary-container bg-primary-container/20 text-primary-container'
                        : 'border-outline-variant/50 text-outline/50'
                    }`}
                  >
                    {step > s.num ? (
                      <span className="material-symbols-outlined text-[12px] font-bold">check</span>
                    ) : (
                      s.num
                    )}
                  </div>
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {formError && (
            <div className="bg-error-container/20 text-error font-body-md text-sm p-4 rounded mb-6 z-10 relative">
              {formError}
            </div>
          )}
        </>
      )}

      {/* STEP 1: UPLOAD PHOTOS */}
      {step === 1 && (
        <div className="flex flex-col gap-6 relative z-10">
          <h3 className="font-headline-md text-on-surface text-xl">Upload Product Photography</h3>
          <p className="font-body-md text-on-surface-variant">
            Upload editorial and close-up product images. The first image will be set as primary.
          </p>

          {/* Photo Drop Area */}
          <label className="border border-dashed border-outline-variant/80 hover:border-primary transition-colors rounded-xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer bg-surface-container-low/20">
            <span className="material-symbols-outlined text-4xl text-primary-container">photo_camera</span>
            <span className="font-label-md text-sm text-on-surface uppercase tracking-wider">
              {isUploading ? 'Uploading Files...' : 'Select Photos'}
            </span>
            <span className="font-body-sm text-xs text-outline">Drag/drop or click to browse files</span>
            <input
              type="file"
              multiple
              accept="image/*"
              disabled={isUploading}
              onChange={handlePhotoUpload}
              className="hidden"
            />
          </label>

          {/* Photos Grid preview */}
          {images.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-4 mt-4">
              {images.map((url, idx) => (
                <div key={idx} className="aspect-square bg-surface rounded-lg overflow-hidden border border-outline-variant/30 relative group shadow-sm">
                  <img src={url} alt={`Preview ${idx + 1}`} className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeImage(idx)}
                    className="absolute top-1.5 right-1.5 bg-black/50 text-white rounded-full p-1 hover:bg-black/85 transition-colors"
                  >
                    <span className="material-symbols-outlined text-xs">close</span>
                  </button>
                  {idx === 0 && (
                    <span className="absolute bottom-1.5 left-1.5 bg-primary/95 text-on-primary font-label-sm text-[9px] px-2 py-0.5 rounded uppercase tracking-wider">
                      Primary
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-end mt-8 pt-4 border-t border-outline-variant/15">
            <button
              onClick={() => {
                if (images.length === 0) {
                  setFormError('Please upload at least one product photo.');
                } else {
                  setStep(2);
                }
              }}
              className="bg-primary text-on-primary font-label-md py-3 px-6 rounded uppercase tracking-wider text-xs hover:opacity-90 transition-opacity"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: CATEGORY & ATTRIBUTES */}
      {step === 2 && (
        <div className="flex flex-col gap-6 relative z-10">
          <h3 className="font-headline-md text-on-surface text-xl">Select Product Category</h3>
          <p className="font-body-md text-on-surface-variant">
            Choose the boutique category to load correct layout specifications.
          </p>

          <div className="flex flex-col gap-2">
            <label className="font-label-md text-xs text-on-surface-variant uppercase">Category</label>
            <select
              value={categoryId}
              onChange={handleCategoryChange}
              className="w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary focus:ring-0 py-2 font-body-md"
            >
              <option value="">-- Choose Category --</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Dynamic Attributes Rendering based on Category */}
          {selectedCategory && (
            <div className="mt-4 border-t border-outline-variant/20 pt-6 flex flex-col gap-6">
              <h4 className="font-headline-sm text-base text-secondary uppercase tracking-wider mb-2">
                {selectedCategory.name} Specifications
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(selectedCategory.attributeDefinitions || []).map((def: any) => {
                  const currentValue = attributes[def.id] || '';
                  const handleAttrChange = (val: string) => {
                    setAttributes((prev) => ({ ...prev, [def.id]: val }));
                  };

                  return (
                    <div key={def.id} className="flex flex-col gap-2">
                      <label className="font-label-md text-xs text-on-surface-variant uppercase">
                        {def.name} {def.required && '*'}
                      </label>
                      {def.fieldType === 'SELECT' ? (
                        <select
                          value={currentValue}
                          onChange={(e) => handleAttrChange(e.target.value)}
                          className="w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary focus:ring-0 py-2 font-body-md"
                        >
                          <option value="">-- Select --</option>
                          {JSON.parse(def.options || '[]').map((opt: string) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={currentValue}
                          onChange={(e) => handleAttrChange(e.target.value)}
                          placeholder={`Enter ${def.name.toLowerCase()}`}
                          className="w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary focus:ring-0 py-2 font-body-md"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex justify-between mt-8 pt-4 border-t border-outline-variant/15">
            <button
              onClick={() => setStep(1)}
              className="border border-outline text-on-surface font-label-md py-3 px-6 rounded uppercase tracking-wider text-xs hover:bg-surface-container-low transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => {
                if (!categoryId) {
                  setFormError('Please select a category.');
                } else {
                  setStep(3);
                }
              }}
              className="bg-primary text-on-primary font-label-md py-3 px-6 rounded uppercase tracking-wider text-xs hover:opacity-90 transition-opacity"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: AI ASSISTANT SUGGESTIONS */}
      {step === 3 && (
        <div className="flex flex-col gap-6 relative z-10">
          <h3 className="font-headline-md text-on-surface text-xl">AI Assistant Tagging</h3>
          <p className="font-body-md text-on-surface-variant">
            Let the AI analyze your photography to suggest names, colors, descriptions and specs automatically.
          </p>

          {/* AI trigger block */}
          <div className="bg-secondary-container/20 rounded-xl p-6 border border-secondary-container flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>
                auto_awesome
              </span>
              <span className="font-headline-sm text-base text-on-primary-container">
                Jawhara Intelligent Merchandising
              </span>
            </div>
            <p className="font-body-sm text-sm text-on-surface-variant">
              We analyze the primary image and pre-fill details. You can review and edit all fields before publishing.
            </p>
            <button
              type="button"
              disabled={isAnalyzing}
              onClick={handleAIAssist}
              className="bg-primary text-on-primary font-label-md py-3.5 px-6 rounded uppercase tracking-wider text-xs self-start flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isAnalyzing ? (
                <>Analyzing image...</>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                  Analyze Image
                </>
              )}
            </button>
          </div>

          {/* Form edit details (populated by user or AI) */}
          <div className="flex flex-col gap-5 mt-4">
            {/* Product Name */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between items-center">
                <label className="font-label-md text-xs text-on-surface-variant uppercase">Product Name</label>
                {aiSuggestionsReceived && (
                  <span className="text-[10px] font-label-sm text-primary uppercase tracking-widest bg-secondary-container/30 px-2 py-0.5 rounded">
                    AI Suggested
                  </span>
                )}
              </div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="E.g. Mehr-e-Gul Rida"
                className="w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary focus:ring-0 py-2 font-body-md"
              />
            </div>

            {/* Short description */}
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-xs text-on-surface-variant uppercase">Short Summary Description</label>
              <input
                type="text"
                value={shortDesc}
                onChange={(e) => setShortDesc(e.target.value)}
                placeholder="E.g. A graceful sage floral Rida"
                className="w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary focus:ring-0 py-2 font-body-md"
              />
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-xs text-on-surface-variant uppercase">Full Boutique Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Detail textures, fabric weight, occasion recommendation..."
                className="w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary focus:ring-0 py-2 font-body-md resize-none"
              />
            </div>

            {/* Primary & Secondary Colours */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-1">
                <label className="font-label-md text-xs text-on-surface-variant uppercase">Primary Colour</label>
                <input
                  type="text"
                  value={primaryColour}
                  onChange={(e) => setPrimaryColour(e.target.value)}
                  placeholder="E.g. Dusty Mauve"
                  className="w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary focus:ring-0 py-2 font-body-md"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="font-label-md text-xs text-on-surface-variant uppercase">Secondary Colours (Comma Separated)</label>
                <input
                  type="text"
                  value={secondaryColours}
                  onChange={(e) => setSecondaryColours(e.target.value)}
                  placeholder="E.g. Gold, Ivory"
                  className="w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary focus:ring-0 py-2 font-body-md"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-between mt-8 pt-4 border-t border-outline-variant/15">
            <button
              onClick={() => setStep(2)}
              className="border border-outline text-on-surface font-label-md py-3 px-6 rounded uppercase tracking-wider text-xs hover:bg-surface-container-low transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => {
                if (!name.trim()) {
                  setFormError('Please enter a product name.');
                } else {
                  setStep(4);
                }
              }}
              className="bg-primary text-on-primary font-label-md py-3 px-6 rounded uppercase tracking-wider text-xs hover:opacity-90 transition-opacity"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: PRICING, STOCK, UNIQUE PIECE AND COLLECTIONS */}
      {step === 4 && (
        <div className="flex flex-col gap-6 relative z-10">
          <h3 className="font-headline-md text-on-surface text-xl">Pricing & Inventory</h3>
          <p className="font-body-md text-on-surface-variant">Configure product economics and stock settings.</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Price */}
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-xs text-on-surface-variant uppercase">Boutique Retail Price (INR)</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="E.g. 22000"
                className="w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary focus:ring-0 py-2 font-body-md"
              />
            </div>
            {/* Cost Price */}
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-xs text-on-surface-variant uppercase">Cost Price (Optional)</label>
              <input
                type="number"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="E.g. 10000"
                className="w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary focus:ring-0 py-2 font-body-md"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Quantity */}
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-xs text-on-surface-variant uppercase">Stock Quantity</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="E.g. 1"
                className="w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary focus:ring-0 py-2 font-body-md"
              />
            </div>
            {/* Collection */}
            <div className="flex flex-col gap-1">
              <label className="font-label-md text-xs text-on-surface-variant uppercase">Assign Collection (Optional)</label>
              <select
                value={collectionId}
                onChange={(e) => setCollectionId(e.target.value)}
                className="w-full bg-transparent border-0 border-b border-outline-variant focus:border-primary focus:ring-0 py-2 font-body-md"
              >
                <option value="">-- No Collection --</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Unique piece toggle checkbox */}
          <div className="bg-surface-container-low/30 p-4 border border-outline-variant/30 rounded-lg flex items-center justify-between">
            <div>
              <p className="font-label-md text-sm text-on-surface">Unique One-Of-One Product</p>
              <p className="font-body-sm text-xs text-on-surface-variant">
                If checked, inventory rules enforce that only 1 unit is ever created and cannot be sold twice.
              </p>
            </div>
            <input
              type="checkbox"
              checked={isUnique}
              onChange={(e) => {
                setIsUnique(e.target.checked);
                if (e.target.checked) setQuantity('1');
              }}
              className="text-primary focus:ring-primary border-outline-variant rounded"
            />
          </div>

          <div className="flex justify-between mt-8 pt-4 border-t border-outline-variant/15">
            <button
              onClick={() => setStep(3)}
              className="border border-outline text-on-surface font-label-md py-3 px-6 rounded uppercase tracking-wider text-xs hover:bg-surface-container-low transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => {
                const parsedPrice = parseFloat(price);
                if (isNaN(parsedPrice) || parsedPrice <= 0) {
                  setFormError('Please enter a valid price.');
                } else {
                  setStep(5);
                }
              }}
              className="bg-primary text-on-primary font-label-md py-3 px-6 rounded uppercase tracking-wider text-xs hover:opacity-90 transition-opacity"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: REVIEW & CONFIRM */}
      {step === 5 && (
        <div className="flex flex-col gap-6 relative z-10">
          <h3 className="font-headline-md text-on-surface text-xl">Review Product Entry</h3>
          <p className="font-body-md text-on-surface-variant">Check details before publishing to your boutique catalogue.</p>

          {/* Editorial Card Preview */}
          <div className="border border-outline-variant/30 rounded-xl overflow-hidden bg-surface-container-lowest grid grid-cols-1 sm:grid-cols-12 max-w-lg mx-auto shadow-sm">
            <div className="sm:col-span-5 bg-surface-container-low aspect-[3/4] relative">
              <img
                src={images[0] || 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=300'}
                alt={name}
                className="w-full h-full object-cover"
              />
              <span className="absolute top-2 left-2 bg-surface/80 backdrop-blur-sm text-[8px] font-label-sm px-1.5 py-0.5 rounded uppercase tracking-wider text-on-surface border border-outline-variant/10">
                {selectedCategory?.name}
              </span>
            </div>
            <div className="sm:col-span-7 p-6 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-label-sm text-outline uppercase tracking-wider">
                  {activeCollectionName || 'Standard Collection'}
                </span>
                <h4 className="font-headline-sm text-base text-on-surface mt-1 truncate">{name}</h4>
                <p className="font-body-sm text-xs text-on-surface-variant mt-2 line-clamp-3">
                  {shortDesc || 'No summary description provided.'}
                </p>
                <div className="flex gap-2 flex-wrap mt-3">
                  {primaryColour && (
                    <span className="text-[9px] bg-secondary-container/20 text-secondary border border-secondary-container/30 px-2 py-0.5 rounded font-label-sm">
                      {primaryColour}
                    </span>
                  )}
                  {isUnique && (
                    <span className="text-[9px] bg-primary-container/10 text-primary-container border border-primary-container/20 px-2 py-0.5 rounded font-label-sm">
                      One-of-one
                    </span>
                  )}
                </div>
              </div>
              <div className="border-t border-outline-variant/10 pt-4 mt-6 flex justify-between items-center">
                <span className="font-headline-md text-base text-primary">
                  ₹{parseFloat(price).toLocaleString('en-IN')}
                </span>
                <span className="font-body-sm text-xs text-outline">Qty: {quantity}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 mt-4">
            <label className="font-label-md text-xs text-on-surface-variant uppercase">Publish Status</label>
            <div className="flex gap-6 mt-1">
              <label className="flex items-center gap-2 font-body-md cursor-pointer">
                <input
                  type="radio"
                  name="publishStatus"
                  checked={publishStatus === 'PUBLISHED'}
                  onChange={() => setPublishStatus('PUBLISHED')}
                  className="text-primary focus:ring-primary border-outline"
                />
                Publish Immediately (Active)
              </label>
              <label className="flex items-center gap-2 font-body-md cursor-pointer">
                <input
                  type="radio"
                  name="publishStatus"
                  checked={publishStatus === 'DRAFT'}
                  onChange={() => setPublishStatus('DRAFT')}
                  className="text-primary focus:ring-primary border-outline"
                />
                Save as Draft
              </label>
            </div>
          </div>

          <div className="flex justify-between mt-8 pt-4 border-t border-outline-variant/15">
            <button
              onClick={() => setStep(4)}
              className="border border-outline text-on-surface font-label-md py-3 px-6 rounded uppercase tracking-wider text-xs hover:bg-surface-container-low transition-colors"
            >
              Back
            </button>
            <div className="flex gap-4">
              <button
                onClick={() => handlePublish('DRAFT')}
                disabled={isPending}
                className="border border-primary-container text-primary-container font-label-md py-3 px-6 rounded uppercase tracking-wider text-xs hover:bg-primary-container/5 disabled:opacity-50"
              >
                Save Draft
              </button>
              <button
                onClick={() => handlePublish()}
                disabled={isPending}
                className="bg-primary text-on-primary font-label-md py-3 px-6 rounded uppercase tracking-wider text-xs hover:opacity-90 disabled:opacity-50"
              >
                {isPending ? 'Publishing...' : 'Publish Product'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 6: SUCCESS SCREEN */}
      {step === 6 && successProduct && (
        <div className="flex flex-col items-center justify-center text-center py-10 relative z-10">
          <span className="material-symbols-outlined text-primary-container text-6xl mb-4" style={{ fontVariationSettings: "'FILL' 1" }}>
            check_circle
          </span>
          <h3 className="font-headline-md text-2xl text-on-surface mb-2">Product is ready</h3>
          <p className="font-body-md text-on-surface-variant max-w-md mb-8">
            "{successProduct.name}" has been registered successfully and added to your boutique inventory.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
            <Link
              href={`/products/${successProduct.id}`}
              className="border border-primary text-primary px-6 py-3.5 rounded font-label-md text-xs uppercase tracking-wider flex justify-center items-center gap-2 hover:bg-primary/5 transition-all"
            >
              View Product
            </Link>

            <button
              onClick={() => {
                const text = `${successProduct.name}\nPrice: ₹${Number(successProduct.price).toLocaleString('en-IN')}\nCheck it out: ${window.location.origin}/p/${successProduct.slug}`;
                const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
                window.open(url, '_blank');
              }}
              className="border border-primary-container text-primary-container px-6 py-3.5 rounded font-label-md text-xs uppercase tracking-wider flex justify-center items-center gap-2 hover:bg-primary-container/5 transition-all"
            >
              Share on WhatsApp
            </button>

            <button
              onClick={() => {
                setName('');
                setShortDesc('');
                setDescription('');
                setPrice('');
                setCostPrice('');
                setQuantity('1');
                setIsUnique(true);
                setPrimaryColour('');
                setSecondaryColours('');
                setCollectionId('');
                setImages([]);
                setAttributes({});
                setAiSuggestionsReceived(false);
                setSuccessProduct(null);
                setStep(1);
              }}
              className="bg-primary text-on-primary px-6 py-3.5 rounded font-label-md text-xs uppercase tracking-wider hover:opacity-90 transition-opacity"
            >
              Add Another Product
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
