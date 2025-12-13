import React, { useState, useEffect } from 'react';
import { withAppLayout } from '@/utils/layout';
import { Head, useForm, usePage, router } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import axios from 'axios';
import { Search, Plus, Trash2, User, UserCheck } from 'lucide-react';

type BreadcrumbItem = { title: string; href: string };

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Dashboard', href: '/dashboard' },
  { title: 'Invoices', href: '/invoices' },
  { title: 'New Invoice', href: '/invoices/create' },
];

interface Customer {
  id: string;
  name: string;
  type: string;
  type_id: number;
  wallet_id: number;
}

interface InvoiceLine {
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
}

function CreateInvoice() {
  const { props }: any = usePage();
  const [customerType, setCustomerType] = useState<'patient' | 'practitioner'>('patient');
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const { data, setData, post, processing, errors, reset } = useForm({
    customer: '',
    due_date: '',
    lines: [
      {
        description: '',
        quantity: 1,
        unit_price: 0,
        tax_rate: 13, // Default 13% GST
      },
    ],
  });

  useEffect(() => {
    if (props?.flash?.success) toast.success(props.flash.success);
    if (props?.flash?.error) toast.error(props.flash.error);
  }, [props?.flash]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a search term');
      return;
    }

    setSearching(true);
    setSearchResults([]);
    
    try {
      const response = await axios.get(route('invoices.search-customers'), {
        params: { 
          search: searchQuery.trim(),
          type: customerType,
        },
      });
      
      setSearchResults(response.data);
      
      if (response.data.length === 0) {
        toast.info(`No ${customerType} found with that information`);
      }
    } catch (error) {
      console.error('Error searching customers:', error);
      toast.error('Failed to search customers');
    } finally {
      setSearching(false);
    }
  };

  const selectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setData('customer', customer.id);
    setSearchResults([]);
    toast.success(`Selected: ${customer.name}`);
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setData('customer', '');
    setSearchQuery('');
    setSearchResults([]);
  };

  const addLine = () => {
    setData('lines', [
      ...data.lines,
      {
        description: '',
        quantity: 1,
        unit_price: 0,
        tax_rate: 13,
      },
    ]);
  };

  const removeLine = (index: number) => {
    if (data.lines.length === 1) {
      toast.error('At least one line item is required');
      return;
    }
    const newLines = data.lines.filter((_, i) => i !== index);
    setData('lines', newLines);
  };

  const updateLine = (index: number, field: keyof InvoiceLine, value: any) => {
    const newLines = [...data.lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setData('lines', newLines);
  };

  // Calculate totals
  const calculateTotals = () => {
    let subtotal = 0;
    let taxTotal = 0;

    data.lines.forEach((line) => {
      const lineSubtotal = line.quantity * line.unit_price;
      const lineTax = lineSubtotal * (line.tax_rate / 100);
      subtotal += lineSubtotal;
      taxTotal += lineTax;
    });

    return {
      subtotal: subtotal.toFixed(2),
      taxTotal: taxTotal.toFixed(2),
      total: (subtotal + taxTotal).toFixed(2),
    };
  };

  const totals = calculateTotals();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!data.customer) {
      toast.error('Please search and select a customer');
      return;
    }

    const hasEmptyLines = data.lines.some(
      (line) => !line.description || line.quantity <= 0 || line.unit_price < 0
    );

    if (hasEmptyLines) {
      toast.error('Please fill in all line items correctly');
      return;
    }

    post(route('invoices.store'), {
      preserveScroll: true,
      onSuccess: () => {
        toast.success('Invoice created successfully');
      },
      onError: (errors) => {
        console.error('Validation errors:', errors);
        Object.values(errors).forEach((error) => {
          toast.error(error as string);
        });
      },
    });
  };

  return (
    <>
      <Head title="New Invoice" />

      <div className="m-3 sm:m-6">
        <Card className="shadow-none border-none">
          <CardContent className="space-y-6 p-3 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl sm:text-2xl font-bold">Create Invoice</h2>
            </div>

            <form onSubmit={submit} className="space-y-6">
              {/* Customer Selection */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Customer *</Label>
                
                {/* Selected Customer Display */}
                {selectedCustomer ? (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-500 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-blue-900 dark:text-blue-100">
                          {selectedCustomer.name}
                        </div>
                        <div className="text-sm text-blue-700 dark:text-blue-300 capitalize">
                          {selectedCustomer.type} • Wallet ID: {selectedCustomer.wallet_id}
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={clearCustomer}
                        className="border-blue-500 text-blue-700 hover:bg-blue-100"
                      >
                        Change
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Customer Type Toggle */}
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant={customerType === 'patient' ? 'default' : 'outline'}
                        onClick={() => {
                          setCustomerType('patient');
                          setSearchQuery('');
                          setSearchResults([]);
                        }}
                        className="flex-1"
                      >
                        <User className="h-4 w-4 mr-2" />
                        Patient
                      </Button>
                      <Button
                        type="button"
                        variant={customerType === 'practitioner' ? 'default' : 'outline'}
                        onClick={() => {
                          setCustomerType('practitioner');
                          setSearchQuery('');
                          setSearchResults([]);
                        }}
                        className="flex-1"
                      >
                        <UserCheck className="h-4 w-4 mr-2" />
                        Practitioner
                      </Button>
                    </div>

                    {/* Search Input */}
                    <div className="space-y-2">
                      <Label className="text-sm">
                        {customerType === 'patient' 
                          ? 'Search by full name (First Last) or Health Card Number'
                          : 'Search by full name (First Last) or License Number'}
                      </Label>
                      <div className="flex gap-2">
                        <Input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSearch();
                            }
                          }}
                          placeholder={
                            customerType === 'patient'
                              ? 'e.g., John Doe or HC123456'
                              : 'e.g., Jane Smith or LIC789012'
                          }
                          className="flex-1"
                        />
                        <Button
                          type="button"
                          onClick={handleSearch}
                          disabled={searching || !searchQuery.trim()}
                        >
                          <Search className="h-4 w-4 mr-2" />
                          {searching ? 'Searching...' : 'Search'}
                        </Button>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Enter the complete first and last name together, or the {customerType === 'patient' ? 'health card' : 'license'} number
                      </p>
                    </div>

                    {/* Search Results */}
                    {searchResults.length > 0 && (
                      <div className="border rounded-lg divide-y max-h-60 overflow-auto">
                        {searchResults.map((customer) => (
                          <button
                            key={customer.id}
                            type="button"
                            onClick={() => selectCustomer(customer)}
                            className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                          >
                            <div className="font-medium">{customer.name}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                              {customer.type} • Wallet ID: {customer.wallet_id}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {errors.customer && <p className="text-sm text-red-500">{errors.customer}</p>}
              </div>

              {/* Due Date */}
              <div className="space-y-2">
                <Label htmlFor="due_date">Due Date</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={data.due_date}
                  onChange={(e) => setData('due_date', e.target.value)}
                  className="max-w-xs"
                />
                {errors.due_date && <p className="text-sm text-red-500">{errors.due_date}</p>}
              </div>

              {/* Items */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-lg font-semibold">Items</Label>
                  <Button type="button" onClick={addLine} size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-1" />
                    Add Line
                  </Button>
                </div>

                <div className="space-y-3">
                  {data.lines.map((line, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-12 gap-3 p-4 border rounded-lg bg-gray-50 dark:bg-gray-800"
                    >
                      {/* Description */}
                      <div className="col-span-12 sm:col-span-4">
                        <Label className="text-xs">Description *</Label>
                        <Input
                          value={line.description}
                          onChange={(e) => updateLine(index, 'description', e.target.value)}
                          placeholder="Service name"
                          className="mt-1"
                        />
                      </div>

                      {/* Quantity */}
                      <div className="col-span-4 sm:col-span-2">
                        <Label className="text-xs">Quantity *</Label>
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={line.quantity}
                          onChange={(e) =>
                            updateLine(index, 'quantity', Number(e.target.value))
                          }
                          className="mt-1"
                        />
                      </div>

                      {/* Unit Price */}
                      <div className="col-span-4 sm:col-span-2">
                        <Label className="text-xs">Unit Price (CAD) *</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.unit_price}
                          onChange={(e) =>
                            updateLine(index, 'unit_price', Number(e.target.value))
                          }
                          className="mt-1"
                        />
                      </div>

                      {/* Tax Rate */}
                      <div className="col-span-3 sm:col-span-2">
                        <Label className="text-xs">Tax %</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={line.tax_rate}
                          onChange={(e) =>
                            updateLine(index, 'tax_rate', Number(e.target.value))
                          }
                          className="mt-1"
                        />
                      </div>

                      {/* Line Total */}
                      <div className="col-span-4 sm:col-span-2 flex items-end">
                        <div className="w-full">
                          <Label className="text-xs">Total (CAD)</Label>
                          <div className="mt-1 px-3 py-2 bg-white dark:bg-gray-900 border rounded text-sm font-medium">
                            {(
                              line.quantity * line.unit_price * (1 + line.tax_rate / 100)
                            ).toFixed(2)}
                          </div>
                        </div>
                      </div>

                      {/* Remove Button */}
                      {data.lines.length > 1 && (
                        <div className="col-span-1 flex items-end justify-center">
                          <Button
                            type="button"
                            onClick={() => removeLine(index)}
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals Summary */}
              <div className="border-t pt-4">
                <div className="max-w-sm ml-auto space-y-2 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                    <span className="font-medium">CAD ${totals.subtotal}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Tax (13%):</span>
                    <span className="font-medium">CAD ${totals.taxTotal}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold border-t pt-2">
                    <span>Total:</span>
                    <span>CAD ${totals.total}</span>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex gap-3 pt-4">
                <Button type="submit" disabled={processing || !selectedCustomer}>
                  {processing ? 'Creating...' : 'Create Invoice'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.visit(route('invoices.index'))}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default withAppLayout(CreateInvoice, {
  breadcrumbs: [
    { title: 'Dashboard', href: route('dashboard') },
    { title: 'Invoices', href: route('invoices.index') },
    { title: 'New Invoice' }
  ]
});
