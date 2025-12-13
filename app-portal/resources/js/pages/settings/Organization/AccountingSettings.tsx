import React, { useEffect } from 'react';
import { useForm, usePage } from '@inertiajs/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';

interface Props {
    accountingSettings: Record<string, string>;
}

export default function AccountingSettings({ accountingSettings }: Props) {
    const { flash }: any = usePage().props;
    const { data, setData, post, processing, errors } = useForm({
        accounting_invoice_prefix: accountingSettings?.accounting_invoice_prefix || 'INV',
        accounting_currency: accountingSettings?.accounting_currency || 'CAD',
        accounting_tax_enabled: accountingSettings?.accounting_tax_enabled === '1' ? '1' : '0',
        accounting_tax_rate: accountingSettings?.accounting_tax_rate || '13.00',
        accounting_tax_name: accountingSettings?.accounting_tax_name || 'GST',
    });

    useEffect(() => {
        if (flash?.success) toast.success(flash.success);
        if (flash?.error) toast.error(flash.error);
    }, [flash]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        post(route('organization.accounting-settings.update'), {
            preserveScroll: true,
        });
    };

    const handleTaxEnabledChange = (checked: boolean) => {
        setData('accounting_tax_enabled', checked ? '1' : '0');
        if (!checked) {
            setData('accounting_tax_rate', '0.00');
            setData('accounting_tax_name', '');
        } else {
            // Reset to default if re-enabled and currently 0
            if (parseFloat(String(data.accounting_tax_rate)) === 0) {
                setData('accounting_tax_rate', '13.00');
            }
            if (!data.accounting_tax_name) {
                setData('accounting_tax_name', 'GST');
            }
        }
    };

    return (
        <Card className="shadow-none border-none">
            <CardHeader>
                <CardTitle>Accounting </CardTitle>
                <CardDescription>
                    Configure invoice prefixes, currency, and tax settings for your organization
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Invoice Prefix */}
                    <div className="space-y-2">
                        <Label htmlFor="invoice_prefix" className="font-normal">
                            Invoice Prefix
                            <span className="text-xs text-gray-500 ml-2">
                                (e.g., INV, MC, Invoice)
                            </span>
                        </Label>
                        <Input
                            id="invoice_prefix"
                            type="text"
                            value={data.accounting_invoice_prefix}
                            onChange={(e) => setData('accounting_invoice_prefix', e.target.value)}
                            placeholder="INV"
                            maxLength={10}
                            className="text-muted-foreground"
                        />
                        {errors.accounting_invoice_prefix && (
                            <p className="text-sm text-red-600">{errors.accounting_invoice_prefix}</p>
                        )}
                        <p className="text-xs text-gray-500">
                            Invoices will be numbered as: {data.accounting_invoice_prefix}-001, {data.accounting_invoice_prefix}-002, etc.
                        </p>
                    </div>

                    {/* Currency */}
                    <div className="space-y-2">
                        <Label htmlFor="currency" className="font-normal">Currency</Label>
                        <select
                            id="currency"
                            value={data.accounting_currency}
                            onChange={(e) => setData('accounting_currency', e.target.value)}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                            <option value="CAD">CAD - Canadian Dollar</option>
                            <option value="USD">USD - US Dollar</option>
                            <option value="EUR">EUR - Euro</option>
                            <option value="GBP">GBP - British Pound</option>
                            <option value="AUD">AUD - Australian Dollar</option>
                            <option value="PKR">PKR - Pakistani Rupee</option>
                        </select>
                        {errors.accounting_currency && (
                            <p className="text-sm text-red-600">{errors.accounting_currency}</p>
                        )}
                    </div>

                    {/* Tax Enabled */}
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="tax_enabled" className="font-normal">Enable Tax</Label>
                            <p className="text-sm text-gray-500">
                                Apply tax to all invoices and transactions
                            </p>
                        </div>
                        <Switch
                            id="tax_enabled"
                            checked={data.accounting_tax_enabled === '1'}
                            onCheckedChange={handleTaxEnabledChange}
                        />
                    </div>

                    {/* Tax Details (shown only if tax is enabled) */}
                    {data.accounting_tax_enabled === '1' && (
                        <div className="space-y-4 pl-4 border-l-2 border-gray-200">
                            {/* Tax Name */}
                            <div className="space-y-2">
                                <Label htmlFor="tax_name" className="font-normal">Tax Name</Label>
                                <Input
                                    id="tax_name"
                                    type="text"
                                    value={data.accounting_tax_name}
                                    onChange={(e) => setData('accounting_tax_name', e.target.value)}
                                    placeholder="GST, HST, VAT, etc."
                                    className="text-muted-foreground"
                                />
                                {errors.accounting_tax_name && (
                                    <p className="text-sm text-red-600">{errors.accounting_tax_name}</p>
                                )}
                            </div>

                            {/* Tax Rate */}
                            <div className="space-y-2">
                                <Label htmlFor="tax_rate" className="font-normal">Tax Rate (%)</Label>
                                <Input
                                    id="tax_rate"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="100"
                                    value={data.accounting_tax_rate}
                                    onChange={(e) => setData('accounting_tax_rate', e.target.value)}
                                    placeholder="13.00"
                                    className="text-muted-foreground"
                                />
                                {errors.accounting_tax_rate && (
                                    <p className="text-sm text-red-600">{errors.accounting_tax_rate}</p>
                                )}
                                <p className="text-xs text-gray-500">
                                    Enter the tax percentage (e.g., 13 for 13% GST)
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Submit Button */}
                    <div className="flex justify-end pt-4">
                        <Button type="submit" disabled={processing}>
                            {processing ? 'Saving...' : 'Save Settings'}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
