import React, { useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { withAppLayout } from '@/utils/layout';
import { type BreadcrumbItem } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
    Wallet,
    TrendingUp,
    TrendingDown,
    ArrowUpRight,
    ArrowDownLeft,
    Calendar,
    User,
    CreditCard,
    DollarSign,
    Filter,
    Download,
    Eye,
    Clock,
    CheckCircle,
    AlertCircle,
    Banknote,
    PiggyBank,
    Activity,
    Receipt,
    FileText,
    Loader2
} from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Wallet',
        href: '/wallet',
    },
];

interface Transaction {
    id: string;
    type: 'credit' | 'debit';
    amount: number;
    description: string;
    appointment_id: string | null;
    patient_name: string | null;
    service: string;
    date: string;
    status: 'completed' | 'pending' | 'failed';
    payment_method: string;
}

interface PendingInvoice {
    invoice_id: number;
    invoice_number: string;
    remaining_amount: number;
    total_invoiced: number;
}

interface WalletData {
    balance: {
        current: number;
        pending: number;
        total_earned: number;
    };
    transactions: Transaction[];
    statistics: {
        total_appointments: number;
        revenue_this_month: number;
        revenue_last_month: number;
        average_per_appointment: number;
    };
    // Practitioner-specific fields
    total_balance?: number; // Practitioner wallet balance
    remaining_amount?: number; // Total remaining across all invoices
    generatable_amount?: number; // Available for new invoice
    pending_invoices?: PendingInvoice[];
    // Admin-specific fields
    admin_view?: boolean; // Flag to indicate admin view
    clinic_total_balance?: number; // System wallet balance
    clinic_to_pay?: number; // Sum of unpaid practitioner invoices
    clinic_yet_to_receive?: number; // Sum of unpaid system invoices
}

interface WalletPageProps {
    wallet: WalletData;
}

