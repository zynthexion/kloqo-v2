"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Lock, ArrowUpRight, Minus, Plus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePricingCalculator } from "@/components/pricing/usePricingCalculator";
import { apiRequest } from "@/lib/api-client";

interface UpgradePlanModalProps {
  open: boolean;
  onClose: () => void;
  clinicDetails: any;
}

export function UpgradePlanModal({ open, onClose, clinicDetails }: UpgradePlanModalProps) {
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  const [addedSeats, setAddedSeats] = useState(1);
  const [hardwareChoice, setHardwareChoice] = useState<'byot' | 'emi' | 'upfront'>('byot');

  const currentNumDoctors = clinicDetails?.numDoctors || 1;
  const newTotalDoctors = currentNumDoctors + addedSeats;

  const parseNextBillingDate = (dateObj: any) => {
    if (!dateObj) return null;
    if (typeof dateObj === 'string' || typeof dateObj === 'number') return new Date(dateObj);
    if (dateObj._seconds) return new Date(dateObj._seconds * 1000); // Firestore timestamp shape often passed raw
    if (dateObj.seconds) return new Date(dateObj.seconds * 1000);
    return new Date(dateObj);
  };

  const today = new Date();
  const nextBillingDate = parseNextBillingDate(clinicDetails?.subscriptionDetails?.nextBillingDate);
  let daysRemainingInCycle = 15; // default fallback
  if (nextBillingDate && !isNaN(nextBillingDate.getTime())) {
    daysRemainingInCycle = Math.max(1, Math.ceil((nextBillingDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  }

  const parsedTrialEndDate = clinicDetails?.trialEndDate ? parseNextBillingDate(clinicDetails.trialEndDate) : null;
  const isTrialByDate = parsedTrialEndDate ? today < parsedTrialEndDate : false;
  const isTrialByFlag = clinicDetails?.subscriptionDetails?.isTrialPeriod === true;
  const isCurrentlyInTrial = isTrialByDate || isTrialByFlag;

  console.log("=== PRICING DEBUG ===");
  console.log("Full Clinic Details (keys):", Object.keys(clinicDetails || {}));
  console.log("Raw trialEndDate:", clinicDetails?.trialEndDate);
  console.log("isTrialPeriod flag:", clinicDetails?.subscriptionDetails?.isTrialPeriod);
  console.log("isTrialByDate:", isTrialByDate);
  console.log("isTrialByFlag:", isTrialByFlag);
  console.log("isCurrentlyInTrial (FINAL):", isCurrentlyInTrial);
  console.log("=====================");

  const calculations = usePricingCalculator({
    clinicType: clinicDetails?.type || 'Clinic',
    plan: clinicDetails?.plan || 'The Complete Suite',
    numDoctors: newTotalDoctors,
    billingCycle: clinicDetails?.billingCycle || 'monthly',
    hardwareChoice,
    hardwareDeployment: hardwareChoice === 'byot' ? 'delayed' : 'immediate',
    isUpgradeFlow: true,
    isTrialActive: isCurrentlyInTrial,
    currentPlanStr: clinicDetails?.plan,
    currentNumDoctors,
    daysRemainingInCycle
  });

  const handleUpgrade = async () => {
    setIsProcessing(true);
    const dueToday = calculations.oneTimeDueToday;

    try {
      let paymentDetails: any = { amount: 0 }; // Free upgrades if in trial or byot

      if (dueToday > 0) {
        // Create Order
        const orderResponse = await apiRequest('/payments/create-order', {
          method: 'POST',
          body: JSON.stringify({ amount: dueToday, receipt: `upg_${Date.now()}` }),
        });
        const order = (await orderResponse) as any;

        // Open Razorpay
        paymentDetails = await new Promise((resolve, reject) => {
          const options = {
            key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_placeholder',
            amount: order.amount,
            currency: order.currency,
            name: 'Kloqo',
            description: 'Seat Upgrade Fee',
            order_id: order.id,
            handler: function (response: any) {
              resolve({
                paymentId: response.razorpay_payment_id,
                orderId: response.razorpay_order_id,
                signature: response.razorpay_signature,
                amount: dueToday
              });
            },
            prefill: {
                name: clinicDetails?.name,
                email: clinicDetails?.ownerEmail,
            },
            theme: { color: '#4f46e5' },
            modal: { ondismiss: () => reject(new Error('Payment cancelled by user.')) }
          };
          const rzp = new (window as any).Razorpay(options);
          rzp.open();
        });
      }

      // Verify and update settings
      await apiRequest('/billing/verify-upgrade', {
        method: 'POST',
        body: JSON.stringify({
          paymentDetails,
          newSettings: {
            numDoctors: newTotalDoctors,
            hardwareChoice,
            addedSeats,
            plan: clinicDetails?.plan,
            newMonthly: calculations.recurringMonthlyDisplay
          }
        }),
      });

      toast({
        title: "Upgrade Successful!",
        description: "Your new seats have been added to your account instantly.",
      });
      onClose();
      // Optionally trigger reload to fetch new limits
      window.location.reload(); 
    } catch (error: any) {
      if (error.message !== 'Payment cancelled by user.') {
        toast({
          variant: "destructive",
          title: "Upgrade Failed",
          description: error.message || "An unexpected error occurred during the upgrade process.",
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl border-0 shadow-2xl">
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-500/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-purple-500/10 rounded-full translate-y-1/2 -translate-x-1/2" />
          <div className="relative">
            <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 mb-4">
              <Lock className="h-3 w-3 mr-1" />
              Upgrade Seats
            </Badge>
            <DialogHeader>
              <DialogTitle className="text-2xl font-black text-white tracking-tight leading-none">
                Add More Consultants
              </DialogTitle>
              <DialogDescription className="text-slate-400 mt-2 text-sm">
                You currently have <span className="text-white font-bold">{currentNumDoctors}</span> seats on the <span className="text-indigo-300 font-bold">{clinicDetails?.plan || 'Kloqo'}</span> plan.
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        <div className="p-6 bg-slate-50 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Seat Counter */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Additional Seats</p>
              <p className="text-sm font-medium text-slate-700">How many do you need?</p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8 rounded-full" 
                onClick={() => setAddedSeats(Math.max(1, addedSeats - 1))}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-6 text-center font-black text-xl text-slate-800">{addedSeats}</span>
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8 rounded-full"
                onClick={() => setAddedSeats(addedSeats + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Hardware Options (if Applicable) */}
          {(clinicDetails?.type === 'Pharmacy' || clinicDetails?.plan === 'The Complete Suite') && (
            <div className="space-y-3">
               <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Device Options</p>
               <div className="grid grid-cols-3 gap-2">
                 <button 
                  onClick={() => setHardwareChoice('byot')}
                  className={`p-3 rounded-xl border text-center transition-all ${hardwareChoice === 'byot' ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500 flex flex-col items-center shadow-inner' : 'bg-white hover:bg-slate-50 flex flex-col items-center'}`}
                 >
                   <span className="block text-xs font-bold text-slate-900 leading-tight">BYOD</span>
                   <span className="block text-[10px] text-slate-500 mt-1">₹0 Setup</span>
                 </button>
                 <button 
                  onClick={() => setHardwareChoice('emi')}
                  className={`p-3 rounded-xl border text-center transition-all ${hardwareChoice === 'emi' ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500 flex flex-col items-center shadow-inner' : 'bg-white hover:bg-slate-50 flex flex-col items-center'}`}
                 >
                   <span className="block text-xs font-bold text-slate-900 leading-tight">HaaS EMI</span>
                   <span className="block text-[10px] text-slate-500 mt-1">₹2,083/mo</span>
                 </button>
                 <button 
                  onClick={() => setHardwareChoice('upfront')}
                  className={`p-3 rounded-xl border text-center transition-all ${hardwareChoice === 'upfront' ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-500 flex flex-col items-center shadow-inner' : 'bg-white hover:bg-slate-50 flex flex-col items-center'}`}
                 >
                   <span className="block text-xs font-bold text-slate-900 leading-tight">Tablet</span>
                   <span className="block text-[10px] text-slate-500 mt-1">₹24k Upfront</span>
                 </button>
               </div>
            </div>
          )}

          {/* Summary Box */}
          <div className="bg-slate-900 text-white p-5 rounded-xl border border-slate-700 shadow-md">
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Upgrade Checkout</h4>
            
            <div className="space-y-2 mb-4">
              <div className="flex justify-between items-center text-sm">
                <span className="text-slate-300">Prorated Software ({daysRemainingInCycle} days)</span>
                <span className="font-medium">₹{Math.round(calculations.proratedSoftwareAmount).toLocaleString()}</span>
              </div>
              
              {hardwareChoice !== 'byot' ? (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-300">Hardware Setup ({addedSeats}x)</span>
                  <span className="font-medium">
                    {hardwareChoice === 'upfront' ? `₹${Math.round(calculations.hardwareUpfrontTotal).toLocaleString()}` : 'First EMI (₹' + (2083 * addedSeats).toLocaleString() + ')' }
                  </span>
                </div>
              ) : (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400 italic text-[11px]">Hardware decision deferred for 30 days</span>
                  <span className="text-emerald-400 font-bold text-xs uppercase">₹0 Setup</span>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-700 flex justify-between items-end">
              <div>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Total Due Today</p>
                <p className="text-2xl font-black text-emerald-400">₹{Math.round(calculations.oneTimeDueToday).toLocaleString()}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">New Monthly Bill</p>
                <p className="text-sm font-bold text-indigo-300">₹{Math.round(calculations.recurringMonthlyDisplay).toLocaleString()}/mo</p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-white border-t border-slate-100 flex flex-col gap-2">
          <Button
            onClick={handleUpgrade}
            disabled={isProcessing}
            className="w-full h-12 font-black text-sm bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {isProcessing ? <Loader2 className="h-5 w-5 animate-spin" /> : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Confirm Payment & Upgrade
                <ArrowUpRight className="h-4 w-4 ml-2" />
              </>
            )}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={isProcessing} className="w-full text-slate-400 text-xs font-semibold">
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
