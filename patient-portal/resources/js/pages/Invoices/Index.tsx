import { useEffect, useMemo, useState } from 'react';
import { withAppLayout } from '@/utils/layout';
import PageHeader from '@/components/general/PageHeader';
import FilterBar from '@/components/general/FilterBar';
import Pagination from '@/components/general/Pagination';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { toast } from 'sonner';
import { Plus, Receipt, Wallet, ChevronDown, ChevronRight, Loader2, BookOpen, Eye, Edit, Mail } from 'lucide-react';
import axios from 'axios';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

type Invoiceable = { name?: string | null } | null;

export type Invoice = {
  id: number;
  invoice_number?: string;           // e.g., INV-001, MC-002
  price: string | number;            // decimal(64,4) comes as string from backend
  subtotal?: string | number;        // decimal(64,4) 
  tax_total?: string | number;       // decimal(64,4)
  invoiceable_type: string;          // e.g., 'order' or 'App\\Models\\Order'
  invoiceable_id: number;
  invoiceable?: Invoiceable;
  payment_method?: string | null;
  paid_at?: string | null;
  status?: string;                   // pending, paid, paid_manual, failed, refunded, partial
  has_transactions?: boolean;
  has_payment_transaction?: boolean;
  has_payout_transaction?: boolean;
  invoiceable_type_short?: string;   // Just 'Appointment' instead of full class name
  deleted_at?: string | null;
  created_at?: string | null;
  meta?: {
    lines?: Array<{
      desc?: string;
      qty?: number;
      unit_price?: string | number;
      tax_rate?: string | number;
      tax_amount?: string | number;
      line_subtotal?: string | number;
    }>;
  };
};

type Paginator<T> = {
  data: T[];
  current_page: number;
  last_page: number;
  total: number;
  from: number;
  to: number;
  links?: { url: string | null; label: string; active: boolean }[];
};

interface Props {
  invoices: Paginator<Invoice>;
  filters: {
    search?: string;
    invoiceable_type?: string;
    date_from?: string;
    date_to?: string;
    perPage?: number;
  };
  // Optional list of allowed types (aliases or FQCNs) to populate the filter
  invoiceableTypes?: { label: string; value: string }[];
  flash?: { success?: string; error?: string };
}

const breadcrumbs = [
  { title: 'Dashboard', href: '/dashboard' },
  { title: 'Invoices', href: '' },
];

const formatType = (val: string) => {
  const base = val.includes('\\') ? val.split('\\').pop() ?? val : val;
  return base
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
};

