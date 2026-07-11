'use client';

import { useEffect, useState } from 'react';
import { 
  FileText, 
  Settings, 
  Plus, 
  Trash2, 
  Edit2, 
  RefreshCw, 
  HelpCircle, 
  AlertCircle, 
  Info,
  CheckCircle,
  Undo
} from 'lucide-react';
import {
  Button,
  Input,
  Label,
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  Textarea
} from '@petiatrics/ui';
import { apiClient, ApiError } from '../../../../../lib/api-client';

interface DocumentTypeDefinition {
  id: string;
  clinicId: string | null;
  code: string;
  label: string;
  defaultTemplate: string;
  defaultResetInterval: 'YEARLY' | 'MONTHLY' | 'DAILY' | 'NEVER';
  scope: 'CLINIC' | 'BRANCH';
  isSystem: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface DocumentSequenceConfig {
  id: string;
  clinicId: string;
  documentType: string;
  template: string;
  resetInterval: 'YEARLY' | 'MONTHLY' | 'DAILY' | 'NEVER';
  scope: 'CLINIC' | 'BRANCH';
  createdAt: string;
  updatedAt: string;
}

export default function DocumentSequenceClient() {
  const [types, setTypes] = useState<DocumentTypeDefinition[]>([]);
  const [configs, setConfigs] = useState<DocumentSequenceConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Slide-over state for Document Type
  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<DocumentTypeDefinition | null>(null);
  const [typeForm, setTypeForm] = useState({
    code: '',
    label: '',
    defaultTemplate: '',
    defaultResetInterval: 'YEARLY' as 'YEARLY' | 'MONTHLY' | 'DAILY' | 'NEVER',
    scope: 'CLINIC' as 'CLINIC' | 'BRANCH',
  });

  // Modal state for Config overrides
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<{
    id?: string;
    documentType: string;
    template: string;
    resetInterval: 'YEARLY' | 'MONTHLY' | 'DAILY' | 'NEVER';
    scope: 'CLINIC' | 'BRANCH';
  } | null>(null);
  const [configForm, setConfigForm] = useState({
    template: '',
    resetInterval: 'YEARLY' as 'YEARLY' | 'MONTHLY' | 'DAILY' | 'NEVER',
    scope: 'CLINIC' as 'CLINIC' | 'BRANCH',
  });

  // Delete confirm states
  const [deleteConfirmConfigId, setDeleteConfirmConfigId] = useState<string | null>(null);
  const [deleteConfirmTypeId, setDeleteConfirmTypeId] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const [fetchedTypes, fetchedConfigs] = await Promise.all([
        apiClient.get<DocumentTypeDefinition[]>('/document-sequence/types'),
        apiClient.get<DocumentSequenceConfig[]>('/document-sequence/configs'),
      ]);
      setTypes(fetchedTypes || []);
      setConfigs(fetchedConfigs || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load document sequencing settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTypeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Template validation helper
    if (!typeForm.defaultTemplate.includes('{number')) {
      setError('Template must contain {number} or {number:X} (e.g. {number:4}) to generate sequence numbers.');
      return;
    }

    try {
      if (selectedType) {
        // Edit custom type
        await apiClient.patch(`/document-sequence/types/${selectedType.id}`, {
          label: typeForm.label,
          defaultTemplate: typeForm.defaultTemplate,
          defaultResetInterval: typeForm.defaultResetInterval,
          scope: typeForm.scope,
        });
        setSuccess('Document type updated successfully.');
      } else {
        // Create custom type
        await apiClient.post('/document-sequence/types', {
          code: typeForm.code,
          label: typeForm.label,
          defaultTemplate: typeForm.defaultTemplate,
          defaultResetInterval: typeForm.defaultResetInterval,
          scope: typeForm.scope,
        });
        setSuccess('Custom document type created successfully.');
      }
      setIsTypeOpen(false);
      fetchData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    }
  };

  const handleTypeDelete = async (id: string) => {
    setError('');
    setSuccess('');
    try {
      await apiClient.delete(`/document-sequence/types/${id}`);
      setSuccess('Document type deactivated.');
      fetchData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete document type.');
    }
  };

  const handleConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedConfig) return;
    setError('');
    setSuccess('');

