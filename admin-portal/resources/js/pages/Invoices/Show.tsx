import React from 'react';
import { withAppLayout } from '@/utils/layout';
import PageHeader from '@/components/general/PageHeader';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, Edit, Mail, Receipt, Wallet } from 'lucide-react';

type Invoice = {
  id: number;
  invoice_number?: string;
  price: string | number;
  subtotal?: string | number;
  tax_total?: string | number;
  due_date?: string | null;
  invoiceable_type: string;
  invoiceable_id: number;
  invoiceable?: { name?: string | null } | null;
  payment_method?: string | null;
  paid_at?: string | null;
  status?: string;
  has_transactions?: boolean;
  has_payment_transaction?: boolean;
  has_payout_transaction?: boolean;
  invoiceable_type_short?: string;
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

type Customer = {
  type: string;
  id: number;
  name: string;
  wallet_id: number;
} | null;

interface Props {
  invoice: Invoice;
  customer?: Customer;
}

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

function InvoiceShow({ invoice, customer }: Props) {
  const { organizationSettings }: any = usePage().props || {};
  
  // Get currency from accounting settings, default to CAD
  const currency = organizationSettings?.accounting?.accounting_currency || 'CAD';

  // Format price with currency and thousand separators
  const formatPrice = (p: string | number) => {
    const n = typeof p === 'string' ? Number(p) : p;
    if (Number.isNaN(n)) return String(p);
    
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
    
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

  const breadcrumbs = [
    { title: 'Dashboard', href: '/dashboard' },
    { title: 'Invoices', href: '/invoices' },
    { title: `Invoice #${invoice.invoice_number || invoice.id}`, href: '' },
  ];

  // Parse meta lines
  const getLines = () => {
    if (!invoice.meta) return [];
    
    let lines = null;
    if (typeof invoice.meta === 'string') {
      try {
        const parsed = JSON.parse(invoice.meta);
        lines = parsed.lines;
      } catch (e) {
        console.error('Failed to parse meta JSON:', e);
      }
    } else if (typeof invoice.meta === 'object') {
      lines = invoice.meta.lines;
    }
    
    return lines && Array.isArray(lines) ? lines : [];
  };

  const lines = getLines();

  return (
    <>
      <Head title={`Invoice #${invoice.invoice_number || invoice.id}`} />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-3 sm:px-6 pt-3 sm:pt-6 pb-3">
        <div className="flex items-center gap-4">
          <Link href="/invoices">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Invoices
            </Button>
          </Link>
          <PageHeader
            title={`Invoice #${invoice.invoice_number || invoice.id}`}
            description="Complete invoice details and line items"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          {!invoice.has_transactions && (
            <Link href={`/invoices/${invoice.id}/edit`}>
              <Button variant="outline" className="flex items-center gap-2">
                <Edit className="h-4 w-4" />
                Edit Invoice
              </Button>
            </Link>
          )}
          
          <Button
            variant="outline"
            className="flex items-center gap-2"
            onClick={() => {
              router.post(`/invoices/${invoice.id}/send-email`, {}, {
                preserveScroll: true,
              });
            }}
          >
            <Mail className="h-4 w-4" />
            Send via Email
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-3 sm:px-6 pb-6 space-y-6">
        {/* Invoice Summary Card */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Invoice Summary</h2>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-gray-500 mb-1">Invoice Number</p>
                <p className="text-lg font-semibold">{invoice.invoice_number || `#${invoice.id}`}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500 mb-1">Customer</p>
                <p className="text-lg font-medium">
                  {customer?.name || invoice.invoiceable?.name || 'N/A'}
                </p>
                {customer && (
                  <p className="text-xs text-gray-500 capitalize">{customer.type}</p>
                )}
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">Invoice Type</p>
                <p className="text-lg font-medium">{formatType(invoice.invoiceable_type)}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">Payment Status</p>
                <Badge
                  variant="secondary"
                  className={
                    invoice.status === 'paid' || invoice.status === 'paid_manual'
                      ? 'bg-green-100 text-green-800 hover:bg-green-100'
                      : invoice.status === 'pending'
                      ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100'
                      : invoice.status === 'partial'
                      ? 'bg-blue-100 text-blue-800 hover:bg-blue-100'
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-100'
                  }
                >
                  {formatStatus(invoice.status || 'pending')}
                </Badge>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">Payment Method</p>
                <p className="text-lg font-medium">{invoice.payment_method || 'N/A'}</p>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">Created At</p>
                <p className="text-lg font-medium">
                  {invoice.created_at ? new Date(invoice.created_at).toLocaleDateString() : 'N/A'}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">Due Date</p>
                <p className="text-lg font-medium">
                  {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : 'N/A'}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-1">Status</p>
                <Badge
                  variant={invoice.deleted_at ? 'secondary' : 'default'}
                  className={
                    invoice.deleted_at
                      ? 'bg-gray-100 text-gray-800 hover:bg-gray-100'
                      : 'bg-green-100 text-green-800 hover:bg-green-100'
                  }
                >
                  <span
                    className={`w-2 h-2 rounded-full mr-2 inline-block ${
                      invoice.deleted_at ? 'bg-gray-400' : 'bg-green-600'
                    }`}
                  />
                  {invoice.deleted_at ? 'Archived' : 'Active'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Line Items Card */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Items</h2>
          </CardHeader>
          <CardContent>
            {lines.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px]">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Description
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Quantity
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Unit Price
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tax Rate
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Tax Amount
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Line Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {lines.map((line: any, idx: number) => {
                        const unitPrice = parseFloat(line.unit_price || 0);
                        const qty = line.qty || 1;
                        const taxAmount = parseFloat(line.tax_amount || 0);
                        const lineSubtotal = parseFloat(line.line_subtotal || 0);
                        const lineTotal = lineSubtotal + taxAmount;

                        return (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-6 py-4 text-sm text-gray-900">
                              {line.desc || 'N/A'}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900 text-right">
                              {qty}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900 text-right">
                              {formatPrice(unitPrice)}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900 text-right">
                              {line.tax_rate || 0}%
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900 text-right">
                              {formatPrice(taxAmount)}
                            </td>
                            <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">
                              {formatPrice(lineTotal)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Receipt className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p>No line items available for this invoice</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Totals Card */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Invoice Totals</h2>
          </CardHeader>
          <CardContent>
            <div className="flex justify-end">
              <div className="w-full max-w-md space-y-3">
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="text-lg font-medium">
                    {formatPrice(invoice.subtotal || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-gray-600">Tax Total:</span>
                  <span className="text-lg font-medium">
                    {formatPrice(invoice.tax_total || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-3 bg-gray-50 px-4 rounded-lg">
                  <span className="text-xl font-bold">Total Amount:</span>
                  <span className="text-2xl font-bold text-primary">
                    {formatPrice(invoice.price)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Transaction Status Card */}
        {(invoice.has_payment_transaction || invoice.has_payout_transaction) && (
          <Card>
            <CardHeader>
              <h2 className="text-xl font-semibold">Transaction Status</h2>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex items-center gap-4 p-4 border rounded-lg">
                  <Receipt className={`h-8 w-8 ${invoice.has_payment_transaction ? 'text-green-600' : 'text-gray-400'}`} />
                  <div>
                    <p className="font-medium">Payment Transaction</p>
                    <p className="text-sm text-gray-500">
                      {invoice.has_payment_transaction ? 'Payment received' : 'No payment yet'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 border rounded-lg">
                  <Wallet className={`h-8 w-8 ${invoice.has_payout_transaction ? 'text-purple-600' : 'text-gray-400'}`} />
                  <div>
                    <p className="font-medium">Payout Transaction</p>
                    <p className="text-sm text-gray-500">
                      {invoice.has_payout_transaction ? 'Payout completed' : 'No payout yet'}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}

export default withAppLayout(InvoiceShow, {
  breadcrumbs: [
    { title: 'Dashboard', href: route('dashboard') },
    { title: 'Invoices', href: route('invoices.index') },
    { title: 'Invoice Details' }
  ]
});