const formatStatus = (status: string) => {
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

function InvoicesIndex({ invoices, filters, invoiceableTypes = [], flash }: Props) {
  const { flash: pageFlash, errors: pageErrors, organizationSettings }: any = usePage().props || {};
  const mergedFlash = pageFlash || flash;
  
  // Get currency from accounting settings, default to CAD
  const currency = organizationSettings?.accounting?.accounting_currency || 'CAD';

  // Format price with currency and thousand separators
  const formatPrice = (p: string | number) => {
    const n = typeof p === 'string' ? Number(p) : p;
    if (Number.isNaN(n)) return String(p);
    
    // Format with thousand separators and 2 decimal places
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
    
    // Add currency symbol based on currency code
    const currencySymbols: Record<string, string> = {
      'CAD': 'CA$',
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'AUD': 'A$',
      'PKR': 'Rs',
    };
    
    const symbol = currencySymbols[currency] || currency;
    return `${symbol} ${formatted}`;
  };

  // Filter state
  const [search, setSearch] = useState(filters.search || '');
  const [perPage, setPerPage] = useState<number>(filters.perPage || 15);
  const [invoiceableType, setInvoiceableType] = useState(filters.invoiceable_type || '');
  const [status, setStatus] = useState(filters.status || '');
  const [dateType, setDateType] = useState(filters.date_type || 'created_at');
  const [dateFrom, setDateFrom] = useState(filters.date_from || '');
  const [dateTo, setDateTo] = useState(filters.date_to || '');

  // Transaction modals state
  const [showCreateTransactionModal, setShowCreateTransactionModal] = useState(false);
  const [showPayoutConfirmDialog, setShowPayoutConfirmDialog] = useState(false);
  const [showEmailConfirmDialog, setShowEmailConfirmDialog] = useState(false);
  const [invoiceToEmail, setInvoiceToEmail] = useState<Invoice | null>(null);
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('pos');
  const [providerRef, setProviderRef] = useState('');
  const [paymentProofUrl, setPaymentProofUrl] = useState('');
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  
  // Expandable rows state
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<number | null>(null);
  const [loadingTransactions, setLoadingTransactions] = useState(false);

  // Toasts
  useEffect(() => {
    if (mergedFlash?.success) toast.success(mergedFlash.success);
    if (mergedFlash?.error) toast.error(mergedFlash.error);
    
    // Show validation errors
    if (pageErrors?.error) {
      toast.error(pageErrors.error);
    }
  }, [mergedFlash, pageErrors]);

  const rows = useMemo(() => invoices.data, [invoices.data]);

  // Filter apply
  const handleSearch = () => {
    router.get(
      route('invoices.index'),
      {
        search,
        perPage,
        invoiceable_type: invoiceableType || '',
        status: status || '',
        date_type: dateType,
        date_from: dateFrom || '',
        date_to: dateTo || '',
      },
      { preserveState: true, preserveScroll: true }
    );
  };

  // Auto-apply filters when they change (except search which needs manual trigger)
  useEffect(() => {
    handleSearch();
  }, [invoiceableType, status, dateType, dateFrom, dateTo]);

  const handlePerPageChange = (value: number) => {
    setPerPage(value);
    router.get(
      route('invoices.index'),
      {
        search,
        perPage: value,
        invoiceable_type: invoiceableType || '',
        status: status || '',
        date_type: dateType,
        date_from: dateFrom || '',
        date_to: dateTo || '',
      },
      { preserveState: true, preserveScroll: true }
    );
  };

  // Export to PDF
  const handleExport = () => {
    const params = new URLSearchParams({
      search,
      invoiceable_type: invoiceableType || '',
      status: status || '',
      date_type: dateType,
      date_from: dateFrom || '',
      date_to: dateTo || '',
    });
    
    window.open(route('invoices.export') + '?' + params.toString(), '_blank');
  };

  const goTo = (url: string | null) => {
    if (!url) return;
    router.get(url, {}, { preserveScroll: true });
  };

  const toggleInvoiceExpansion = async (invoice: Invoice) => {
    // If clicking the same invoice, collapse it
    if (expandedInvoiceId === invoice.id) {
      setExpandedInvoiceId(null);
      setTransactions([]);
      return;
    }

    // Expand and load transactions
    setExpandedInvoiceId(invoice.id);
    setLoadingTransactions(true);
    
    try {
      const response = await axios.get(route('invoices.transactions', invoice.id));
      setTransactions(response.data.transactions || []);
    } catch (error) {
      toast.error('Failed to load transactions');
      setTransactions([]);
    } finally {
      setLoadingTransactions(false);
    }
  };

  const handleSendEmail = (invoice: Invoice) => {
    setInvoiceToEmail(invoice);
    setShowEmailConfirmDialog(true);
  };

  const confirmSendEmail = () => {
    if (!invoiceToEmail) return;
    
    router.post(route('invoices.send-email', invoiceToEmail.id), {}, {
      preserveScroll: true,
      onSuccess: () => {
        setShowEmailConfirmDialog(false);
        setInvoiceToEmail(null);
        toast.success('Invoice sent successfully!');
      },
      onError: (errors) => {
        console.error('Error sending invoice:', errors);
        toast.error(errors.message || 'Failed to send invoice via email');
      },
    });
  };

  const handleCreateTransaction = async (invoice: Invoice, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row expansion
    setCurrentInvoice(invoice);
    
    // Load transactions to calculate remaining amount
    try {
      const response = await axios.get(route('invoices.transactions', invoice.id));
      const txns = response.data.transactions || [];
      setTransactions(txns); // Store transactions for modal display
      
      // Calculate total paid
      const totalPaid = txns
        .filter((t: any) => t.type === 'invoice_payment' && t.status === 'completed')
        .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);
      
      const remaining = parseFloat(String(invoice.price)) - totalPaid;
      
      // Reset form fields and set remaining amount as default
      setPaymentMethod('pos');
      setProviderRef('');
      setPaymentProofUrl('');
      setPaymentAmount(remaining > 0 ? String(remaining.toFixed(4)) : '0');
      setShowCreateTransactionModal(true);
    } catch (error) {
      console.error('Error loading transactions:', error);
      toast.error('Failed to load transaction history');
      // Fallback to full amount if error
      setTransactions([]);
      setPaymentMethod('pos');
      setProviderRef('');
      setPaymentProofUrl('');
      setPaymentAmount(String(invoice.price));
      setShowCreateTransactionModal(true);
    }
  };

  const handleSubmitTransaction = () => {
    if (!currentInvoice) return;
    
    // Calculate remaining amount
    const totalPaid = transactions
      .filter((t: any) => t.type === 'invoice_payment' && t.status === 'completed')
      .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);
    const remaining = parseFloat(String(currentInvoice.price)) - totalPaid;
    
    // Validate payment amount
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid payment amount');
      return;
    }

    if (amount > remaining) {
      toast.error(`Payment amount cannot exceed remaining balance of $${remaining.toFixed(4)}`);
      return;
    }
    
    const transactionData: any = {
      payment_method: paymentMethod,
      amount: amount, // Include partial payment amount
    };

    // Add optional fields if provided
    if (providerRef.trim()) {
      transactionData.provider_ref = providerRef.trim();
    }

    if (paymentProofUrl.trim()) {
      transactionData.payment_proof_url = paymentProofUrl.trim();
    }
    
    router.post(route('invoices.create-transaction', currentInvoice.id), transactionData, {
      preserveState: false,
      onSuccess: () => {
        setShowCreateTransactionModal(false);
        setCurrentInvoice(null);
        setProviderRef('');
        setPaymentProofUrl('');
        toast.success('Transaction created successfully');
      },
      onError: () => {
        toast.error('Failed to create transaction');
      },
    });
  };

  const handleCreatePayout = (invoice: Invoice, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row expansion
    
    if (!invoice.has_payment_transaction) {
      toast.error('Invoice must be paid before creating a payout');
      return;
    }

    if (invoice.has_payout_transaction) {
      toast.error('Payout already exists for this invoice');
      return;
    }

    // Open confirmation dialog
    setCurrentInvoice(invoice);
    setShowPayoutConfirmDialog(true);
  };

  const confirmPayout = () => {
    if (!currentInvoice) return;

    router.post(route('invoices.create-payout', currentInvoice.id), {}, {
      preserveState: false,
      onSuccess: () => {
        setShowPayoutConfirmDialog(false);
        setCurrentInvoice(null);
        toast.success('Payout created successfully');
      },
      onError: (errors: any) => {
        setShowPayoutConfirmDialog(false);
        toast.error(errors.error || 'Failed to create payout');
      },
    });
  };

  return (
    <>

      {/* Page Header with Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-3 sm:px-6 pt-3 sm:pt-6 pb-3">
        <div>
          <PageHeader
            title="Invoices"
            description="View all invoices across your tenant"
          />
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={handleExport}
            variant="outline"
            className="flex items-center gap-2 h-10 sm:h-[44px]"
            title="Export filtered invoices to PDF"
          >
            <Receipt className="h-4 w-4" />
            Export PDF
          </Button>

          <Link href="/invoices/create">
            <Button className="bg-primary flex items-center gap-2 h-10 sm:h-[44px]">
              <Plus className="h-4 w-4" />
              Add Invoice
            </Button>
          </Link>

          <Link href="/ledger">
            <Button variant="outline" className="flex items-center gap-2 h-10 sm:h-[44px]">
              <BookOpen className="h-4 w-4" />
              Accounting Ledger
            </Button>
          </Link>

          <Link href="/invoices-archived">
            <Button variant="outline" className="flex items-center gap-2 h-10 sm:h-[44px]">
              View Archived
            </Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <Card className="shadow-none border-none m-3 sm:m-6">
        <CardContent className="space-y-4 p-3 sm:p-6">
          <FilterBar
            searchPlaceholder="Search by invoiceable name or ID..."
            filters={[
              {
                name: 'invoiceable_type',
                label: 'Type',
                type: 'select' as const,
                options: [
                  { label: 'All Types', value: '' },
                  ...invoiceableTypes.map((t) => ({ label: t.label, value: t.value })),
                ],
                value: invoiceableType,
                onChange: (v: string) => setInvoiceableType(v),
              },
              {
                name: 'status',
                label: 'Status',
                type: 'select' as const,
                options: [
                  { label: 'All Statuses', value: '' },
                  { label: 'Pending', value: 'pending' },
                  { label: 'Paid', value: 'paid' },
                  { label: 'Paid Manual', value: 'paid_manual' },
                  { label: 'Partial', value: 'partial' },
                  { label: 'Failed', value: 'failed' },
                  { label: 'Refunded', value: 'refunded' },
                ],
                value: status,
                onChange: (v: string) => setStatus(v),
              },
              {
                name: 'date_type',
                label: 'Date Filter By',
                type: 'select' as const,
                options: [
                  { label: 'Created Date', value: 'created_at' },
                  { label: 'Due Date', value: 'due_date' },
                ],
                value: dateType,
                onChange: (v: string) => setDateType(v),
              },
              { name: 'date_from', label: 'From Date', type: 'date' as const, value: dateFrom, onChange: setDateFrom },
              { name: 'date_to', label: 'To Date', type: 'date' as const, value: dateTo, onChange: setDateTo },
            ]}
            search={search}
            onSearchChange={setSearch}
            onSearch={handleSearch}
            perPage={perPage}
            onPerPageChange={handlePerPageChange}
          />

          {/* Table */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">All Invoices</h3>
                <div className="text-sm text-gray-500">
                  Showing {invoices.from} to {invoices.to} of {invoices.total} invoices
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="rounded-md border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[820px]">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-sm font-medium text-gray-900"></th>
                        <th className="px-6 py-3 text-left text-sm font-medium text-gray-900">Invoice #</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Invoiceable</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Type</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Price</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Payment Status</th>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Status</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-900">Actions</th>
                      </tr>
                    </thead>

                    <tbody className="bg-white divide-y divide-gray-200">
                      {rows.map((inv) => (
                        <>
                          <tr 
                            key={inv.id} 
                            className="hover:bg-gray-50 cursor-pointer transition-colors"
                            onClick={() => toggleInvoiceExpansion(inv)}
                          >
                            <td className="px-4 py-3 text-sm">
                              {expandedInvoiceId === inv.id ? (
                                <ChevronDown className="h-4 w-4 text-gray-500" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-gray-500" />
                              )}
                            </td>
                            <td className="px-6 py-3 text-sm font-semibold text-gray-900">
                              {inv.invoice_number || `#${inv.id}`}
                            </td>

                          <td className="px-4 py-3 text-sm">
                            <div className="truncate" title={`${inv.invoiceable_type}#${inv.invoiceable_id}`}>
                              {inv.invoiceable?.name ??
                                `${formatType(inv.invoiceable_type)} #${inv.invoiceable_id}`}
                            </div>
                          </td>

                          <td className="px-4 py-3 text-sm">{formatType(inv.invoiceable_type)}</td>

                          <td className="px-4 py-3 text-sm tabular-nums">{formatPrice(inv.price)}</td>

                          <td className="px-4 py-3">
                            <Badge
                              variant="secondary"
                              className={
                                inv.status === 'paid' || inv.status === 'paid_manual'
                                  ? 'bg-green-100 text-green-800 hover:bg-green-100'
                                  : inv.status === 'pending'
                                  ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100'
                                  : inv.status === 'partial'
                                  ? 'bg-blue-100 text-blue-800 hover:bg-blue-100'
                                  : 'bg-gray-100 text-gray-800 hover:bg-gray-100'
                              }
                            >
                              {formatStatus(inv.status || 'pending')}
                            </Badge>
                          </td>

                          <td className="px-4 py-3">
                            <Badge
                              variant={inv.deleted_at ? 'secondary' : 'default'}
                              className={
                                inv.deleted_at
                                  ? 'bg-gray-100 text-gray-800 hover:bg-gray-100'
                                  : 'bg-green-100 text-green-800 hover:bg-green-100'
                              }
                            >
                              <span
                                className={`w-2 h-2 rounded-full mr-2 inline-block ${
                                  inv.deleted_at ? 'bg-gray-400' : 'bg-green-600'
                                }`}
                              />
                              {inv.deleted_at ? 'Archived' : 'Active'}
                            </Badge>
                          </td>

                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {/* View Invoice Details Button */}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    router.visit(route('invoices.show', inv.id));
                                  }}
                                  title="View invoice details"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>

                                {/* Edit Invoice Button - only if no transactions */}
                                {!inv.has_transactions && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      router.visit(route('invoices.edit', inv.id));
                                    }}
                                    title="Edit invoice"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                )}

                                {/* Send Invoice via Email Button */}
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleSendEmail(inv);
                                  }}
                                  title="Send invoice via email"
                                >
                                  <Mail className="h-4 w-4" />
                                </Button>

                                {/* Create payment transaction button - shown if not fully paid */}
                                {(inv.status !== 'paid' && inv.status !== 'paid_manual') && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => handleCreateTransaction(inv, e)}
                                    title={inv.status === 'partial' ? 'Add partial payment' : 'Create payment transaction'}
                                  >
                                    <Receipt className="h-4 w-4" />
                                  </Button>
                                )}

                                {/* Create payout button - shown only for Appointments that are paid but don't have payout yet */}
                                {(inv.status === 'paid' || inv.status === 'paid_manual') && 
                                 !inv.has_payout_transaction && 
                                 inv.invoiceable_type_short === 'Appointment' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => handleCreatePayout(inv, e)}
                                    title="Create payout to practitioner (90% after 10% commission)"
                                  >
                                    <Wallet className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>

                          {/* Expanded Transaction Rows */}
                          {expandedInvoiceId === inv.id && (
                            <tr key={`${inv.id}-expanded`}>
                              <td colSpan={8} className="px-6 py-4 bg-gray-50">
                                {loadingTransactions ? (
                                  <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-6 w-6 animate-spin text-blue-600 mr-2" />
                                    <span className="text-gray-600">Loading transactions...</span>
                                  </div>
                                ) : transactions.length === 0 ? (
                                  <div className="text-center py-8 text-gray-500">
                                    No transactions found for this invoice.
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                      <Receipt className="h-4 w-4 text-blue-600" />
                                      Transactions for Invoice {inv.invoice_number || `#${inv.id}`}
                                    </h4>
                                    
                                    {/* Transaction Summary Card */}
                                    <div className="bg-white border border-blue-200 rounded-lg p-4 mb-4">
                                      <div className="grid grid-cols-4 gap-4 text-sm">
                                        <div>
                                          <span className="text-gray-600">Total Transactions:</span>
                                          <span className="ml-2 font-semibold text-gray-900">{transactions.length}</span>
                                        </div>
                                        <div>
                                          <span className="text-gray-600">Invoice Amount:</span>
                                          <span className="ml-2 font-semibold text-gray-900">${inv.price}</span>
                                        </div>
                                        <div>
                                          <span className="text-gray-600">Payment:</span>
                                          <Badge className="ml-2 bg-green-100 text-green-800 hover:bg-green-100">
                                            {transactions.find(t => t.type === 'invoice_payment') ? 'Paid' : 'Pending'}
                                          </Badge>
                                        </div>
                                        <div>
                                          <span className="text-gray-600">Payout:</span>
                                          <Badge className="ml-2 bg-purple-100 text-purple-800 hover:bg-purple-100">
                                            {transactions.find(t => t.type === 'payout') ? 'Paid' : 'Pending'}
                                          </Badge>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Transaction Table */}
                                    <div className="bg-white border rounded-lg overflow-hidden">
                                      <table className="w-full text-sm">
                                        <thead className="bg-gray-100 border-b">
                                          <tr>
                                            <th className="px-4 py-2 text-left font-medium text-gray-700">ID</th>
                                            <th className="px-4 py-2 text-left font-medium text-gray-700">Type</th>
                                            <th className="px-4 py-2 text-left font-medium text-gray-700">Amount</th>
                                            <th className="px-4 py-2 text-left font-medium text-gray-700">From</th>
                                            <th className="px-4 py-2 text-left font-medium text-gray-700">To</th>
                                            <th className="px-4 py-2 text-left font-medium text-gray-700">Method</th>
                                            <th className="px-4 py-2 text-left font-medium text-gray-700">Status</th>
                                            <th className="px-4 py-2 text-left font-medium text-gray-700">Date</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                          {transactions.map((transaction) => (
                                            <tr key={transaction.id} className="hover:bg-gray-50">
                                              <td className="px-4 py-3 font-mono text-xs">#{transaction.id}</td>
                                              <td className="px-4 py-3">
                                                <Badge variant="outline" className={
                                                  transaction.type === 'invoice_payment' 
                                                    ? 'border-green-300 bg-green-50 text-green-700'
                                                    : 'border-purple-300 bg-purple-50 text-purple-700'
                                                }>
                                                  {transaction.type.replace(/_/g, ' ')}
                                                </Badge>
                                              </td>
                                              <td className="px-4 py-3 font-semibold">${transaction.amount}</td>
                                              <td className="px-4 py-3 text-gray-600">
                                                {transaction.from_wallet 
                                                  ? `👤 ${transaction.from_wallet.type}`
                                                  : '💳 External'}
                                              </td>
                                              <td className="px-4 py-3 text-gray-600">
                                                {transaction.to_wallet 
                                                  ? (transaction.to_wallet.type === 'Clinic' 
                                                      ? '🏥 Clinic' 
                                                      : `👤 ${transaction.to_wallet.type}`)
                                                  : 'N/A'}
                                              </td>
                                              <td className="px-4 py-3">
                                                <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                                  {transaction.payment_method?.toUpperCase()}
                                                </span>
                                              </td>
                                              <td className="px-4 py-3">
                                                <Badge variant={transaction.status === 'completed' ? 'default' : 'secondary'}
                                                  className={transaction.status === 'completed' ? 'bg-green-100 text-green-800' : ''}>
                                                  {transaction.status}
                                                </Badge>
                                              </td>
                                              <td className="px-4 py-3 text-xs text-gray-500">
                                                {new Date(transaction.created_at).toLocaleDateString()}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </>
                      ))}

                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-6 py-10 text-center text-gray-500">
                            No invoices found
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pagination */}
              <div className="mt-4">
                <Pagination
                  currentPage={invoices.current_page}
                  lastPage={invoices.last_page}
                  total={invoices.total}
                  url="/invoices"
                />
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      {/* Payout Confirmation Dialog */}
      <Dialog open={showPayoutConfirmDialog} onOpenChange={setShowPayoutConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-purple-600" />
              Confirm Payout to Practitioner
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-2">
              <p>
                This will create a payout transaction to the primary practitioner for this invoice.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-700">Invoice Amount:</span>
                  <span className="font-semibold text-gray-900">${currentInvoice?.price}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">Clinic Commission (10%):</span>
                  <span className="font-semibold text-red-600">
                    -${currentInvoice?.price ? (parseFloat(String(currentInvoice.price)) * 0.1).toFixed(2) : '0.00'}
                  </span>
                </div>
                <div className="border-t border-blue-300 my-2"></div>
                <div className="flex justify-between">
                  <span className="text-gray-700 font-semibold">Practitioner Payout (90%):</span>
                  <span className="font-bold text-green-600">
                    ${currentInvoice?.price ? (parseFloat(String(currentInvoice.price)) * 0.9).toFixed(2) : '0.00'}
                  </span>
                </div>
              </div>
              <p className="text-amber-700 text-sm mt-3">
                ⚠️ This action cannot be undone. The payout will be transferred immediately.
              </p>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowPayoutConfirmDialog(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={confirmPayout} 
              className="bg-purple-600 hover:bg-purple-700"
            >
              Confirm Payout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Confirmation Dialog */}
      <ConfirmationDialog
        isOpen={showEmailConfirmDialog}
        onClose={() => {
          setShowEmailConfirmDialog(false);
          setInvoiceToEmail(null);
        }}
        onConfirm={confirmSendEmail}
        title="Send Invoice via Email"
        description={`Send invoice ${invoiceToEmail?.invoice_number || '#' + invoiceToEmail?.id} via email to the customer?`}
        confirmText="Send Email"
        cancelText="Cancel"
        variant="default"
        icon={<Mail className="h-6 w-6 text-blue-600" />}
      />

      {/* Create Transaction Sidebar */}
      <Sheet open={showCreateTransactionModal} onOpenChange={setShowCreateTransactionModal}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto px-6">
          <SheetHeader className="px-0">
            <SheetTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-green-600" />
              Create Transaction for Invoice #{currentInvoice?.id}
            </SheetTitle>
            <SheetDescription>
              Mark this invoice as paid by creating a transaction. Fill in the payment details below.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 mt-6 px-0">
            {/* Amount Display with Payment Progress */}
            <div className="bg-blue-50 p-4 rounded-md border border-blue-200 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-blue-900">Invoice Total:</span>
                <span className="text-lg font-bold text-blue-900">${currentInvoice?.price}</span>
              </div>
              {(() => {
                const totalPaid = transactions
                  .filter((t: any) => t.type === 'invoice_payment' && t.status === 'completed')
                  .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);
                const remaining = parseFloat(String(currentInvoice?.price || '0')) - totalPaid;
                
                if (totalPaid > 0) {
                  return (
                    <>
                      <div className="flex justify-between items-center text-sm border-t border-blue-200 pt-2">
                        <span className="text-blue-700">Already Paid:</span>
                        <span className="font-semibold text-blue-700">${totalPaid.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-blue-700">Remaining:</span>
                        <span className="font-bold text-blue-900">${remaining.toFixed(2)}</span>
                      </div>
                    </>
                  );
                }
                return null;
              })()}
            </div>

            {/* Payment Amount Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Amount <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0.0001"
                max={(() => {
                  const totalPaid = transactions
                    .filter((t: any) => t.type === 'invoice_payment' && t.status === 'completed')
                    .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);
                  return (parseFloat(String(currentInvoice?.price || '0')) - totalPaid).toFixed(4);
                })()}
                step="0.0001"
                value={paymentAmount}
                onChange={(e) => {
                  const totalPaid = transactions
                    .filter((t: any) => t.type === 'invoice_payment' && t.status === 'completed')
                    .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);
                  const remaining = parseFloat(String(currentInvoice?.price || '0')) - totalPaid;
                  const inputValue = parseFloat(e.target.value);
                  
                  // If user enters more than remaining, cap it at remaining
                  if (!isNaN(inputValue) && inputValue > remaining) {
                    setPaymentAmount(remaining.toFixed(4));
                  } else {
                    setPaymentAmount(e.target.value);
                  }
                }}
                onBlur={(e) => {
                  // On blur, ensure it's a valid number
                  const totalPaid = transactions
                    .filter((t: any) => t.type === 'invoice_payment' && t.status === 'completed')
                    .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);
                  const remaining = parseFloat(String(currentInvoice?.price || '0')) - totalPaid;
                  const inputValue = parseFloat(e.target.value);
                  
                  if (isNaN(inputValue) || inputValue <= 0) {
                    setPaymentAmount(remaining.toFixed(4));
                  } else if (inputValue > remaining) {
                    setPaymentAmount(remaining.toFixed(4));
                  }
                }}
                placeholder="Enter payment amount"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              
              {/* Real-time remaining amount feedback */}
              <div className="mt-2 space-y-1">
                <p className="text-xs text-gray-500">
                  {(() => {
                    const totalPaid = transactions
                      .filter((t: any) => t.type === 'invoice_payment' && t.status === 'completed')
                      .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);
                    const remaining = parseFloat(String(currentInvoice?.price || '0')) - totalPaid;
                    return totalPaid > 0 
                      ? `Maximum allowed: $${parseFloat(remaining.toFixed(4)).toFixed(2)}`
                      : `Maximum allowed: $${currentInvoice?.price}`;
                  })()}
                </p>
                
                {/* Real-time calculation */}
                {paymentAmount && parseFloat(paymentAmount) > 0 && (
                  <div className="p-2 bg-blue-50 rounded border border-blue-200">
                    <div className="flex justify-between text-xs">
                      <span className="text-blue-700">Amount Entering:</span>
                      <span className="font-semibold text-blue-900">${parseFloat(paymentAmount).toFixed(4)}</span>
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-blue-700">Remaining After:</span>
                      <span className="font-bold text-blue-900">
                        ${(() => {
                          const totalPaid = transactions
                            .filter((t: any) => t.type === 'invoice_payment' && t.status === 'completed')
                            .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);
                          const currentRemaining = parseFloat(String(currentInvoice?.price || '0')) - totalPaid;
                          const afterPayment = currentRemaining - parseFloat(paymentAmount);
                          return afterPayment.toFixed(4);
                        })()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Method <span className="text-red-500">*</span>
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="pos">POS Terminal</option>
                <option value="cash">Cash</option>
                <option value="gateway">Payment Gateway (Stripe, etc.)</option>
                <option value="manual">Manual Entry</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Select how the payment was received
              </p>
            </div>

            {/* Provider Reference */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Provider Reference {paymentMethod === 'gateway' && <span className="text-red-500">*</span>}
              </label>
              <input
                type="text"
                value={providerRef}
                onChange={(e) => setProviderRef(e.target.value)}
                placeholder={
                  paymentMethod === 'gateway' 
                    ? 'e.g., stripe_pi_1234567890' 
                    : paymentMethod === 'pos'
                    ? 'e.g., POS-RECEIPT-123456'
                    : 'Staff ID, Reference Number, etc.'
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                {paymentMethod === 'gateway' && 'Enter Stripe Payment Intent ID or similar'}
                {paymentMethod === 'pos' && 'Enter POS terminal receipt number or transaction ID'}
                {paymentMethod === 'cash' && 'Enter staff ID or reference who received payment'}
                {paymentMethod === 'manual' && 'Enter any reference or staff ID for this transaction'}
              </p>
            </div>

            {/* Payment Proof URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Proof / Receipt URL
              </label>
              <input
                type="url"
                value={paymentProofUrl}
                onChange={(e) => setPaymentProofUrl(e.target.value)}
                placeholder="https://example.com/receipt-image.jpg"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Optional: Upload receipt/proof image and paste the URL here
              </p>
            </div>

            {/* Transaction Info */}
            <div className="bg-gray-50 p-4 rounded-md border border-gray-200">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Transaction Details</h4>
              <div className="space-y-1 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>Type:</span>
                  <span className="font-medium">Invoice Payment</span>
                </div>
                <div className="flex justify-between">
                  <span>Direction:</span>
                  <span className="font-medium">
                    {paymentMethod === 'gateway' ? 'External Gateway' : 
                     paymentMethod === 'pos' ? 'External POS' : 
                     paymentMethod === 'cash' ? 'External Cash' : 'Manual Entry'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Destination:</span>
                  <span className="font-medium">Clinic Wallet</span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className="font-medium text-green-600">Completed</span>
                </div>
              </div>
            </div>
          </div>
          <SheetFooter className="mt-6 px-0">
            <Button 
              variant="outline" 
              onClick={() => setShowCreateTransactionModal(false)}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSubmitTransaction} 
              className="bg-green-600 hover:bg-green-700"
            >
              {(() => {
                const totalPaid = transactions
                  .filter((t: any) => t.type === 'invoice_payment' && t.status === 'completed')
                  .reduce((sum: number, t: any) => sum + parseFloat(t.amount), 0);
                const remaining = parseFloat(String(currentInvoice?.price || '0')) - totalPaid;
                const amount = parseFloat(paymentAmount);
                
                if (amount >= remaining) {
                  return 'Create Transaction & Mark as Paid';
                } else {
                  return 'Create Partial Payment';
                }
              })()}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

export default withAppLayout(InvoicesIndex, {
  breadcrumbs: [
    { title: 'Dashboard', href: route('dashboard') },
    { title: 'Invoices' }
  ]
});