    if (!configForm.template.includes('{number')) {
      setError('Template must contain {number} or {number:X} (e.g. {number:4}) to generate sequence numbers.');
      return;
    }

    try {
      await apiClient.post('/document-sequence/configs', {
        documentType: selectedConfig.documentType,
        template: configForm.template,
        resetInterval: configForm.resetInterval,
        scope: configForm.scope,
      });
      setSuccess('Sequence configuration saved.');
      setIsConfigOpen(false);
      fetchData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save configuration.');
    }
  };

  const handleConfigDelete = async (id: string) => {
    setError('');
    setSuccess('');
    try {
      await apiClient.delete(`/document-sequence/configs/${id}`);
      setSuccess('Override configuration removed. Reverted to defaults.');
      fetchData();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove config override.');
    }
  };

  const openTypeForm = (type?: DocumentTypeDefinition) => {
    setError('');
    if (type) {
      setSelectedType(type);
      setTypeForm({
        code: type.code,
        label: type.label,
        defaultTemplate: type.defaultTemplate,
        defaultResetInterval: type.defaultResetInterval,
        scope: type.scope,
      });
    } else {
      setSelectedType(null);
      setTypeForm({
        code: '',
        label: '',
        defaultTemplate: 'DOC-{yyyy}{mm}-{number:4}',
        defaultResetInterval: 'YEARLY',
        scope: 'CLINIC',
      });
    }
    setIsTypeOpen(true);
  };

  const openConfigForm = (docType: string, existingConfig?: DocumentSequenceConfig, typeDef?: DocumentTypeDefinition) => {
    setError('');
    const initialTemplate = existingConfig?.template ?? typeDef?.defaultTemplate ?? 'DOC-{yyyy}-{number:4}';
    const initialInterval = existingConfig?.resetInterval ?? typeDef?.defaultResetInterval ?? 'YEARLY';
    const initialScope = existingConfig?.scope ?? typeDef?.scope ?? 'CLINIC';

    setSelectedConfig({
      id: existingConfig?.id,
      documentType: docType,
      template: initialTemplate,
      resetInterval: initialInterval,
      scope: initialScope,
    });
    setConfigForm({
      template: initialTemplate,
      resetInterval: initialInterval,
      scope: initialScope,
    });
    setIsConfigOpen(true);
  };

  if (loading && types.length === 0) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-5">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 flex items-center gap-2">
            <Settings className="h-8 w-8 text-blue-600" />
            Document Sequencing
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure system and custom document types, template formats, and dynamic number sequences.
          </p>
        </div>
        <Button onClick={() => openTypeForm()} className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 shadow-md hover:shadow-lg transition-all duration-200">
          <Plus className="h-4 w-4" /> Add Custom Type
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 text-red-700 text-sm shadow-sm animate-shake">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-500" />
          <div>{error}</div>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3 text-green-800 text-sm shadow-sm animate-fade-in">
          <CheckCircle className="h-5 w-5 shrink-0 text-green-600" />
          <div>{success}</div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 flex gap-4 text-sm text-blue-900 shadow-sm leading-relaxed">
        <Info className="h-6 w-6 text-blue-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Template Syntax Guide:</span> Utilize placeholders to construct sequence formats.
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-3 font-mono text-xs">
            <div className="bg-white p-2 rounded border border-blue-100"><span className="text-blue-600 font-bold">{"{yyyy}"}</span>: 4-digit Year (e.g. 2026)</div>
            <div className="bg-white p-2 rounded border border-blue-100"><span className="text-blue-600 font-bold">{"{yy}"}</span>: 2-digit Year (e.g. 26)</div>
            <div className="bg-white p-2 rounded border border-blue-100"><span className="text-blue-600 font-bold">{"{mm}"}</span>: 2-digit Month (e.g. 07)</div>
            <div className="bg-white p-2 rounded border border-blue-100"><span className="text-blue-600 font-bold">{"{dd}"}</span>: 2-digit Day (e.g. 11)</div>
            <div className="bg-white p-2 rounded border border-blue-100"><span className="text-blue-600 font-bold">{"{number:X}"}</span>: X-padded Counter (e.g. {"{number:4}"} = 0001)</div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="configs" className="w-full">
        <TabsList className="bg-gray-100 p-1 rounded-lg border flex gap-2 w-fit mb-6">
          <TabsTrigger value="configs" className="px-5 py-2 rounded-md text-sm font-semibold transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600">
            Sequence Overrides
          </TabsTrigger>
          <TabsTrigger value="types" className="px-5 py-2 rounded-md text-sm font-semibold transition-all data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-blue-600">
            Document Type Definitions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="configs" className="space-y-4">
          <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
            <Table>
              <TableHeader className="bg-gray-50 border-b">
                <TableRow>
                  <TableHead className="font-bold text-gray-700">Document Type</TableHead>
                  <TableHead className="font-bold text-gray-700">Sequence Format / Template</TableHead>
                  <TableHead className="font-bold text-gray-700">Reset Interval</TableHead>
                  <TableHead className="font-bold text-gray-700">Scope</TableHead>
                  <TableHead className="font-bold text-gray-700">Source</TableHead>
                  <TableHead className="font-bold text-gray-700 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {types.map((type) => {
                  const config = configs.find((c) => c.documentType === type.code);
                  const isOverride = !!config;
                  const currentTemplate = config ? config.template : type.defaultTemplate;
                  const currentInterval = config ? config.resetInterval : type.defaultResetInterval;
                  const currentScope = config ? config.scope : type.scope;

                  return (
                    <TableRow key={type.code} className="hover:bg-gray-50/50 transition-colors">
                      <TableCell className="font-medium">
                        <div>
                          <div className="text-gray-900 font-semibold">{type.label}</div>
                          <div className="text-xs text-gray-400 font-mono mt-0.5">{type.code}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono bg-slate-100 text-slate-800 px-2.5 py-1 rounded text-xs border border-slate-200">
                          {currentTemplate}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-xs px-2.5 py-0.5">
                          {currentInterval.toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize text-xs px-2.5 py-0.5">
                          {currentScope === 'BRANCH' ? 'Branch-Scoped' : 'Clinic-Wide'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isOverride ? (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100 text-xs">
                            Clinic Override
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-100 text-xs">
                            Global Default
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            onClick={() => openConfigForm(type.code, config, type)}
                            variant="outline" 
                            size="sm" 
                            className="h-8 flex items-center gap-1 border-blue-200 hover:bg-blue-50 text-blue-600 text-xs font-semibold"
                          >
                            <Edit2 className="h-3 w-3" /> Customize
                          </Button>
                          {isOverride && (
                            <Button 
                              onClick={() => setDeleteConfirmConfigId(config.id)}
                              variant="outline" 
                              size="sm" 
                              className="h-8 flex items-center gap-1 border-red-200 hover:bg-red-50 text-red-600 text-xs font-semibold"
                            >
                              <Undo className="h-3.5 w-3.5" /> Revert
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {types.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-gray-400">
                      No document types defined.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="types" className="space-y-4">
          <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
            <Table>
              <TableHeader className="bg-gray-50 border-b">
                <TableRow>
                  <TableHead className="font-bold text-gray-700">Code</TableHead>
                  <TableHead className="font-bold text-gray-700">Label</TableHead>
                  <TableHead className="font-bold text-gray-700">Default Template</TableHead>
                  <TableHead className="font-bold text-gray-700">Default Reset</TableHead>
                  <TableHead className="font-bold text-gray-700">Default Scope</TableHead>
                  <TableHead className="font-bold text-gray-700">System</TableHead>
                  <TableHead className="font-bold text-gray-700 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {types.map((type) => (
                  <TableRow key={type.id} className="hover:bg-gray-50/50 transition-colors">
                    <TableCell className="font-mono text-xs font-bold text-gray-800">{type.code}</TableCell>
                    <TableCell className="font-semibold text-gray-900">{type.label}</TableCell>
                    <TableCell className="font-mono text-xs text-gray-600">{type.defaultTemplate}</TableCell>
                    <TableCell className="capitalize text-xs text-gray-600">{type.defaultResetInterval.toLowerCase()}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize text-xs px-2.5 py-0.5">
                        {type.scope === 'BRANCH' ? 'Branch-Scoped' : 'Clinic-Wide'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {type.isSystem ? (
                        <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 text-xs">System Built-In</Badge>
                      ) : (
                        <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-100 text-xs">Custom Definition</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!type.isSystem ? (
                        <div className="flex justify-end gap-2">
                          <Button 
                            onClick={() => openTypeForm(type)}
                            variant="outline" 
                            size="sm" 
                            className="h-8 flex items-center gap-1 border-blue-200 hover:bg-blue-50 text-blue-600 text-xs font-semibold"
                          >
                            <Edit2 className="h-3 w-3" /> Edit
                          </Button>
                          <Button 
                            onClick={() => setDeleteConfirmTypeId(type.id)}
                            variant="outline" 
                            size="sm" 
                            className="h-8 flex items-center gap-1 border-red-200 hover:bg-red-50 text-red-600 text-xs font-semibold"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 font-medium pr-3 italic">System Read-Only</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Slide-over panel for Custom Document Types */}
      <Sheet open={isTypeOpen} onOpenChange={setIsTypeOpen}>
        <SheetContent className="sm:max-w-md bg-white border-l shadow-2xl p-6">
          <SheetHeader className="mb-6 border-b pb-4">
            <SheetTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              {selectedType ? 'Edit Custom Type' : 'Add Custom Document Type'}
            </SheetTitle>
            <SheetDescription className="text-xs text-gray-500 mt-1">
              {selectedType 
                ? 'Update default configuration attributes for this custom document sequence.' 
                : 'Define a custom document code and initial templates to generate sequential identifiers.'}
            </SheetDescription>
          </SheetHeader>

          <form onSubmit={handleTypeSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="code" className="text-sm font-semibold text-gray-700">Code</Label>
              <Input
                id="code"
                value={typeForm.code}
                onChange={(e) => setTypeForm({ ...typeForm, code: e.target.value })}
                placeholder="e.g. REFUND_REQUEST"
                required
                disabled={!!selectedType}
                className="font-mono uppercase border-gray-300 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">Unique uppercase code identifier. E.g. MY_DOC</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="label" className="text-sm font-semibold text-gray-700">Label (Display Name)</Label>
              <Input
                id="label"
                value={typeForm.label}
                onChange={(e) => setTypeForm({ ...typeForm, label: e.target.value })}
                placeholder="e.g. Refund Request"
                required
                className="border-gray-300 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultTemplate" className="text-sm font-semibold text-gray-700">Default Template</Label>
              <Input
                id="defaultTemplate"
                value={typeForm.defaultTemplate}
                onChange={(e) => setTypeForm({ ...typeForm, defaultTemplate: e.target.value })}
                placeholder="e.g. REF-{yyyy}-{number:4}"
                required
                className="font-mono border-gray-300 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-400">Must include <span className="font-mono bg-slate-100 px-1 rounded">{"{number}"}</span> or <span className="font-mono bg-slate-100 px-1 rounded">{"{number:X}"}</span> (e.g. {"{number:5}"})</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultResetInterval" className="text-sm font-semibold text-gray-700">Default Reset Interval</Label>
              <Select
                value={typeForm.defaultResetInterval}
                onValueChange={(val: any) => setTypeForm({ ...typeForm, defaultResetInterval: val })}
              >
                <SelectTrigger id="defaultResetInterval" className="border-gray-300">
                  <SelectValue placeholder="Select reset interval" />
                </SelectTrigger>
                <SelectContent className="bg-white border shadow-md">
                  <SelectItem value="NEVER">Never Reset (Continuous)</SelectItem>
                  <SelectItem value="YEARLY">Yearly Reset</SelectItem>
                  <SelectItem value="MONTHLY">Monthly Reset</SelectItem>
                  <SelectItem value="DAILY">Daily Reset</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="defaultScope" className="text-sm font-semibold text-gray-700">Default Scope</Label>
              <Select
                value={typeForm.scope}
                onValueChange={(val: any) => setTypeForm({ ...typeForm, scope: val })}
              >
                <SelectTrigger id="defaultScope" className="border-gray-300">
                  <SelectValue placeholder="Select scope" />
                </SelectTrigger>
                <SelectContent className="bg-white border shadow-md">
                  <SelectItem value="CLINIC">Clinic-Wide (รวมทุกสาขา)</SelectItem>
                  <SelectItem value="BRANCH">Per-Branch (แยกตามสาขา)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-3 pt-6 border-t">
              <Button type="button" variant="outline" onClick={() => setIsTypeOpen(false)} className="border-gray-300">
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white shadow-md">
                {selectedType ? 'Save Changes' : 'Create Type'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      {/* Modal Dialog for Configuration Overrides */}
      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent className="sm:max-w-md bg-white border rounded-xl shadow-2xl p-6">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Settings className="h-5 w-5 text-blue-600" />
              Customize Sequencing Rules
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500 mt-1">
              Apply clinic-specific formatting and reset parameters for <span className="font-semibold text-gray-800 font-mono">{selectedConfig?.documentType}</span>.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleConfigSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="configTemplate" className="text-sm font-semibold text-gray-700">Custom Template</Label>
              <Input
                id="configTemplate"
                value={configForm.template}
                onChange={(e) => setConfigForm({ ...configForm, template: e.target.value })}
                placeholder="e.g. PO-{yyyy}{mm}-{number:5}"
                required
                className="font-mono border-gray-300 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-400">Must include <span className="font-mono bg-slate-100 px-1 rounded">{"{number}"}</span> or <span className="font-mono bg-slate-100 px-1 rounded">{"{number:X}"}</span></p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="configResetInterval" className="text-sm font-semibold text-gray-700">Reset Interval</Label>
              <Select
                value={configForm.resetInterval}
                onValueChange={(val: any) => setConfigForm({ ...configForm, resetInterval: val })}
              >
                <SelectTrigger id="configResetInterval" className="border-gray-300">
                  <SelectValue placeholder="Select reset interval" />
                </SelectTrigger>
                <SelectContent className="bg-white border shadow-md">
                  <SelectItem value="NEVER">Never Reset (Continuous)</SelectItem>
                  <SelectItem value="YEARLY">Yearly Reset</SelectItem>
                  <SelectItem value="MONTHLY">Monthly Reset</SelectItem>
                  <SelectItem value="DAILY">Daily Reset</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="configScope" className="text-sm font-semibold text-gray-700">Scope</Label>
              <Select
                value={configForm.scope}
                onValueChange={(val: any) => setConfigForm({ ...configForm, scope: val })}
              >
                <SelectTrigger id="configScope" className="border-gray-300">
                  <SelectValue placeholder="Select scope" />
                </SelectTrigger>
                <SelectContent className="bg-white border shadow-md">
                  <SelectItem value="CLINIC">Clinic-Wide (รวมทุกสาขา)</SelectItem>
                  <SelectItem value="BRANCH">Per-Branch (แยกตามสาขา)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsConfigOpen(false)} className="border-gray-300">
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white shadow-md">
                Save Sequence Config
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirm Config Revert Dialog */}
      <Dialog open={!!deleteConfirmConfigId} onOpenChange={(open) => !open && setDeleteConfirmConfigId(null)}>
        <DialogContent className="sm:max-w-md bg-white border rounded-xl shadow-2xl p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Confirm Revert Override
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 mt-2">
              Are you sure you want to remove this override config? It will revert to the default template from the document type definition.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setDeleteConfirmConfigId(null)} className="border-gray-300">
              Cancel
            </Button>
            <Button 
              type="button"
              className="bg-red-600 hover:bg-red-700 text-white shadow-md font-semibold" 
              onClick={async () => {
                if (!deleteConfirmConfigId) return;
                const id = deleteConfirmConfigId;
                setDeleteConfirmConfigId(null);
                await handleConfigDelete(id);
              }}
            >
              Confirm Revert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Custom Type Delete Dialog */}
      <Dialog open={!!deleteConfirmTypeId} onOpenChange={(open) => !open && setDeleteConfirmTypeId(null)}>
        <DialogContent className="sm:max-w-md bg-white border rounded-xl shadow-2xl p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-500" />
              Confirm Deactivate Type
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 mt-2">
              Are you sure you want to delete this custom document type? Dynamic sequencing for this type will be deactivated.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => setDeleteConfirmTypeId(null)} className="border-gray-300">
              Cancel
            </Button>
            <Button 
              type="button"
              className="bg-red-600 hover:bg-red-700 text-white shadow-md font-semibold" 
              onClick={async () => {
                if (!deleteConfirmTypeId) return;
                const id = deleteConfirmTypeId;
                setDeleteConfirmTypeId(null);
                await handleTypeDelete(id);
              }}
            >
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
