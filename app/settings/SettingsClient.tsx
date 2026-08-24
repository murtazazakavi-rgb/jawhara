'use client';

import React, { useState } from 'react';
import { 
  saveSystemSetting, 
  saveWhatsAppTemplate, 
  createCategoryAction, 
  toggleCategoryActiveAction 
} from './actions';

interface Template {
  id?: string;
  internalKey: string;
  metaTemplateName: string;
  languageCode: string;
  enabled: boolean;
}

interface Setting {
  key: string;
  value: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  code: string;
  description: string | null;
  isActive: boolean;
}

interface SettingsClientProps {
  initialTemplates: Template[];
  initialSettings: Setting[];
  healthStatus: {
    whatsapp: { status: string; details: string; lastInbound: string; lastOutbound: string };
    razorpay: { status: string; details: string };
    gemini: { status: string; details: string };
    storage: { status: string; details: string };
  };
  initialCategories: Category[];
}

export default function SettingsClient({ 
  initialTemplates, 
  initialSettings, 
  healthStatus,
  initialCategories
}: SettingsClientProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'integrations' | 'templates' | 'categories'>('profile');
  const [templates, setTemplates] = useState<Template[]>(initialTemplates);
  const [settings, setSettings] = useState<Setting[]>(initialSettings);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Categories management states
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [catName, setCatName] = useState('');
  const [catCode, setCatCode] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  const handleToggleCategory = async (id: string, currentActive: boolean) => {
    try {
      const nextActive = !currentActive;
      const res = await toggleCategoryActiveAction(id, nextActive);
      if (res.error) {
        alert(res.error);
      } else {
        setCategories(prev => prev.map(c => c.id === id ? { ...c, isActive: nextActive } : c));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim() || !catCode.trim()) return;
    setIsCreatingCategory(true);
    try {
      const res = await createCategoryAction({ name: catName, code: catCode, description: catDesc });
      if (res.error) {
        alert(res.error);
      } else if (res.category) {
        setCategories(prev => [...prev, res.category as Category]);
        setCatName('');
        setCatCode('');
        setCatDesc('');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsCreatingCategory(false);
    }
  };

  // Template editor form states
  const [editingTemplateKey, setEditingTemplateKey] = useState<string | null>(null);
  const [metaName, setMetaName] = useState('');
  const [langCode, setLangCode] = useState('en');
  const [isEnabled, setIsEnabled] = useState(true);

  // System settings state values
  const getSettingVal = (key: string, defaultValue: string) => {
    return settings.find(s => s.key === key)?.value || defaultValue;
  };

  const handleSaveSetting = async (key: string, val: string) => {
    setSavingKey(key);
    try {
      const res = await saveSystemSetting(key, val);
      if (res.error) {
        alert(res.error);
      } else {
        setSettings(prev => {
          const index = prev.findIndex(s => s.key === key);
          if (index > -1) {
            const updated = [...prev];
            updated[index] = { key, value: val };
            return updated;
          }
          return [...prev, { key, value: val }];
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingKey(null);
    }
  };

  const handleSaveTemplate = async (internalKey: string) => {
    try {
      const res = await saveWhatsAppTemplate({
        internalKey,
        metaTemplateName: metaName,
        languageCode: langCode,
        enabled: isEnabled,
      });

      if (res.error) {
        alert(res.error);
      } else {
        setTemplates(prev => {
          const index = prev.findIndex(t => t.internalKey === internalKey);
          const updatedVal = { internalKey, metaTemplateName: metaName, languageCode: langCode, enabled: isEnabled };
          if (index > -1) {
            const updated = [...prev];
            updated[index] = updatedVal;
            return updated;
          }
          return [...prev, updatedVal];
        });
        setEditingTemplateKey(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const startEditTemplate = (t: Template) => {
    setEditingTemplateKey(t.internalKey);
    setMetaName(t.metaTemplateName);
    setLangCode(t.languageCode);
    setIsEnabled(t.enabled);
  };

  const standardTemplates = [
    { key: 'ORDER_CONFIRMATION', name: 'Order Confirmation' },
    { key: 'PAYMENT_REQUEST', name: 'Payment Link Request' },
    { key: 'PAYMENT_RECEIVED', name: 'Payment Confirmation' },
    { key: 'RESERVATION_EXPIRING', name: 'Hold Reservation Expiring' },
    { key: 'ORDER_DISPATCHED', name: 'Shipment Tracking update' },
    { key: 'ORDER_DELIVERED', name: 'Delivery Confirmed status' },
    { key: 'FOLLOW_UP', name: 'Standard Lead Follow-up' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter">
      {/* Sidebar Tabs List */}
      <div className="md:col-span-4 lg:col-span-3 flex flex-col gap-2">
        <button 
          onClick={() => setActiveTab('profile')}
          className={`w-full text-left p-4 rounded-lg border flex items-center justify-between group transition-colors ${
            activeTab === 'profile' 
              ? 'bg-surface-container-low border-outline-variant/50 text-primary' 
              : 'bg-surface border-transparent text-on-surface-variant hover:bg-surface-container-low'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined">storefront</span>
            <span className="font-label-md text-sm">Boutique Profile</span>
          </div>
          <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">
            chevron_right
          </span>
        </button>
        
        <button 
          onClick={() => setActiveTab('integrations')}
          className={`w-full text-left p-4 rounded-lg border flex items-center justify-between group transition-colors ${
            activeTab === 'integrations' 
              ? 'bg-surface-container-low border-outline-variant/50 text-primary' 
              : 'bg-surface border-transparent text-on-surface-variant hover:bg-surface-container-low'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined">sensors</span>
            <span className="font-label-md text-sm">Integration Health</span>
          </div>
          <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">
            chevron_right
          </span>
        </button>

        <button 
          onClick={() => setActiveTab('templates')}
          className={`w-full text-left p-4 rounded-lg border flex items-center justify-between group transition-colors ${
            activeTab === 'templates' 
              ? 'bg-surface-container-low border-outline-variant/50 text-primary' 
              : 'bg-surface border-transparent text-on-surface-variant hover:bg-surface-container-low'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined">chat_bubble</span>
            <span className="font-label-md text-sm">WhatsApp Templates</span>
          </div>
          <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">
            chevron_right
          </span>
        </button>

        <button 
          onClick={() => setActiveTab('categories')}
          className={`w-full text-left p-4 rounded-lg border flex items-center justify-between group transition-colors ${
            activeTab === 'categories' 
              ? 'bg-surface-container-low border-outline-variant/50 text-primary' 
              : 'bg-surface border-transparent text-on-surface-variant hover:bg-surface-container-low'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined">category</span>
            <span className="font-label-md text-sm">Boutique Categories</span>
          </div>
          <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">
            chevron_right
          </span>
        </button>
      </div>

      {/* Tab Contents Panel */}
      <div className="md:col-span-8 lg:col-span-9">
        
        {/* TAB 1: BOUTIQUE PROFILE */}
        {activeTab === 'profile' && (
          <section className="bg-surface-container-lowest rounded-xl p-6 md:p-8 border border-outline-variant/30 shadow-sm space-y-8">
            <h2 className="font-display font-medium text-headline-sm text-primary border-b border-outline-variant/20 pb-4">
              Boutique Settings
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex flex-col gap-2">
                <label className="font-label-md text-xs text-on-surface-variant uppercase">
                  Reservation Hold Duration (Minutes)
                </label>
                <input
                  className="bg-transparent border-b border-outline-variant/50 focus:border-primary py-2 px-0 font-body-md text-body-md outline-none transition-colors"
                  type="number"
                  disabled={savingKey === 'reservationHoldMinutes'}
                  value={getSettingVal('reservationHoldMinutes', '30')}
                  onChange={(e) => handleSaveSetting('reservationHoldMinutes', e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="font-label-md text-xs text-on-surface-variant uppercase">
                  Payment Link Expiry Duration (Minutes)
                </label>
                <input
                  className="bg-transparent border-b border-outline-variant/50 focus:border-primary py-2 px-0 font-body-md text-body-md outline-none transition-colors"
                  type="number"
                  disabled={savingKey === 'paymentLinkExpiryMinutes'}
                  value={getSettingVal('paymentLinkExpiryMinutes', '120')}
                  onChange={(e) => handleSaveSetting('paymentLinkExpiryMinutes', e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2 md:col-span-2">
                <label className="font-label-md text-xs text-on-surface-variant uppercase">
                  Boutique Base Currency
                </label>
                <input
                  className="bg-transparent border-b border-outline-variant/50 focus:border-primary py-2 px-0 font-body-md text-body-md outline-none transition-colors"
                  type="text"
                  disabled={savingKey === 'currency'}
                  value={getSettingVal('currency', 'INR')}
                  onChange={(e) => handleSaveSetting('currency', e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2 md:col-span-2">
                <label className="font-label-md text-xs text-on-surface-variant uppercase">
                  Boutique WhatsApp Contact Number (with country code, e.g. 919876543210)
                </label>
                <input
                  className="bg-transparent border-b border-outline-variant/50 focus:border-primary py-2 px-0 font-body-md text-body-md outline-none transition-colors"
                  type="text"
                  placeholder="e.g. 919876543210"
                  disabled={savingKey === 'boutiquePhone'}
                  value={getSettingVal('boutiquePhone', '919876543210')}
                  onChange={(e) => handleSaveSetting('boutiquePhone', e.target.value)}
                />
              </div>
            </div>
          </section>
        )}

        {/* TAB 2: INTEGRATION HEALTH STATUS */}
        {activeTab === 'integrations' && (
          <section className="bg-surface-container-lowest rounded-xl p-6 md:p-8 border border-outline-variant/30 shadow-sm space-y-6">
            <h2 className="font-display font-medium text-headline-sm text-primary border-b border-outline-variant/20 pb-4">
              Integrations Health Panel
            </h2>

            <div className="grid grid-cols-1 gap-4">
              {/* WhatsApp Connection */}
              <div className="p-4 border border-outline-variant/30 rounded-lg flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">chat</span>
                    <span className="font-label-md text-sm font-semibold">WhatsApp Cloud API</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    healthStatus.whatsapp.status.includes('Connected') 
                      ? 'bg-success/15 text-success' 
                      : 'bg-error/15 text-error'
                  }`}>
                    {healthStatus.whatsapp.status}
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant">{healthStatus.whatsapp.details}</p>
                <div className="text-[10px] text-outline flex gap-4 mt-2">
                  <span>Last Webhook Inbound: {healthStatus.whatsapp.lastInbound}</span>
                  <span>Last Outbound Msg: {healthStatus.whatsapp.lastOutbound}</span>
                </div>
              </div>

              {/* Razorpay Connection */}
              <div className="p-4 border border-outline-variant/30 rounded-lg flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">payments</span>
                    <span className="font-label-md text-sm font-semibold">Razorpay Integration</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    healthStatus.razorpay.status.includes('Connected') 
                      ? 'bg-success/15 text-success' 
                      : 'bg-error/15 text-error'
                  }`}>
                    {healthStatus.razorpay.status}
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant">{healthStatus.razorpay.details}</p>
              </div>

              {/* Gemini Connection */}
              <div className="p-4 border border-outline-variant/30 rounded-lg flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">psychology</span>
                    <span className="font-label-md text-sm font-semibold">Google Gemini AI</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    healthStatus.gemini.status.includes('Connected') 
                      ? 'bg-success/15 text-success' 
                      : 'bg-warning/15 text-warning'
                  }`}>
                    {healthStatus.gemini.status}
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant">{healthStatus.gemini.details}</p>
              </div>

              {/* Persistent File Storage */}
              <div className="p-4 border border-outline-variant/30 rounded-lg flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">cloud</span>
                    <span className="font-label-md text-sm font-semibold">Image Asset Storage</span>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] bg-primary/15 text-primary font-bold">
                    {healthStatus.storage.status}
                  </span>
                </div>
                <p className="text-xs text-on-surface-variant">{healthStatus.storage.details}</p>
              </div>

            </div>
          </section>
        )}

        {/* TAB 3: WHATSAPP TEMPLATES MAPPINGS */}
        {activeTab === 'templates' && (
          <section className="bg-surface-container-lowest rounded-xl p-6 md:p-8 border border-outline-variant/30 shadow-sm space-y-6">
            <h2 className="font-display font-medium text-headline-sm text-primary border-b border-outline-variant/20 pb-4">
              WhatsApp Meta Templates Mapping
            </h2>
            <p className="text-xs text-on-surface-variant max-w-xl">
              Map system triggers to your pre-approved templates inside Meta Business Account. If mapping is empty or disabled, the system fallbacks to standard notification channels.
            </p>

            <div className="divide-y divide-outline-variant/25">
              {standardTemplates.map((t) => {
                const configVal = templates.find(temp => temp.internalKey === t.key);
                const isEditing = editingTemplateKey === t.key;

                return (
                  <div key={t.key} className="py-4 flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-label-md text-sm text-on-surface font-semibold">{t.name}</h4>
                        <span className="text-[10px] text-outline font-mono block">Internal Event: {t.key}</span>
                      </div>
                      {!isEditing && (
                        <button
                          onClick={() => {
                            setMetaName(configVal?.metaTemplateName || '');
                            setLangCode(configVal?.languageCode || 'en');
                            setIsEnabled(configVal?.enabled ?? true);
                            setEditingTemplateKey(t.key);
                          }}
                          className="text-primary hover:underline text-xs font-label-md"
                        >
                          Configure
                        </button>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="p-4 border border-outline-variant/50 rounded bg-[#FAF8F6] grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                        <div className="flex flex-col gap-1">
                          <label className="font-label-md text-[10px] text-on-surface-variant uppercase">Meta Template Name</label>
                          <input
                            type="text"
                            placeholder="e.g. order_confirm_v1"
                            value={metaName}
                            onChange={(e) => setMetaName(e.target.value)}
                            className="bg-transparent border-b border-outline-variant/50 focus:border-primary py-1 outline-none text-xs"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="font-label-md text-[10px] text-on-surface-variant uppercase">Language Code</label>
                          <input
                            type="text"
                            value={langCode}
                            onChange={(e) => setLangCode(e.target.value)}
                            className="bg-transparent border-b border-outline-variant/50 focus:border-primary py-1 outline-none text-xs"
                          />
                        </div>
                        <div className="flex items-center gap-4 pt-2">
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isEnabled}
                              onChange={(e) => setIsEnabled(e.target.checked)}
                              className="accent-primary"
                            />
                            <span>Enabled</span>
                          </label>
                          <div className="flex gap-2 ml-auto">
                            <button
                              onClick={() => setEditingTemplateKey(null)}
                              className="px-2.5 py-1 border border-outline-variant rounded hover:bg-surface-container-low"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSaveTemplate(t.key)}
                              className="px-2.5 py-1 bg-primary text-white rounded hover:opacity-90"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-on-surface flex gap-6">
                        <span>Meta Template: <span className="font-mono">{configVal?.metaTemplateName || 'Not configured'}</span></span>
                        <span>Language: <span className="font-mono">{configVal?.languageCode || 'en'}</span></span>
                        <span>Status: <span className={configVal?.enabled ? 'text-success font-semibold' : 'text-error'}>
                          {configVal?.enabled ? 'Active' : 'Disabled / Missing'}
                        </span></span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* TAB 4: BOUTIQUE CATEGORIES */}
        {activeTab === 'categories' && (
          <section className="bg-surface-container-lowest rounded-xl p-6 md:p-8 border border-outline-variant/30 shadow-sm space-y-8 animate-fade-in">
            <div>
              <h2 className="font-display font-medium text-headline-sm text-primary border-b border-outline-variant/20 pb-4">
                Boutique Categories
              </h2>
              <p className="text-on-surface-variant/80 text-xs mt-2">
                Manage your product category settings. Deactivating a category hides it from the product adding wizard.
              </p>
            </div>

            {/* Existing Categories List */}
            <div className="space-y-4">
              <h3 className="font-label-md text-xs text-on-surface-variant uppercase tracking-wider">
                Current Categories
              </h3>
              
              <div className="grid grid-cols-1 gap-3">
                {categories.map((cat) => (
                  <div 
                    key={cat.id} 
                    className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border border-outline-variant/30 rounded-lg bg-surface-container-low/20 gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-label-md text-sm text-on-surface font-semibold">{cat.name}</span>
                        <span className="bg-secondary-container text-primary text-[10px] font-mono px-1.5 py-0.5 rounded uppercase font-bold">
                          Code: {cat.code}
                        </span>
                      </div>
                      <p className="font-body-sm text-xs text-on-surface-variant mt-1">
                        {cat.description || 'No description provided.'}
                      </p>
                      <span className="text-[10px] font-mono text-outline block mt-1">
                        Slug: /{cat.slug}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 ml-auto sm:ml-0">
                      <span className={`text-xs px-2.5 py-0.5 rounded-full ${
                        cat.isActive 
                          ? 'bg-success/15 text-success font-semibold' 
                          : 'bg-outline-variant/30 text-outline-variant'
                      }`}>
                        {cat.isActive ? 'Active' : 'Inactive'}
                      </span>
                      <button
                        onClick={() => handleToggleCategory(cat.id, cat.isActive)}
                        className={`text-xs px-3 py-1 rounded border transition-colors cursor-pointer ${
                          cat.isActive 
                            ? 'border-error text-error hover:bg-error/5' 
                            : 'border-success text-success hover:bg-success/5'
                        }`}
                      >
                        {cat.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Create New Category Form */}
            <div className="border-t border-outline-variant/20 pt-6">
              <h3 className="font-label-md text-xs text-on-surface-variant uppercase tracking-wider mb-4">
                Add New Category
              </h3>
              
              <form onSubmit={handleCreateCategory} className="space-y-4 max-w-xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="font-label-md text-xs text-on-surface-variant uppercase">
                      Category Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Bedspreads"
                      value={catName}
                      onChange={(e) => setCatName(e.target.value)}
                      className="bg-transparent border-b border-outline-variant/50 focus:border-primary py-2 outline-none font-body-md text-body-md transition-colors"
                    />
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <label className="font-label-md text-xs text-on-surface-variant uppercase">
                      Single/Double-Letter Code * (e.g. "B" or "BD")
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={2}
                      placeholder="e.g. B"
                      value={catCode}
                      onChange={(e) => setCatCode(e.target.value)}
                      className="bg-transparent border-b border-outline-variant/50 focus:border-primary py-2 outline-none font-body-md text-body-md transition-colors uppercase font-mono"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="font-label-md text-xs text-on-surface-variant uppercase">
                    Description
                  </label>
                  <textarea
                    placeholder="Short boutique description..."
                    value={catDesc}
                    onChange={(e) => setCatDesc(e.target.value)}
                    rows={2}
                    className="bg-transparent border border-outline-variant/50 rounded p-2 focus:border-primary outline-none font-body-md text-body-md transition-colors"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isCreatingCategory}
                  className="px-6 py-2.5 bg-primary text-white rounded-lg hover:opacity-90 transition-opacity font-label-md text-sm flex items-center gap-2 cursor-pointer"
                >
                  {isCreatingCategory ? 'Creating...' : 'Create Category'}
                  <span className="material-symbols-outlined text-sm">add</span>
                </button>
              </form>
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