function WalletIndex({ wallet }: WalletPageProps) {
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterType, setFilterType] = useState<string>('all');
    const [sortBy, setSortBy] = useState<string>('date');
    const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
    const [invoiceMode, setInvoiceMode] = useState<'full' | 'partial'>('full');
    const [customAmount, setCustomAmount] = useState<string>('');

    // Filter and sort transactions
    const filteredTransactions = wallet.transactions
        .filter(transaction => {
            if (filterStatus !== 'all' && transaction.status !== filterStatus) return false;
            if (filterType !== 'all' && transaction.type !== filterType) return false;
            return true;
        })
        .sort((a, b) => {
            if (sortBy === 'date') {
                return new Date(b.date).getTime() - new Date(a.date).getTime();
            } else if (sortBy === 'amount') {
                return b.amount - a.amount;
            }
            return 0;
        });

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(amount);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed':
                return <CheckCircle className="h-4 w-4 text-green-500" />;
            case 'pending':
                return <Clock className="h-4 w-4 text-yellow-500" />;
            case 'failed':
                return <AlertCircle className="h-4 w-4 text-red-500" />;
            default:
                return <Clock className="h-4 w-4 text-gray-500" />;
        }
    };

    const getStatusBadgeVariant = (status: string) => {
        switch (status) {
            case 'completed':
                return 'default';
            case 'pending':
                return 'secondary';
            case 'failed':
                return 'destructive';
            default:
                return 'outline';
        }
    };

    const calculateRevenueChange = () => {
        const current = wallet.statistics.revenue_this_month;
        const previous = wallet.statistics.revenue_last_month;
        const change = ((current - previous) / previous) * 100;
        return {
            percentage: Math.abs(change),
            isPositive: change > 0,
        };
    };

    const revenueChange = calculateRevenueChange();

    const handleGenerateInvoice = () => {
        const generatableAmount = wallet.generatable_amount || 0;
        
        if (generatableAmount <= 0) {
            toast.error('No amount available for invoicing');
            return;
        }

        // Validate partial invoice
        if (invoiceMode === 'partial') {
            const amount = parseFloat(customAmount);
            if (isNaN(amount) || amount <= 0) {
                toast.error('Please enter a valid invoice amount');
                return;
            }
            if (amount > generatableAmount) {
                toast.error(`Amount cannot exceed available amount of ${formatCurrency(generatableAmount)}`);
                return;
            }
        }

        setIsGeneratingInvoice(true);

        const data: any = {};
        if (invoiceMode === 'partial') {
            data.amount = parseFloat(customAmount);
        }

        router.post('/wallet/generate-invoice', data, {
            preserveState: false,
            onSuccess: () => {
                setIsGeneratingInvoice(false);
                setCustomAmount('');
                setInvoiceMode('full');
                toast.success('Invoice generated successfully!');
            },
            onError: (errors) => {
                setIsGeneratingInvoice(false);
                toast.error(errors.message || 'Failed to generate invoice');
            }
        });
    };

    return (
        <>
            <Head title="Wallet" />
            <div className="flex h-full flex-1 flex-col gap-4 sm:gap-6 rounded-xl p-3 sm:p-6">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Wallet</h1>
                        <p className="text-sm sm:text-base text-muted-foreground">
                            {wallet.admin_view
                                ? 'Clinic financial overview and pending transactions'
                                : 'Manage your earnings and view transaction history'}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {/* <Button variant="outline" size="sm">
                            <Download className="h-4 w-4 mr-2" />
                            Export
                        </Button>
                        <Button size="sm">
                            <Eye className="h-4 w-4 mr-2" />
                            View Statement
                        </Button> */}
                    </div>
                </div>

                {/* Practitioner-specific Balance Cards */}
                {wallet.total_balance !== undefined && (
                    <>
                        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
                            <Card className="border-l-4 border-l-blue-500">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
                                    <Wallet className="h-4 w-4 text-blue-600" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-blue-600">
                                        {formatCurrency(wallet.total_balance || 0)}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Current wallet balance
                                    </p>
                                </CardContent>
                            </Card>

                            <Card className="border-l-4 border-l-orange-500">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Remaining Amount</CardTitle>
                                    <Clock className="h-4 w-4 text-orange-600" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-orange-600">
                                        {formatCurrency(wallet.remaining_amount || 0)}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Unpaid invoice amounts
                                    </p>
                                </CardContent>
                            </Card>

                            <Card className="border-l-4 border-l-green-500">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Generatable Invoice Amount</CardTitle>
                                    <FileText className="h-4 w-4 text-green-600" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold text-green-600">
                                        {formatCurrency(wallet.generatable_amount || 0)}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Available for new invoice
                                    </p>
                                    {/* Invoice mode toggle */}
                                    {(wallet.generatable_amount || 0) > 0 && (
                                        <div className="mt-3 grid gap-2">
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    type="button"
                                                    variant={invoiceMode === 'full' ? 'default' : 'outline'}
                                                    size="sm"
                                                    onClick={() => setInvoiceMode('full')}
                                                >
                                                    Full
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant={invoiceMode === 'partial' ? 'default' : 'outline'}
                                                    size="sm"
                                                    onClick={() => setInvoiceMode('partial')}
                                                >
                                                    Partial
                                                </Button>
                                            </div>
                                            {invoiceMode === 'partial' && (
                                                <div className="grid gap-2">
                                                    <input
                                                        type="number"
                                                        min={0}
                                                        step="0.01"
                                                        value={customAmount}
                                                        onChange={(e) => setCustomAmount(e.target.value)}
                                                        placeholder="Enter amount"
                                                        className="w-full rounded-md border px-3 py-2 text-sm"
                                                    />
                                                    <span className="text-[11px] text-muted-foreground">
                                                        Max {formatCurrency(wallet.generatable_amount || 0)}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                    {(wallet.generatable_amount || 0) > 0 && (
                                        <Button 
                                            onClick={handleGenerateInvoice}
                                            disabled={isGeneratingInvoice}
                                            className="mt-3 w-full"
                                            size="sm"
                                        >
                                            {isGeneratingInvoice ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                    Generating...
                                                </>
                                            ) : (
                                                <>
                                                    <Receipt className="h-4 w-4 mr-2" />
                                                    {invoiceMode === 'partial' ? 'Generate Partial Invoice' : 'Generate Invoice'}
                                                </>
                                            )}
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Pending Invoices Table */}
                        {wallet.pending_invoices && wallet.pending_invoices.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Pending Invoices</CardTitle>
                                    <CardDescription>
                                        Invoices awaiting payment from clinic
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="overflow-x-auto">
                                        <table className="w-full">
                                            <thead>
                                                <tr className="border-b">
                                                    <th className="text-left p-3 font-medium">Invoice Number</th>
                                                    <th className="text-right p-3 font-medium">Remaining Amount</th>
                                                    <th className="text-right p-3 font-medium">Total Invoiced</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {wallet.pending_invoices.map((invoice) => (
                                                    <tr key={invoice.invoice_id} className="border-b">
                                                        <td className="p-3 font-medium">{invoice.invoice_number}</td>
                                                        <td className="p-3 text-right text-orange-600 font-semibold">
                                                            {formatCurrency(invoice.remaining_amount)}
                                                        </td>
                                                        <td className="p-3 text-right text-muted-foreground">
                                                            {formatCurrency(invoice.total_invoiced)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </>
                )}

                {/* Admin Balance Cards (for non-practitioners) */}
                {wallet.total_balance === undefined && wallet.admin_view && (
                    <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
                        <Card className="border-l-4 border-l-green-500">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
                                <PiggyBank className="h-4 w-4 text-green-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">
                                    {formatCurrency(wallet.clinic_total_balance || 0)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    System wallet balance
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border-l-4 border-l-red-500">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">To Pay Practitioners</CardTitle>
                                <ArrowDownLeft className="h-4 w-4 text-red-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-red-600">
                                    {formatCurrency(wallet.clinic_to_pay || 0)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Outstanding practitioner invoices
                                </p>
                            </CardContent>
                        </Card>

                        <Card className="border-l-4 border-l-blue-500">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Yet to Receive</CardTitle>
                                <ArrowUpRight className="h-4 w-4 text-blue-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-blue-600">
                                    {formatCurrency(wallet.clinic_yet_to_receive || 0)}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Pending patient invoices
                                </p>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Statistics Cards */}
                {/* <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Appointments</CardTitle>
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">{wallet.statistics.total_appointments}</div>
                            <p className="text-xs text-muted-foreground">
                                Completed appointments
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Avg Per Appointment</CardTitle>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {formatCurrency(wallet.statistics.average_per_appointment)}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Average earning per session
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Last Month</CardTitle>
                            <Banknote className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">
                                {formatCurrency(wallet.statistics.revenue_last_month)}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Previous month earnings
                            </p>
                        </CardContent>
                    </Card>
                </div> */}


                {/* Transaction History */}
                {/* <Card>
                    <CardHeader>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <CardTitle className="text-base sm:text-lg">Transaction History</CardTitle>
                                <CardDescription className="text-xs sm:text-sm">
                                    View all your earnings and deductions
                                </CardDescription>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Select value={filterStatus} onValueChange={setFilterStatus}>
                                    <SelectTrigger className="w-full sm:w-32">
                                        <SelectValue placeholder="Status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Status</SelectItem>
                                        <SelectItem value="completed">Completed</SelectItem>
                                        <SelectItem value="pending">Pending</SelectItem>
                                        <SelectItem value="failed">Failed</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select value={filterType} onValueChange={setFilterType}>
                                    <SelectTrigger className="w-full sm:w-32">
                                        <SelectValue placeholder="Type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Types</SelectItem>
                                        <SelectItem value="credit">Credit</SelectItem>
                                        <SelectItem value="debit">Debit</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Select value={sortBy} onValueChange={setSortBy}>
                                    <SelectTrigger className="w-full sm:w-32">
                                        <SelectValue placeholder="Sort by" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="date">Date</SelectItem>
                                        <SelectItem value="amount">Amount</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <AnimatePresence>
                                {filteredTransactions.map((transaction, index) => (
                                    <motion.div
                                        key={transaction.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -20 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors gap-3"
                                    >
                                        <div className="flex items-start sm:items-center space-x-3 sm:space-x-4 flex-1 min-w-0">
                                            <div className={`p-2 rounded-full flex-shrink-0 ${
                                                transaction.type === 'credit' 
                                                    ? 'bg-green-100 dark:bg-green-900' 
                                                    : 'bg-red-100 dark:bg-red-900'
                                            }`}>
                                                {transaction.type === 'credit' ? (
                                                    <ArrowUpRight className="h-4 w-4 text-green-600 dark:text-green-400" />
                                                ) : (
                                                    <ArrowDownLeft className="h-4 w-4 text-red-600 dark:text-red-400" />
                                                )}
                                            </div>
                                            <div className="space-y-1 min-w-0 flex-1">
                                                <p className="font-medium text-sm truncate">{transaction.description}</p>
                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                                    {transaction.patient_name && (
                                                        <>
                                                            <div className="flex items-center space-x-1">
                                                                <User className="h-3 w-3" />
                                                                <span className="truncate max-w-[100px] sm:max-w-none">{transaction.patient_name}</span>
                                                            </div>
                                                            <Separator orientation="vertical" className="h-3 hidden sm:block" />
                                                        </>
                                                    )}
                                                    <div className="flex items-center space-x-1">
                                                        <Calendar className="h-3 w-3" />
                                                        <span>{formatDate(transaction.date)}</span>
                                                    </div>
                                                    <Separator orientation="vertical" className="h-3 hidden sm:block" />
                                                    <div className="flex items-center space-x-1">
                                                        <CreditCard className="h-3 w-3" />
                                                        <span className="truncate">{transaction.payment_method}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between sm:justify-end space-x-3 flex-shrink-0">
                                            <div className="text-right">
                                                <p className={`font-semibold text-sm sm:text-base ${
                                                    transaction.type === 'credit' 
                                                        ? 'text-green-600 dark:text-green-400' 
                                                        : 'text-red-600 dark:text-red-400'
                                                }`}>
                                                    {transaction.type === 'credit' ? '+' : '-'}
                                                    {formatCurrency(transaction.amount)}
                                                </p>
                                                <div className="flex items-center justify-end space-x-1 mt-1">
                                                    {getStatusIcon(transaction.status)}
                                                    <Badge variant={getStatusBadgeVariant(transaction.status)} className="text-xs">
                                                        {transaction.status}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                        {filteredTransactions.length === 0 && (
                            <div className="text-center py-8">
                                <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                <p className="text-muted-foreground">No transactions found matching your filters</p>
                            </div>
                        )}
                    </CardContent>
                </Card> */}
            </div>
        </>
    );
}

export default withAppLayout(WalletIndex, {
    breadcrumbs: [
        { title: 'Dashboard', href: route('dashboard') },
        { title: 'Wallet' }
    ]
});
