import { useState } from 'react';
import {
  Info,
  Scale,
  DollarSign,
  ShieldCheck,
  Package,
  Layers,
  FileSpreadsheet,
  GitBranch,
  ArrowLeft,
  Check,
  Boxes,
  Stethoscope,
  ScrollText,
  AlertCircle,
  HelpCircle,
  Plus,
  Trash2,
  Lock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

export function InventoryProductEdit() {
  const [activeTab, setActiveTab] = useState<string>('general');
  const [itemType] = useState<string>('INVENTORY'); // locked in edit mode
  
  // State for mocked form values
  const [formValues, setFormValues] = useState({
    code: 'MED-002',
    name: 'Amoxicillin 250mg (30 caps)',
    genericName: 'Amoxicillin',
    categoryId: '1',
    baseUnitId: '1',
    isControlledSubstance: true,
    requiresBatchAndExpiryTracking: true,
    standardCost: '180.00',
    baseSellingPrice: '350.00',
    isTaxInclusive: true,
    defaultVatType: 'VAT_7',
    whtRate: 'WHT_0',
    dispensingCategory: 'Dangerous_Drug',
    revenueAccountId: 'rev-1',
    cogsAccountId: 'cogs-1',
    inventoryAssetAccountId: 'inv-1',
    barcode: '8851234567890',
    sku: 'MED-AMOX-250-30',
  });

  // Mock reference data
  const categories = [
    { id: '1', name: 'Medicine' },
    { id: '2', name: 'Supplies' },
    { id: '3', name: 'Services' },
  ];

  const units = [
    { id: '1', name: 'Capsule', symbol: 'cap' },
    { id: '2', name: 'Box', symbol: 'box' },
    { id: '3', name: 'Strip', symbol: 'strip' },
    { id: '4', name: 'Vial', symbol: 'vial' },
  ];

  const glAccounts = [
    { id: 'rev-1', code: '411100', name: 'Sales Revenue', type: 'Revenue' },
    { id: 'cogs-1', code: '511100', name: 'Cost of Goods Sold', type: 'COGS' },
    { id: 'inv-1', code: '113100', name: 'Merchandise Inventory', type: 'Asset' },
  ];

  const [conversions, setConversions] = useState([
    { unitId: '2', ratio: 30 }, // 1 Box = 30 Capsule
    { unitId: '3', ratio: 10 }, // 1 Strip = 10 Capsule
  ]);

  const [branchSettings, setBranchSettings] = useState([
    { branchName: 'Main Branch', isActive: true, retailPrice: '350.00', mac: '180.00' },
    { branchName: 'City Branch', isActive: true, retailPrice: '380.00', mac: '190.00' },
    { branchName: 'East Branch', isActive: false, retailPrice: '350.00', mac: '180.00' },
  ]);

  const handleBranchToggle = (index: number) => {
    const updated = [...branchSettings];
    updated[index].isActive = !updated[index].isActive;
    setBranchSettings(updated);
  };

  const handleBranchPriceChange = (index: number, val: string) => {
    const updated = [...branchSettings];
    updated[index].retailPrice = val;
    setBranchSettings(updated);
  };

  const handleRemoveConversion = (index: number) => {
    setConversions(conversions.filter((_, i) => i !== index));
  };

  const handleAddConversion = () => {
    setConversions([...conversions, { unitId: '', ratio: 1 }]);
  };

  const handleConversionChange = (index: number, field: string, value: any) => {
    const updated = [...conversions];
    updated[index] = { ...updated[index], [field]: value };
    setConversions(updated);
  };

  const tabs = [
    { id: 'general', label: 'General Info', icon: Info },
    { id: 'units', label: 'UoM & Units', icon: Scale },
    { id: 'financials', label: 'Financials/GL', icon: DollarSign },
    { id: 'compliance', label: 'Compliance/Tax', icon: ShieldCheck },
    { id: 'stock', label: 'Stock Levels', icon: Package },
    { id: 'accessories', label: 'Accessories', icon: Layers },
    { id: 'clinic', label: 'Clinic Details', icon: FileSpreadsheet },
    { id: 'branchSettings', label: 'Branch Pricing', icon: GitBranch },
  ];

  return (
    <div className="min-h-screen bg-slate-50/50 p-6">
      {/* Breadcrumb & Navigation */}
      <div className="max-w-5xl mx-auto mb-6">
        <a href="#back" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors gap-2 group mb-4">
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Inventory
        </a>

        {/* Dynamic header design */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">Edit Item Master</h1>
              <Badge variant="outline" className="bg-slate-100/80 font-mono text-slate-700 border-slate-300">
                {formValues.code}
              </Badge>
            </div>
            <p className="text-slate-500 text-sm mt-1">Configure and manage specifications for physical stocked goods and services.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl">
              Discard Changes
            </Button>
            <Button className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-md shadow-blue-500/10 transition-all hover:shadow-lg">
              Save Changes
            </Button>
          </div>
        </div>
      </div>

      {/* Main Workspace (Horizontal Navigation Layout) */}
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Navigation Tabs (Horizontal Top Bar for Premium UX) */}
        <div className="flex w-full gap-1.5 p-1.5 bg-slate-50/70 rounded-2xl border border-slate-200/80">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-blue-600 shadow-sm border border-slate-200/60'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/40'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${activeTab === tab.id ? 'text-blue-600' : 'text-slate-400'}`} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Form Content Area */}
        <Card className="rounded-2xl border border-slate-200/80 shadow-sm bg-white overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 px-6 py-4">
              <CardTitle className="text-base font-semibold text-slate-800">
                {tabs.find(t => t.id === activeTab)?.label}
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Manage specific details related to the item's {activeTab} profile.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              
              {/* ─── GENERAL TAB ─── */}
              {activeTab === 'general' && (
                <div className="space-y-6">
                  {/* Item Type - Card Layout Refactoring */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Item Type <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* INVENTORY CARD */}
                      <div className={`relative flex items-start gap-3 p-4 rounded-xl border-2 transition-all select-none ${
                        itemType === 'INVENTORY' 
                          ? 'border-blue-500 bg-blue-50/10 shadow-sm' 
                          : 'border-slate-200 bg-slate-50/50 opacity-60'
                      }`}>
                        <div className={`mt-0.5 rounded-lg p-1.5 ${itemType === 'INVENTORY' ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
                          <Boxes className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Stocked Good</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">Physical items with quantity tracking</p>
                        </div>
                        {itemType === 'INVENTORY' && (
                          <span className="absolute top-2 right-2 bg-blue-600 text-white rounded-full p-0.5">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                      </div>

                      {/* SERVICE CARD */}
                      <div className={`relative flex items-start gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50/30 opacity-60`}>
                        <div className="mt-0.5 rounded-lg p-1.5 bg-slate-200 text-slate-500">
                          <Stethoscope className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Service</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">Consultations, fees & veterinary procedures</p>
                        </div>
                        <span className="absolute top-2 right-2 text-slate-400">
                          <Lock className="w-3.5 h-3.5" />
                        </span>
                      </div>

                      {/* CONSUMABLE CARD */}
                      <div className={`relative flex items-start gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50/30 opacity-60`}>
                        <div className="mt-0.5 rounded-lg p-1.5 bg-slate-200 text-slate-500">
                          <ScrollText className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Consumable</p>
                          <p className="text-[11px] text-slate-500 mt-0.5">Internal clinic supplies, not for resale</p>
                        </div>
                        <span className="absolute top-2 right-2 text-slate-400">
                          <Lock className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-slate-400" />
                      Item type is locked and cannot be changed after creation.
                    </p>
                  </div>

                  {/* Fields Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Item Code *</label>
                      <input
                        type="text"
                        disabled
                        value={formValues.code}
                        className="w-full bg-slate-100 border border-slate-200 text-slate-600 rounded-xl px-3.5 py-2 text-sm font-mono focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Category *</label>
                      <select
                        value={formValues.categoryId}
                        onChange={(e) => setFormValues({ ...formValues, categoryId: e.target.value })}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Item Name *</label>
                      <input
                        type="text"
                        value={formValues.name}
                        onChange={(e) => setFormValues({ ...formValues, name: e.target.value })}
                        className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Generic Name</label>
                      <input
                        type="text"
                        value={formValues.genericName}
                        onChange={(e) => setFormValues({ ...formValues, genericName: e.target.value })}
                        className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Barcode</label>
                      <input
                        type="text"
                        value={formValues.barcode}
                        onChange={(e) => setFormValues({ ...formValues, barcode: e.target.value })}
                        className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Toggle Controls */}
                  <div className="border-t border-slate-100 pt-5 space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formValues.isControlledSubstance}
                        onChange={(e) => setFormValues({ ...formValues, isControlledSubstance: e.target.checked })}
                        className="rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                      />
                      <div>
                        <span className="text-sm font-medium text-slate-800">Controlled Substance</span>
                        <span className="block text-xs text-slate-400">Strictly regulated pharmaceutical requiring audit records</span>
                      </div>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formValues.requiresBatchAndExpiryTracking}
                        onChange={(e) => setFormValues({ ...formValues, requiresBatchAndExpiryTracking: e.target.checked })}
                        className="rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                      />
                      <div>
                        <span className="text-sm font-medium text-slate-800">Requires Batch & Expiry Date Tracking</span>
                        <span className="block text-xs text-slate-400">Enforces FEFO (First-Expiry-First-Out) dispensing compliance</span>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              {/* ─── UNITS TAB ─── */}
              {activeTab === 'units' && (
                <div className="space-y-6">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Base Unit of Measure *</label>
                    <select
                      value={formValues.baseUnitId}
                      onChange={(e) => setFormValues({ ...formValues, baseUnitId: e.target.value })}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none"
                    >
                      {units.map((u) => (
                        <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>
                      ))}
                    </select>
                    <span className="block text-xs text-slate-400 mt-1.5">Smallest unit of dispensing or billing for this item.</span>
                  </div>

                  <div className="border-t border-slate-100 pt-5">
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-800">Alternate Unit Conversions</h4>
                        <p className="text-xs text-slate-500 mt-0.5">Define repackaging ratios back to the base unit.</p>
                      </div>
                      <Button onClick={handleAddConversion} type="button" variant="outline" className="border-slate-200 hover:bg-slate-50 text-xs px-2.5 py-1.5 h-auto text-blue-600 rounded-lg">
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add Conversion
                      </Button>
                    </div>

                    {conversions.length === 0 ? (
                      <div className="text-center py-6 border border-dashed rounded-xl text-slate-400 text-xs">
                        No alternate unit conversions configured.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {conversions.map((conv, idx) => (
                          <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50/50 rounded-xl border border-slate-100">
                            <div className="flex-1">
                              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">Repackaged Unit</label>
                              <select
                                value={conv.unitId}
                                onChange={(e) => handleConversionChange(idx, 'unitId', e.target.value)}
                                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none"
                              >
                                <option value="">Select unit...</option>
                                {units.map((u) => (
                                  <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>
                                ))}
                              </select>
                            </div>
                            <div className="w-32">
                              <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                                Ratio to Base
                              </label>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400 font-mono">1 Alt =</span>
                                <input
                                  type="number"
                                  value={conv.ratio}
                                  onChange={(e) => handleConversionChange(idx, 'ratio', Number(e.target.value))}
                                  className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs text-right focus:outline-none"
                                />
                              </div>
                            </div>
                            <div className="pt-5">
                              <button onClick={() => handleRemoveConversion(idx)} type="button" className="text-rose-500 hover:bg-rose-50 p-1.5 rounded-lg transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ─── FINANCIALS TAB ─── */}
              {activeTab === 'financials' && (
                <div className="space-y-6">
                  {/* Pricing Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Standard Cost (THB) *</label>
                      <input
                        type="number"
                        value={formValues.standardCost}
                        onChange={(e) => setFormValues({ ...formValues, standardCost: e.target.value })}
                        className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Base Selling Price (THB) *</label>
                      <input
                        type="number"
                        value={formValues.baseSellingPrice}
                        onChange={(e) => setFormValues({ ...formValues, baseSellingPrice: e.target.value })}
                        className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* GL Account Setup */}
                  <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-0.5">General Ledger (GL) Mapping</h4>
                      <p className="text-[11px] text-slate-400">Map operations to chart-of-accounts bookkeeping lines.</p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Revenue GL Account</label>
                        <select
                          value={formValues.revenueAccountId}
                          onChange={(e) => setFormValues({ ...formValues, revenueAccountId: e.target.value })}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none"
                        >
                          <option value="">Inherit from Category</option>
                          {glAccounts.map((a) => (
                            <option key={a.id} value={a.id}>{a.code} — {a.name} ({a.type})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">COGS GL Account</label>
                        <select
                          value={formValues.cogsAccountId}
                          onChange={(e) => setFormValues({ ...formValues, cogsAccountId: e.target.value })}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none"
                        >
                          <option value="">Inherit from Category</option>
                          {glAccounts.map((a) => (
                            <option key={a.id} value={a.id}>{a.code} — {a.name} ({a.type})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Inventory Asset GL Account</label>
                        <select
                          value={formValues.inventoryAssetAccountId}
                          onChange={(e) => setFormValues({ ...formValues, inventoryAssetAccountId: e.target.value })}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none"
                        >
                          <option value="">Inherit from Category</option>
                          {glAccounts.map((a) => (
                            <option key={a.id} value={a.id}>{a.code} — {a.name} ({a.type})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── COMPLIANCE & TAX TAB ─── */}
              {activeTab === 'compliance' && (
                <div className="space-y-6">
                  {/* Tax Config */}
                  <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tax Profile Defaults</h4>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">Default VAT Type *</label>
                        <select
                          value={formValues.defaultVatType}
                          onChange={(e) => setFormValues({ ...formValues, defaultVatType: e.target.value })}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none"
                        >
                          <option value="VAT_7">Standard 7% VAT</option>
                          <option value="VAT_EXEMPT">Exempt Supply</option>
                          <option value="NON_VAT">Out of VAT Scope</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-600 mb-1">WHT Rate *</label>
                        <select
                          value={formValues.whtRate}
                          onChange={(e) => setFormValues({ ...formValues, whtRate: e.target.value })}
                          className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none"
                        >
                          <option value="WHT_0">0%</option>
                          <option value="WHT_1">1% - Transport / Delivery</option>
                          <option value="WHT_3">3% - Services / Consulting</option>
                        </select>
                      </div>
                    </div>

                    <label className="flex items-center gap-3 cursor-pointer pt-2">
                      <input
                        type="checkbox"
                        checked={formValues.isTaxInclusive}
                        onChange={(e) => setFormValues({ ...formValues, isTaxInclusive: e.target.checked })}
                        className="rounded-lg border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                      />
                      <div>
                        <span className="text-sm font-medium text-slate-800">Price is tax-inclusive</span>
                        <span className="block text-xs text-slate-400">VAT (7%) is already factored in standard cost and base price</span>
                      </div>
                    </label>
                  </div>

                  {/* Dispensing category */}
                  <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">FDA & Dispensing Category</h4>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">FDA Dispensing Compliance Category *</label>
                      <select
                        value={formValues.dispensingCategory}
                        onChange={(e) => setFormValues({ ...formValues, dispensingCategory: e.target.value })}
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none"
                      >
                        <option value="General_Retail">General Retail</option>
                        <option value="Household_Remedy">Household Remedy</option>
                        <option value="Dangerous_Drug">Dangerous Drug - PIN Override Required</option>
                        <option value="Specially_Controlled_Drug">Specially Controlled Drug - Prescription Match Required</option>
                        <option value="Clinic_Use_Only">Clinic Use Only - Hard Block OTC</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── STOCK TAB ─── */}
              {activeTab === 'stock' && (
                <div className="space-y-6">
                  {/* Stock Levels summary */}
                  <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200/60 space-y-4">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Inventory Stock Summary</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                      <div className="bg-white p-4 rounded-xl border border-slate-100">
                        <span className="block text-xs font-medium text-slate-500">In Stock</span>
                        <span className="block text-xl font-bold text-slate-800 mt-1">450</span>
                        <span className="text-[10px] text-slate-400 font-mono">Capsules</span>
                      </div>
                      <div className="bg-white p-4 rounded-xl border border-slate-100">
                        <span className="block text-xs font-medium text-slate-500">Available</span>
                        <span className="block text-xl font-bold text-green-600 mt-1">450</span>
                        <span className="text-[10px] text-slate-400 font-mono">0 Reserved</span>
                      </div>
                      <div className="bg-white p-4 rounded-xl border border-slate-100">
                        <span className="block text-xs font-medium text-slate-500">Batches / Lots</span>
                        <span className="block text-xl font-bold text-slate-800 mt-1">2</span>
                        <span className="text-[10px] text-rose-500 font-medium">1 Expiring Soon</span>
                      </div>
                    </div>
                  </div>

                  <div className="border border-slate-200/80 rounded-xl overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                          <th className="px-4 py-2">Batch / Lot No.</th>
                          <th className="px-4 py-2">Expiry Date</th>
                          <th className="px-4 py-2 text-right">Quantity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr>
                          <td className="px-4 py-3 font-mono text-slate-800">LOT-AMX-2026-01</td>
                          <td className="px-4 py-3 text-slate-700">2026-12-31</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-800">300</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-3 font-mono text-slate-800">LOT-AMX-2025-09</td>
                          <td className="px-4 py-3 text-rose-600 font-medium">2026-09-30 (Soon)</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-800">150</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ─── ACCESSORIES TAB ─── */}
              {activeTab === 'accessories' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-800">Linked Accessories / Consumables</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Attach auxiliary physical items that are consumed automatically when dispensing this product.</p>
                    </div>
                    <Button variant="outline" className="border-slate-200 hover:bg-slate-50 text-xs px-2.5 py-1.5 h-auto text-blue-600 rounded-lg">
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add Accessory
                    </Button>
                  </div>

                  <div className="border border-slate-200/80 rounded-xl overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                          <th className="px-4 py-2.5">Accessory Product</th>
                          <th className="px-4 py-2.5">Code</th>
                          <th className="px-4 py-2.5 text-right">Ratio (Used)</th>
                          <th className="px-4 py-2.5 w-16"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        <tr>
                          <td className="px-4 py-3 font-medium text-slate-800">Pet Medicine Bottle (Plastic 100ml)</td>
                          <td className="px-4 py-3 font-mono text-slate-500">BOT-001</td>
                          <td className="px-4 py-3 text-right font-medium">0.033 (1 bottle per 30 caps)</td>
                          <td className="px-4 py-3 text-center">
                            <button type="button" className="text-rose-500 hover:bg-rose-50 p-1 rounded-lg">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ─── CLINIC DETAILS TAB ─── */}
              {activeTab === 'clinic' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Default Supplier</label>
                      <select className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none">
                        <option value="">None configured</option>
                        <option value="1">Siam Vet Supplies</option>
                        <option value="2">Pacific Animal Health</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Default Doctor Fee (THB)</label>
                      <input
                        type="number"
                        placeholder="0.00"
                        className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Reorder Point (Min Alert)</label>
                      <input
                        type="number"
                        value="100"
                        className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Minimum Stock Level</label>
                      <input
                        type="number"
                        value="50"
                        className="w-full border border-slate-200 rounded-xl px-3.5 py-2 text-sm focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ─── BRANCH SETTINGS TAB ─── */}
              {activeTab === 'branchSettings' && (
                <div className="space-y-4">
                  <div className="bg-slate-50/50 p-4 rounded-xl border border-slate-100 mb-2">
                    <p className="text-xs text-slate-500">
                      Configure custom retail pricing and activation rules for this product on a per-branch basis. 
                      Disabled branches will hide this product from POS checkouts and invoice generation.
                    </p>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200/80">
                    <table className="w-full text-xs text-left">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                          <th className="px-4 py-3">Branch</th>
                          <th className="px-4 py-3 w-28">Active Status</th>
                          <th className="px-4 py-3 w-40 text-right">Retail Price (THB)</th>
                          <th className="px-4 py-3 w-40 text-right">Moving Avg Cost (THB)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {branchSettings.map((b, idx) => (
                          <tr key={idx} className={b.isActive ? 'hover:bg-slate-50/30' : 'bg-slate-50/30 opacity-70'}>
                            <td className="px-4 py-3 font-semibold text-slate-800">{b.branchName}</td>
                            <td className="px-4 py-3">
                              {/* Custom Styled Switch */}
                              <button
                                type="button"
                                onClick={() => handleBranchToggle(idx)}
                                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                  b.isActive ? 'bg-blue-600' : 'bg-slate-200'
                                }`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                    b.isActive ? 'translate-x-4' : 'translate-x-0'
                                  }`}
                                />
                              </button>
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                disabled={!b.isActive}
                                value={b.retailPrice}
                                onChange={(e) => handleBranchPriceChange(idx, e.target.value)}
                                className="w-full border border-slate-200 rounded-lg px-2.5 py-1 text-right text-xs focus:outline-none disabled:bg-slate-100 disabled:text-slate-400"
                              />
                            </td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                disabled
                                value={b.mac}
                                className="w-full bg-slate-100 border border-slate-200 text-slate-500 rounded-lg px-2.5 py-1 text-right text-xs focus:outline-none"
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </CardContent>
          </Card>
        </div>
      </div>
  );
}
