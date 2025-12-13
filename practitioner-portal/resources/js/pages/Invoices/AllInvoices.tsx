import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { ChevronRight, Trash2, Archive, Receipt, Eye } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { router, usePage } from '@inertiajs/react';
import { toast } from 'sonner';
import axios from 'axios';

type Invoiceable = {
  // shape depends on your polymorphic target; keep loose
  id?: number | string;
  name?: string;
  // ...other fields you may send
};

export interface Invoice {
  id: number;
  price: string | number;         // decimal(64,4) – may arrive as string
  invoiceable_type: string;       // e.g. 'order' (morph map) or 'App\\Models\\Order'
  invoiceable_id: number;
  invoiceable?: Invoiceable | null;
  payment_method?: string | null;
  paid_at?: string | null;
  status?: string;                // pending, paid, paid_manual, failed, refunded
  has_transactions?: boolean;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string | null;
}

interface AllInvoicesProps {
  invoices: Invoice[];
  onAddInvoice: () => void;
  onEditInvoice: (invoice: Invoice) => void;
  flash?: {
    success?: string;
    error?: string;
  };
  // optional: pass current filters to keep query string consistent
  filters?: {
    invoiceable_type?: string | null;
    invoiceable_id?: number | null;
  };
}

export default function AllInvoices({
  invoices,
  onAddInvoice,
  onEditInvoice,
}: AllInvoicesProps) {
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [invoiceToArchive, setInvoiceToArchive] = useState<Invoice | null>(null);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showCreateTransactionModal, setShowCreateTransactionModal] = useState(false);
  const [currentInvoice, setCurrentInvoice] = useState<Invoice | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('pos');
  const { flash } = usePage().props as { flash?: { success?: string; error?: string } };

  // flash -> toast
  useEffect(() => {
    if (flash?.success) toast.success(flash.success);
    if (flash?.error) toast.error(flash.error);
  }, [flash]);

  const handleArchiveInvoice = () => {
    if (invoiceToArchive) {
      router.delete(route('invoices.destroy', invoiceToArchive.id), {
        preserveState: false,
        onSuccess: () => {
          setShowArchiveModal(false);
          setInvoiceToArchive(null);
        },
      });
    }
  };

  const handleViewTransactions = async (invoice: Invoice) => {
    setCurrentInvoice(invoice);
    try {
      const response = await axios.get(route('invoices.transactions', invoice.id));
      setTransactions(response.data.transactions || []);
      setShowTransactionModal(true);
    } catch (error) {
      toast.error('Failed to load transactions');
    }
  };

  const handleCreateTransaction = (invoice: Invoice) => {
    setCurrentInvoice(invoice);
    setShowCreateTransactionModal(true);
  };

  const handleSubmitTransaction = () => {
    if (!currentInvoice) return;
    
    router.post(route('invoices.create-transaction', currentInvoice.id), {
      payment_method: paymentMethod,
    }, {
      preserveState: false,
      onSuccess: () => {
        setShowCreateTransactionModal(false);
        setCurrentInvoice(null);
        toast.success('Transaction created successfully');
      },
      onError: () => {
        toast.error('Failed to create transaction');
      },
    });
  };

  const formatType = (val: string) => {
    // if using morph map alias like 'order', pretty-print it; otherwise strip namespaces
    const base = val.includes('\\') ? val.split('\\').pop() ?? val : val;
    return base.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
      .replace(/^\w/, c => c.toUpperCase());
  };

  const formatPrice = (p: string | number) => {
    const n = typeof p === 'string' ? Number(p) : p;
    if (Number.isNaN(n)) return String(p);
    return n.toFixed(4); // match decimal:4
  };

  const hasRows = useMemo(() => invoices.length > 0, [invoices]);

  return (
    <div className="p-2 sm:p-4">
      <div className="bg-white rounded-lg w-full">
        <div className="px-3 sm:px-6 py-3 sm:py-4">
          <div className="space-y-4 sm:space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-shrink-0">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight">All Invoices</h2>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                <Button
                  onClick={() => router.get('/invoices-archived')}
                  variant="outline"
                  className="h-10 sm:h-[44px] text-sm bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                >
                  <Archive className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">View Archived</span>
                </Button>
                <Button
                  onClick={onAddInvoice}
                  variant="outline"
                  className="h-10 sm:h-[44px] text-sm bg-white text-sidebar-accent border-sidebar-accent hover:bg-sidebar-accent/10"
                >
                  <span>Add Invoice</span>
                </Button>
              </div>
            </div>

            {/* Invoices Table */}
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px]">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="px-6 py-3 text-left text-sm font-medium text-gray-700 min-w-[120px]">
                        Invoice #
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 min-w-[180px]">
                        Invoiceable
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 min-w-[140px]">
                        Type
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 min-w-[160px]">
                        Price
                      </th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 min-w-[140px]">
                        Status
                      </th>
                      <th className="px-6 py-3 text-right text-sm font-medium text-gray-700 w-[120px]">
                        Actions
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-200">
                    {invoices.map((invoice) => (
                      <tr key={invoice.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 text-sm font-medium text-gray-900">
                          #{invoice.id}
                        </td>

                        <td className="px-4 py-4 text-sm text-gray-900">
                          <div className="truncate" title={`${invoice.invoiceable_type}#${invoice.invoiceable_id}`}>
                            {invoice.invoiceable?.name ?? `${formatType(invoice.invoiceable_type)} #${invoice.invoiceable_id}`}
                          </div>
                        </td>

                        <td className="px-4 py-4 text-sm text-gray-900">
                          {formatType(invoice.invoiceable_type)}
                        </td>

                        <td className="px-4 py-4 text-sm text-gray-900 tabular-nums">
                          {formatPrice(invoice.price)}
                        </td>

                        <td className="px-4 py-4">
                          <Badge
                            variant={invoice.deleted_at ? 'secondary' : 'default'}
                            className={
                              invoice.deleted_at
                                ? 'bg-gray-100 text-gray-800 hover:bg-gray-100'
                                : 'bg-green-100 text-green-800 hover:bg-green-100'
                            }
                          >
                            <div
                              className={`w-2 h-2 rounded-full mr-2 ${
                                invoice.deleted_at ? 'bg-gray-400' : 'bg-green-600'
                              }`}
                            />
                            {invoice.status ?? (invoice.deleted_at ? 'Archived' : 'Active')}
                          </Badge>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {invoice.has_transactions ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleViewTransactions(invoice)}
                                className="text-blue-400 hover:text-blue-600"
                                title="View transactions"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleCreateTransaction(invoice)}
                                className="text-green-400 hover:text-green-600"
                                title="Create transaction"
                              >
                                <Receipt className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onEditInvoice(invoice)}
                              className="text-gray-400 hover:text-gray-600"
                              title="Edit invoice"
                            >
                              <ChevronRight className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setInvoiceToArchive(invoice);
                                setShowArchiveModal(true);
                              }}
                              title="Archive invoice"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Empty State */}
              {!hasRows && (
                <div className="px-6 py-8 text-center">
                  <div className="text-gray-500 mb-4">
                    <div className="mx-auto w-12 h-12 mb-3">
                      <svg
                        className="w-full h-full text-gray-300"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1}
                          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1}
                          d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                      </svg>
                    </div>
                    <h3 className="text-base font-medium text-gray-900 mb-2">No invoices found</h3>
                    <p className="text-sm text-gray-500">
                      Get started by adding your first invoice using the button above.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* (Optional) Summary cards */}
            {hasRows && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Example: uncomment if you want quick stats */}
                {/* <div className="bg-white p-4 rounded-lg border">
                  <div className="text-sm font-medium text-gray-500">Total Invoices</div>
                  <div className="text-2xl font-bold text-gray-900">{invoices.length}</div>
                </div>
                <div className="bg-white p-4 rounded-lg border">
                  <div className="text-sm font-medium text-gray-500">Total Value</div>
                  <div className="text-2xl font-bold text-purple-700 tabular-nums">
                    {invoices.reduce((sum, inv) => sum + Number(inv.price || 0), 0).toFixed(4)}
                  </div>
                </div>
                <div className="bg-white p-4 rounded-lg border">
                  <div className="text-sm font-medium text-gray-500">Active</div>
                  <div className="text-2xl font-bold text-green-600">
                    {invoices.filter((i) => !i.deleted_at).length}
                  </div>
                </div> */}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Archive Confirmation Modal */}
      <Dialog open={showArchiveModal} onOpenChange={setShowArchiveModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-orange-600" />
              Archive Invoice
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to archive invoice #{invoiceToArchive?.id}? You can restore it later from the Archived view.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowArchiveModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleArchiveInvoice} className="bg-orange-600 hover:bg-orange-700">
              Archive Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Transactions Modal */}
      <Dialog open={showTransactionModal} onOpenChange={setShowTransactionModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-blue-600" />
              Transactions for Invoice #{currentInvoice?.id}
            </DialogTitle>
            <DialogDescription>
              View all transactions associated with this invoice.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No transactions found for this invoice.
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">ID</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Amount</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Type</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Method</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Status</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-700">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td className="px-4 py-2 text-sm">#{transaction.id}</td>
                      <td className="px-4 py-2 text-sm">${transaction.amount}</td>
                      <td className="px-4 py-2 text-sm">{transaction.type}</td>
                      <td className="px-4 py-2 text-sm">{transaction.payment_method}</td>
                      <td className="px-4 py-2">
                        <Badge variant={transaction.status === 'completed' ? 'default' : 'secondary'}>
                          {transaction.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-sm">{new Date(transaction.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTransactionModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Transaction Modal */}
      <Dialog open={showCreateTransactionModal} onOpenChange={setShowCreateTransactionModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-green-600" />
              Create Transaction for Invoice #{currentInvoice?.id}
            </DialogTitle>
            <DialogDescription>
              Mark this invoice as paid by creating a transaction.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="pos">POS Terminal</option>
                <option value="cash">Cash</option>
                <option value="gateway">Payment Gateway</option>
                <option value="manual">Manual Entry</option>
              </select>
            </div>
            <div className="bg-blue-50 p-3 rounded-md">
              <p className="text-sm text-blue-800">
                Amount: ${currentInvoice?.price}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateTransactionModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmitTransaction} className="bg-green-600 hover:bg-green-700">
              Create Transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
