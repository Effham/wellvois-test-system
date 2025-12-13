import { useEffect, useMemo, useState } from 'react';
import { withAppLayout } from '@/utils/layout';
import PageHeader from '@/components/general/PageHeader';
import Pagination from '@/components/general/Pagination';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Head, router, usePage } from '@inertiajs/react';
import { toast } from 'sonner';
import { BookOpen, TrendingUp, TrendingDown, DollarSign, Filter, ArrowRightLeft } from 'lucide-react';

type Wallet = {
  id: number;
  type: 'clinic' | 'user';
  user_id?: number | null;
};

type Transaction = {
  id: number;
  invoice_id?: number | null;
  amount: string;
  type: string;
  direction_source: string;
  payment_method: string;
  provider_ref?: string | null;
  status: string;
  from_wallet?: Wallet | null;
  to_wallet?: Wallet | null;
  created_at: string;
};

type WalletInfo = {
  id: number;
  type: string;
  balance: string;
  user_id?: number | null;
  user_name?: string | null;
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
  transactions: Paginator<Transaction>;
  wallets: WalletInfo[];
  allWallets: { id: number; label: string }[];
  filters: {
    type?: string;
    status?: string;
    wallet_id?: string;
    date_from?: string;
    date_to?: string;
    perPage?: number;
  };
  summary: {
    clinic_balance: string;
    total_incoming: string;
    total_outgoing: string;
    total_commission: string;
    net_position: string;
  };
  transactionTypes: { label: string; value: string }[];
  flash?: { success?: string; error?: string };
}

const breadcrumbs = [
  { title: 'Dashboard', href: '/dashboard' },
  { title: 'Accounting Ledger', href: '' },
];

