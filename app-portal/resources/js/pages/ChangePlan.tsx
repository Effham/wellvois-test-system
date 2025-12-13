import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Head, router } from '@inertiajs/react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CheckCircle2, LoaderCircle, Sparkles, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { imageAsset } from '@/utils/asset';

type Plan = {
    id: number;
    name: string;
    slug: string;
    price: number;
    formatted_price: string;
    billing_cycle: string;
    billing_interval: string;
    billing_interval_count: number;
    description: string;
    features: string[];
};

type ChangePlanProps = {
    from: 'register' | 'billing';
    plans: Plan[];
    currentPlan: Plan | null;
    tenantId?: string;
    preservedData?: {
        domain?: string;
        company_name?: string;
        admin_name?: string;
        admin_email?: string;
    };
};

export default function ChangePlan({ from, plans, currentPlan, tenantId, preservedData }: ChangePlanProps) {
    const [selectedPlanSlug, setSelectedPlanSlug] = useState<string | null>(currentPlan?.slug || null);
    const [billingCycle, setBillingCycle] = useState<'monthly' | 'annually'>(
        currentPlan?.billing_interval === 'year' ? 'annually' : 'monthly'
    );
    const [processingPlanId, setProcessingPlanId] = useState<number | null>(null);

    const handlePlanSelect = (planSlug: string, planId: number) => {
        // Don't allow selecting the current plan
        if (planSlug === currentPlan?.slug) {
            toast.info('This is already your current plan');
            return;
        }

        // Don't allow selecting if already processing
        if (processingPlanId !== null) {
            return;
        }

        setSelectedPlanSlug(planSlug);
        setProcessingPlanId(planId);

        // Immediately trigger plan change
        router.post(route('change-plan.update'), {
            from: from,
            plan_slug: planSlug,
            tenant_id: tenantId,
            preserved_data: preservedData,
        }, {
            onSuccess: () => {
                toast.success('Plan updated successfully!');
                // Redirect handled by backend
            },
            onError: (errors) => {
                setProcessingPlanId(null);
                setSelectedPlanSlug(currentPlan?.slug || null);
                const errorMessage = errors?.message || 'Failed to update plan. Please try again.';
                toast.error(errorMessage);
            },
        });
    };

    const filteredPlans = plans.filter(plan =>
        billingCycle === 'monthly'
            ? plan.billing_interval === 'month' && plan.billing_interval_count === 1
            : plan.billing_interval === 'year' && plan.billing_interval_count === 1
    );

    return (
        <div className="min-h-screen flex flex-col bg-gray-50">
            <Head title="Change Plan" />

            {/* Header with Logo */}
            <div className="flex-shrink-0 flex items-center justify-center p-3 sm:p-6">
                <img
                    src={`${imageAsset('/brand/images/mainLogo.png')}`}
                    alt="Logo"
                    className="h-7 w-auto"
                />
            </div>

            {/* Main Content Container */}
            <div className="flex-1 flex flex-col rounded-2xl sm:rounded-[32px] bg-gradient-to-br from-[#faf5ff] to-[#e0e7ff] mx-5 sm:mx-8 mb-3 sm:mb-6 overflow-hidden">
                {/* Left side - Content */}
                <div className="flex-1 flex items-center justify-center p-5 sm:p-6 xl:p-8">
                    <div className="w-full max-w-6xl">
                        {/* Welcome Section */}
                        <div className="mb-6 sm:mb-8 text-center">
                            <CardTitle className="mb-2 text-2xl sm:text-3xl xl:text-4xl font-bold text-gray-900">
                                Choose Your Perfect Plan
                            </CardTitle>
                            <CardDescription className="text-gray-600 text-sm sm:text-base">
                                Select the subscription plan that best fits your practice needs. You can change or cancel anytime.
                            </CardDescription>
                        </div>

                        {/* Form Container */}
                        <div className="bg-white rounded-xl sm:rounded-2xl shadow-sm px-5 sm:px-6 xl:px-8 py-6 sm:py-8">
                            <Card className="border-0 bg-transparent shadow-none">
                                <CardContent className="p-0">
                                    <div className="flex flex-col space-y-6">
                                        {/* Back Button - Compact */}
                                        <Button
                                            variant="ghost"
                                            onClick={() => {
                                                if (from === 'register') {
                                                    const queryParams: Record<string, string> = {};
                                                    if (preservedData) {
                                                        Object.entries(preservedData).forEach(([key, value]) => {
                                                            if (value) {
                                                                queryParams[key] = value;
                                                            }
                                                        });
                                                    }
                                                    if (currentPlan?.slug) {
                                                        queryParams.plan = currentPlan.slug;
                                                    }
                                                    router.visit(route('register'), {
                                                        data: queryParams,
                                                        preserveState: false,
                                                    });
                                                } else {
                                                    router.visit(route('billing.setup'));
                                                }
                                            }}
                                            className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 w-fit -mt-2 -ml-2"
                                        >
                                            <ArrowLeft className="mr-2 h-4 w-4" />
                                            Back
                                        </Button>

                                        {/* Billing Cycle Toggle */}
                                        <motion.div 
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            transition={{ duration: 0.3 }}
                                            className="flex justify-center"
                                        >
                                            <div className="inline-flex items-center gap-3 bg-gray-100 p-1 rounded-full">
                                                <button
                                                    type="button"
                                                    onClick={() => setBillingCycle('monthly')}
                                                    className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                                                        billingCycle === 'monthly'
                                                            ? 'bg-gradient-to-r from-[#A100FF] to-[#0500C9] text-white shadow-md'
                                                            : 'text-gray-700 hover:text-gray-900'
                                                    }`}
                                                >
                                                    Billed Monthly
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setBillingCycle('annually')}
                                                    className={`px-6 py-2 rounded-full text-sm font-medium transition-all ${
                                                        billingCycle === 'annually'
                                                            ? 'bg-gradient-to-r from-[#A100FF] to-[#0500C9] text-white shadow-md'
                                                            : 'text-gray-700 hover:text-gray-900'
                                                    }`}
                                                >
                                                    Billed Annually
                                                </button>
                                            </div>
                                        </motion.div>

                                        {/* Plans Grid */}
                                        {filteredPlans.length === 0 ? (
                                            <motion.div
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.3 }}
                                                className="text-center py-16 bg-gray-50 rounded-2xl border-2 border-gray-200"
                                            >
                                                <div className="max-w-md mx-auto">
                                                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                        </svg>
                                                    </div>
                                                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                                        No Plans Available
                                                    </h3>
                                                    <p className="text-gray-600">
                                                        There are no plans available for this billing cycle at the moment. Please check back later or try selecting a different billing cycle.
                                                    </p>
                                                </div>
                                            </motion.div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                                {filteredPlans.map((plan, index) => {
                                                    const isFeatured = plan.slug.includes('clinic') || plan.slug.includes('pro');
                                                    const isSelected = selectedPlanSlug === plan.slug;
                                                    const isCurrentPlan = currentPlan?.slug === plan.slug;

                                                    return (
                                                        <motion.div
                                                            key={plan.id}
                                                            initial={{ opacity: 0, y: 30 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ duration: 0.5, delay: index * 0.1 }}
                                                            whileHover={{ scale: 1.03, y: -5 }}
                                                            whileTap={{ scale: 0.98 }}
                                                            onClick={() => !isCurrentPlan && processingPlanId === null && handlePlanSelect(plan.slug, plan.id)}
                                                            className={`relative p-8 rounded-3xl transition-all duration-300 ${
                                                                processingPlanId === plan.id
                                                                    ? 'cursor-wait opacity-75'
                                                                    : isCurrentPlan
                                                                        ? 'cursor-not-allowed'
                                                                        : 'cursor-pointer'
                                                            } ${
                                                                isFeatured
                                                                    ? 'bg-gradient-to-br from-[#A100FF] via-purple-600 to-[#0500C9] text-white shadow-2xl ring-4 ring-purple-200'
                                                                    : isSelected
                                                                        ? 'bg-gradient-to-br from-purple-50 to-blue-50 border-3 border-purple-600 shadow-xl'
                                                                        : isCurrentPlan
                                                                            ? 'bg-white border-3 border-purple-400 shadow-lg'
                                                                            : 'bg-white border-2 border-gray-200 hover:border-purple-400 hover:shadow-xl'
                                                            }`}
                                                        >
                                                            {/* Badges */}
                                                            <div className="absolute top-4 right-4 flex flex-col gap-2">
                                                                {isCurrentPlan && (
                                                                    <motion.div
                                                                        initial={{ scale: 0 }}
                                                                        animate={{ scale: 1 }}
                                                                        className="bg-purple-600 text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-lg"
                                                                    >
                                                                        Current Plan
                                                                    </motion.div>
                                                                )}
                                                                {isFeatured && !isCurrentPlan && (
                                                                    <motion.div
                                                                        initial={{ scale: 0 }}
                                                                        animate={{ scale: 1 }}
                                                                        className="bg-yellow-400 text-yellow-900 text-xs font-bold px-3 py-1.5 rounded-full shadow-lg"
                                                                    >
                                                                        Popular
                                                                    </motion.div>
                                                                )}
                                                            </div>

                                                            {/* Plan Icon/Name */}
                                                            <div className="flex items-center gap-3 mb-6">
                                                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${
                                                                    isFeatured ? 'bg-white/20 backdrop-blur-sm' : 'bg-gradient-to-br from-purple-100 to-blue-100'
                                                                }`}>
                                                                    {isFeatured ? (
                                                                        <Crown className="w-7 h-7 text-white" />
                                                                    ) : (
                                                                        <svg className="w-7 h-7 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                                                        </svg>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <h3 className={`text-2xl font-bold ${isFeatured ? 'text-white' : 'text-gray-900'}`}>
                                                                        {plan.name}
                                                                    </h3>
                                                                    <p className={`text-sm mt-1 ${isFeatured ? 'text-white/80' : 'text-gray-500'}`}>
                                                                        {plan.description}
                                                                    </p>
                                                                </div>
                                                            </div>

                                                            {/* Price */}
                                                            <div className="mb-8 pb-6 border-b border-gray-200/50">
                                                                <div className="flex items-baseline gap-2">
                                                                    <span className={`text-5xl font-extrabold ${isFeatured ? 'text-white' : 'text-gray-900'}`}>
                                                                        {plan.formatted_price}
                                                                    </span>
                                                                    <span className={`text-xl font-medium ${isFeatured ? 'text-white/90' : 'text-gray-600'}`}>
                                                                        /{plan.billing_cycle.toLowerCase()}
                                                                    </span>
                                                                </div>
                                                            </div>

                                                            {/* Features */}
                                                            <ul className="space-y-4 mb-8">
                                                                {plan.features.map((feature, idx) => (
                                                                    <motion.li
                                                                        key={idx}
                                                                        initial={{ opacity: 0, x: -10 }}
                                                                        animate={{ opacity: 1, x: 0 }}
                                                                        transition={{ delay: index * 0.1 + idx * 0.05 }}
                                                                        className="flex items-start gap-3"
                                                                    >
                                                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                                                                            isFeatured ? 'bg-white/20' : 'bg-purple-100'
                                                                        }`}>
                                                                            <svg className={`w-4 h-4 ${isFeatured ? 'text-white' : 'text-purple-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                                            </svg>
                                                                        </div>
                                                                        <span className={`text-base leading-relaxed ${isFeatured ? 'text-white' : 'text-gray-700'}`}>
                                                                            {feature}
                                                                        </span>
                                                                    </motion.li>
                                                                ))}
                                                            </ul>

                                                            {/* Select Button */}
                                                            <Button
                                                                type="button"
                                                                onClick={() => !isCurrentPlan && processingPlanId === null && handlePlanSelect(plan.slug, plan.id)}
                                                                disabled={isCurrentPlan || processingPlanId !== null}
                                                                className={`w-full h-14 text-base font-semibold rounded-xl transition-all duration-200 ${
                                                                    isFeatured
                                                                        ? 'bg-white text-purple-600 hover:bg-gray-50 shadow-lg hover:shadow-xl'
                                                                        : processingPlanId === plan.id
                                                                            ? 'bg-gradient-to-r from-[#A100FF] to-[#0500C9] text-white shadow-lg'
                                                                            : isCurrentPlan
                                                                                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                                                                : 'bg-gray-100 text-gray-900 hover:bg-gray-200 hover:shadow-md'
                                                                }`}
                                                            >
                                                                {processingPlanId === plan.id ? (
                                                                    <>
                                                                        <LoaderCircle className="w-5 h-5 mr-2 animate-spin" />
                                                                        Updating...
                                                                    </>
                                                                ) : isCurrentPlan ? (
                                                                    <>
                                                                        <CheckCircle2 className="w-5 h-5 mr-2" />
                                                                        Current Plan
                                                                    </>
                                                                ) : (
                                                                    'Select Plan'
                                                                )}
                                                            </Button>

                                                        </motion.div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