function LedgerIndex({ 
  transactions, 
  wallets, 
  allWallets,
  filters, 
  summary, 
  transactionTypes,
  flash 
}: Props) {
  const { flash: pageFlash, organizationSettings }: any = usePage().props || {};
  const mergedFlash = pageFlash || flash;
  
  // Get currency from accounting settings, default to CAD
  const currency = organizationSettings?.accounting?.accounting_currency || 'CAD';

  // Filter state
  const [type, setType] = useState(filters.type || '');
  const [status, setStatus] = useState(filters.status || '');
  const [walletId, setWalletId] = useState(filters.wallet_id || '');
  const [dateFrom, setDateFrom] = useState(filters.date_from || '');
  const [dateTo, setDateTo] = useState(filters.date_to || '');
  const [perPage, setPerPage] = useState<number>(filters.perPage || 50);

  // Toasts
  useEffect(() => {
    if (mergedFlash?.success) toast.success(mergedFlash.success);
    if (mergedFlash?.error) toast.error(mergedFlash.error);
  }, [mergedFlash]);

  const rows = useMemo(() => transactions.data, [transactions.data]);

  const handleSearch = () => {
    router.get(
      route('ledger.index'),
      {
        type: type || '',
        status: status || '',
        wallet_id: walletId || '',
        date_from: dateFrom || '',
        date_to: dateTo || '',
        perPage,
      },
      { preserveState: true, preserveScroll: true }
    );
  };

  const handleReset = () => {
    setType('');
    setStatus('');
    setWalletId('');
    setDateFrom('');
    setDateTo('');
    setPerPage(50);
    router.get(route('ledger.index'), { perPage: 50 });
  };

  const goTo = (url: string | null) => {
    if (!url) return;
    router.get(url, {}, { preserveScroll: true });
  };

  const getWalletLabel = (wallet: Wallet | null | undefined): string => {
    if (!wallet) return 'External';
    if (wallet.type === 'clinic') return 'Clinic';
    const walletInfo = wallets.find(w => w.id === wallet.id);
    return walletInfo?.user_name || `User Wallet #${wallet.id}`;
  };

  // Format amount with currency and thousand separators
  const formatAmount = (amount: string | number): string => {
    const n = typeof amount === 'string' ? Number(amount) : amount;
    if (Number.isNaN(n)) return String(amount);
    
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

  // Calculate if transaction is balanced (has both from and to)
  const isBalanced = (tx: Transaction): boolean => {
    return !!(tx.from_wallet || !tx.from_wallet) && !!tx.to_wallet;
  };

  return (
    <>
      <Head title="Accounting Ledger" />

      {/* Page Header */}
      <div className="px-3 sm:px-6 pt-3 sm:pt-6">
        <PageHeader
          title="Accounting Ledger"
          description="Double-entry bookkeeping view of all transactions. Every debit has a corresponding credit."
          actions={
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                <BookOpen className="h-3 w-3 mr-1" />
                Double-Entry System
              </Badge>
            </div>
          }
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 p-3 sm:p-6">
        {/* Clinic Balance */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Clinic Balance</p>
                <p className="text-2xl font-bold text-gray-900">{formatAmount(summary.clinic_balance)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        {/* Total Incoming */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Incoming</p>
                <p className="text-2xl font-bold text-green-600">{formatAmount(summary.total_incoming)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        {/* Total Outgoing */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Outgoing</p>
                <p className="text-2xl font-bold text-red-600">{formatAmount(summary.total_outgoing)}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        {/* Total Commission */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Commission</p>
                <p className="text-2xl font-bold text-purple-600">{formatAmount(summary.total_commission)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        {/* Net Position */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Net Position</p>
                <p className={`text-2xl font-bold ${parseFloat(summary.net_position) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatAmount(summary.net_position)}
                </p>
              </div>
              <ArrowRightLeft className="h-8 w-8 text-gray-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="shadow-none border-none m-3 sm:m-6">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-600" />
            <h3 className="text-lg font-medium">Filters</h3>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {/* Transaction Type */}
            <div>
              <Label htmlFor="type">Transaction Type</Label>
              <Select value={type || 'all'} onValueChange={(v) => setType(v === 'all' ? '' : v)}>
                <SelectTrigger id="type">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {transactionTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div>
              <Label htmlFor="status">Status</Label>
              <Select value={status || 'all'} onValueChange={(v) => setStatus(v === 'all' ? '' : v)}>
                <SelectTrigger id="status">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Wallet Filter */}
            <div>
              <Label htmlFor="wallet_id">Wallet</Label>
              <Select value={walletId || 'all'} onValueChange={(v) => setWalletId(v === 'all' ? '' : v)}>
                <SelectTrigger id="wallet_id">
                  <SelectValue placeholder="All Wallets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Wallets</SelectItem>
                  {allWallets.map((w) => (
                    <SelectItem key={w.id} value={String(w.id)}>
                      {w.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date From */}
            <div>
              <Label htmlFor="date_from">From Date</Label>
              <Input
                id="date_from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            {/* Date To */}
            <div>
              <Label htmlFor="date_to">To Date</Label>
              <Input
                id="date_to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            {/* Per Page */}
            <div>
              <Label htmlFor="perPage">Per Page</Label>
              <Select value={String(perPage)} onValueChange={(v) => setPerPage(parseInt(v))}>
                <SelectTrigger id="perPage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                  <SelectItem value="200">200</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSearch} className="bg-primary">
              Apply Filters
            </Button>
            <Button onClick={handleReset} variant="outline">
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Ledger Table */}
      <Card className="m-3 sm:m-6">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Transaction Ledger</h3>
            <div className="text-sm text-gray-500">
              Showing {transactions.from} to {transactions.to} of {transactions.total} transactions
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px]">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">ID</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Invoice</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">From (Credit)</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">To (Debit)</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-900">Amount</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Method</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-900">Status</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-900">Balanced</th>
                  </tr>
                </thead>

                <tbody className="bg-white divide-y divide-gray-200">
                  {rows.map((tx) => (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-mono">#{tx.id}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <Badge 
                          variant="outline" 
                          className={
                            tx.type === 'invoice_payment'
                              ? 'border-green-300 bg-green-50 text-green-700'
                              : tx.type === 'payout'
                              ? 'border-purple-300 bg-purple-50 text-purple-700'
                              : 'border-blue-300 bg-blue-50 text-blue-700'
                          }
                        >
                          {tx.type.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {tx.invoice_id ? (
                          <span className="text-blue-600 font-mono">#{tx.invoice_id}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          {tx.from_wallet ? (
                            tx.from_wallet.type === 'clinic' ? (
                              <span className="text-blue-600 font-medium">🏥 Clinic</span>
                            ) : (
                              <span className="text-gray-600">👤 {getWalletLabel(tx.from_wallet)}</span>
                            )
                          ) : (
                            <span className="text-green-600 font-medium">💳 External Payment</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          {tx.to_wallet ? (
                            tx.to_wallet.type === 'clinic' ? (
                              <span className="text-blue-600 font-medium">🏥 Clinic</span>
                            ) : (
                              <span className="text-gray-600">👤 {getWalletLabel(tx.to_wallet)}</span>
                            )
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-bold tabular-nums">
                        {formatAmount(tx.amount)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {tx.payment_method?.toUpperCase() || 'N/A'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={tx.status === 'completed' ? 'default' : 'secondary'}
                          className={
                            tx.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : tx.status === 'failed'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }
                        >
                          {tx.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isBalanced(tx) ? (
                          <span className="text-green-600 font-bold">✓</span>
                        ) : (
                          <span className="text-red-600 font-bold">✗</span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-6 py-10 text-center text-gray-500">
                        No transactions found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {transactions.total > 0 && (
            <div className="mt-6">
              <Pagination
                from={transactions.from}
                to={transactions.to}
                total={transactions.total}
                links={transactions.links || []}
                onNavigate={goTo}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Accounting Notes */}
      <Card className="m-3 sm:m-6 bg-blue-50 border-blue-200">
        <CardHeader>
          <h3 className="text-lg font-medium text-blue-900 flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Accounting Notes
          </h3>
        </CardHeader>
        <CardContent className="text-sm text-blue-800 space-y-2">
          <p>• <strong>External Payments</strong>: When "From" is "External Payment", this represents customer payments coming into the system (null from_wallet_id).</p>
          <p>• <strong>Balanced Transactions</strong>: The ✓ symbol indicates the transaction has proper double-entry (both from and to are recorded).</p>
          <p>• <strong>Commission Tracking</strong>: The 10% clinic commission is the difference between invoice payments and practitioner payouts.</p>
          <p>• <strong>Net Position</strong>: Total Incoming - Total Outgoing = Current Clinic Balance (if all transactions are completed).</p>
        </CardContent>
      </Card>
    </>
  );
}

export default withAppLayout(LedgerIndex, {
  breadcrumbs: [
    { title: 'Dashboard', href: route('dashboard') },
    { title: 'Accounting Ledger' }
  ]
});

