'use client';

import { useEffect, useMemo } from 'react';
import { useFormContext } from 'react-hook-form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import type { SignUpFormData } from '@/app/(public)/signup/page';
import { usePricingCalculator } from '@/components/pricing/usePricingCalculator';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '../ui/form';
import { Check, X, CreditCard, Sparkles, MonitorSmartphone, TabletSmartphone } from 'lucide-react';

export function Step5Pricing() {
  const { control, watch, setValue } = useFormContext<SignUpFormData>();
  
  const clinicType = watch('clinicType');
  const numDoctors = watch('numDoctors') || 1;
  const billingCycle = watch('billingCycle') || 'monthly';
  const plan = watch('plan');
  const hardwareChoice = watch('hardwareChoice') || 'byot';
  const hardwareDeployment = watch('hardwareDeployment') || 'delayed';
  const extraRooms = Math.max(0, numDoctors - 1);

  // Auto-select pharmacy plan if identity is pharmacy
  useEffect(() => {
    if (clinicType === 'Pharmacy' && plan !== 'Pharmacy Monopoly') {
      setValue('plan', 'Pharmacy Monopoly');
    } else if (clinicType === 'Clinic' && plan === 'Pharmacy Monopoly') {
      setValue('plan', 'The Complete Suite');
    }
  }, [clinicType, plan, setValue]);

  // Restrict hardware options to "The Complete Suite" for Clinics
  useEffect(() => {
    if (clinicType === 'Clinic' && plan !== 'The Complete Suite') {
      setValue('hardwareChoice', 'byot');
      setValue('hardwareDeployment', 'delayed');
    }
  }, [clinicType, plan, setValue]);

  // Set default hardware/deployment if none chosen
  useEffect(() => {
    if (!watch('hardwareChoice')) {
      setValue('hardwareChoice', 'byot');
    }
    if (!watch('hardwareDeployment')) {
      setValue('hardwareDeployment', 'delayed');
    }
  }, [watch, setValue]);

  const calculations = usePricingCalculator({
    clinicType,
    plan,
    numDoctors,
    billingCycle,
    hardwareChoice,
    hardwareDeployment
  });

  useEffect(() => {
    setValue('calculatedMonthlyTotal', calculations.recurringMonthlyDisplay);
    setValue('calculatedOneTimeTotal', calculations.oneTimeDueToday);
    setValue('plannedUpfrontTotal', calculations.totalDueIn30Days);
  }, [calculations, setValue]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end mb-6">
        <div>
          <p className="text-sm text-muted-foreground">Step 5/7</p>
          <h2 className="text-2xl font-bold mb-1">Pricing & Payment</h2>
          <p className="text-muted-foreground">Based on {numDoctors} consulting room{numDoctors > 1 ? 's' : ''}.</p>
        </div>
        
        {/* Billing Toggle */}
        <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-full border shadow-sm">
          <button
            type="button"
            onClick={() => setValue('billingCycle', 'monthly')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${billingCycle === 'monthly' ? 'bg-white shadow-sm text-slate-900 border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setValue('billingCycle', 'annually')}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1 ${billingCycle === 'annually' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Annually <span className="text-[10px] bg-white/20 px-1.5 rounded-sm">SAVE 1 MO</span>
          </button>
        </div>
      </div>

      <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-md flex items-center justify-center gap-2 text-sm font-semibold animate-in fade-in slide-in-from-top-2">
        <Sparkles className="h-4 w-4" />
        First month software is completely FREE on all plans!
      </div>

      {/* PLANS SECTION */}
      <FormField
        control={control}
        name="plan"
        render={({ field }) => (
          <FormItem className="space-y-3">
            <FormControl>
              {clinicType === 'Pharmacy' ? (
                // PHARMACY MONOPOLY PLAN
                <div className="border hover:border-primary bg-white rounded-xl p-6 shadow-sm transition-all text-center max-w-lg mx-auto relative overflow-hidden ring-1 ring-primary">
                  <div className="absolute top-0 inset-x-0 h-1 bg-primary" />
                  <h3 className="text-2xl font-bold">Pharmacy Monopoly Plan</h3>
                  <p className="text-muted-foreground mt-2">All-in-one hub access & doctor connections.</p>
                  
                  <div className="my-6">
                    <span className="text-5xl font-extrabold">₹{calculations.baseMonthly.toLocaleString()}</span>
                    <span className="text-muted-foreground font-medium">/mo software fee</span>
                  </div>
                  
                  {billingCycle === 'annually' && (
                    <p className="text-emerald-600 font-semibold mb-6 flex items-center justify-center gap-1">
                      <Check className="h-4 w-4" /> Billed ₹{calculations.planAnnualTotal.toLocaleString()} yearly (1 month free)
                    </p>
                  )}

                  <ul className="text-left space-y-3 mt-6 border-t pt-6">
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary shrink-0" />
                      <span>Dedicated Hub Portal</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary shrink-0" />
                      <span>{numDoctors} seamless doctor connection{numDoctors > 1 ? 's' : ''}</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary shrink-0" />
                      <span>Instant digital Rx routing</span>
                    </li>
                  </ul>
                  
                  <input type="hidden" {...field} />
                </div>
              ) : (
                // CLINIC 3-TIER PLANS
                <RadioGroup
                  onValueChange={field.onChange}
                  value={field.value}
                  className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch"
                >
                  {/* TIER 1: The Decoy */}
                  <FormItem>
                    <FormControl>
                      <RadioGroupItem value="Standalone Software" id="Standalone Software" className="sr-only" />
                    </FormControl>
                    <Label 
                      htmlFor="Standalone Software" 
                      className={`flex flex-col p-6 border rounded-xl h-full transition-all cursor-pointer ${
                        field.value === 'Standalone Software'
                          ? 'bg-slate-50 border-slate-400 shadow-md ring-1 ring-slate-400'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <div>
                        <span className="text-lg font-bold text-slate-800">Standalone Software</span>
                        <p className="text-sm text-slate-500 mt-1 min-h-[40px]">Basic cloud access for manual data entry.</p>
                      </div>
                      
                      <div className="my-6 pb-6 border-b">
                        <span className="text-4xl font-extrabold text-slate-900">₹{(3999 + 1999 * extraRooms).toLocaleString()}</span>
                        <span className="text-slate-500 font-medium text-sm">/mo</span>
                        {billingCycle === 'annually' && (
                          <div className="text-emerald-600 font-medium text-xs mt-2">
                            Billed ₹{((3999 + 1999 * extraRooms) * 11).toLocaleString()}/yr
                          </div>
                        )}
                      </div>

                      <ul className="space-y-3 text-sm flex-grow text-slate-700">
                        <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" /> Full Cloud EMR Access</li>
                        <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" /> Receptionist Dashboard</li>
                        <li className="flex items-start gap-2 text-amber-700"><X className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" /> Manual typing required</li>
                        <li className="flex items-start gap-2 text-amber-700"><X className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" /> Capped at 1,000 WhatsApp alerts/month</li>
                      </ul>
                    </Label>
                  </FormItem>

                  {/* TIER 2: The Target */}
                  <FormItem className="relative z-10">
                    <div className="absolute -top-3 inset-x-0 flex justify-center z-20">
                      <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                        Recommended
                      </span>
                    </div>
                    <FormControl>
                      <RadioGroupItem value="The Complete Suite" id="The Complete Suite" className="sr-only" />
                    </FormControl>
                    <Label 
                      htmlFor="The Complete Suite" 
                      className={`flex flex-col p-6 border rounded-xl h-full transition-all cursor-pointer relative overflow-hidden ${
                        field.value === 'The Complete Suite'
                          ? 'bg-blue-50/30 border-primary shadow-xl ring-2 ring-primary'
                          : 'bg-white border-primary/40 hover:border-primary shadow-md'
                      }`}
                    >
                      <div className="absolute top-0 inset-x-0 h-1.5 bg-primary" />
                      <div>
                        <span className="text-xl font-extrabold text-slate-900">The Complete Suite</span>
                        <p className="text-sm text-slate-600 mt-1 min-h-[40px]">Premium automated experience.</p>
                      </div>
                      
                      <div className="my-6 pb-6 border-b border-primary/10">
                        <span className="text-5xl font-black text-primary">₹{(1999 + 999 * extraRooms).toLocaleString()}</span>
                        <span className="text-slate-600 font-medium">/mo</span>
                        {billingCycle === 'annually' && (
                          <div className="text-emerald-600 font-semibold text-sm mt-3 flex items-center gap-1">
                            <Check className="h-4 w-4" /> Billed ₹{((1999 + 999 * extraRooms) * 11).toLocaleString()}/yr
                          </div>
                        )}
                      </div>

                      <ul className="space-y-3 text-sm flex-grow font-medium text-slate-800">
                        <li className="flex items-start gap-2"><Check className="h-5 w-5 text-primary shrink-0" /> Write-on-glass workflow (Zero typing)</li>
                        <li className="flex items-start gap-2"><Check className="h-5 w-5 text-primary shrink-0" /> Instant digital routing to pharmacy</li>
                        <li className="flex items-start gap-2"><Check className="h-5 w-5 text-primary shrink-0" /> Unlimited WhatsApp Deliveries</li>
                      </ul>
                    </Label>
                  </FormItem>

                  {/* TIER 3: The Fallback */}
                  <FormItem>
                    <FormControl>
                      <RadioGroupItem value="Starter Scan / BYOD" id="Starter Scan / BYOD" className="sr-only" />
                    </FormControl>
                    <Label 
                      htmlFor="Starter Scan / BYOD" 
                      className={`flex flex-col p-6 border rounded-xl h-full transition-all cursor-pointer ${
                        field.value === 'Starter Scan / BYOD'
                          ? 'bg-slate-50 border-slate-400 shadow-md ring-1 ring-slate-400'
                          : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                      }`}
                    >
                      <div>
                        <span className="text-lg font-bold text-slate-800">Starter Scan / BYOD</span>
                        <p className="text-sm text-slate-500 mt-1 min-h-[40px]">Zero behavior change. Pen & paper friendly.</p>
                      </div>
                      
                      <div className="my-6 pb-6 border-b">
                        <span className="text-4xl font-extrabold text-slate-900">₹{(999 + 499 * extraRooms).toLocaleString()}</span>
                        <span className="text-slate-500 font-medium text-sm">/mo</span>
                        {billingCycle === 'annually' && (
                          <div className="text-emerald-600 font-medium text-xs mt-2">
                            Billed ₹{((999 + 499 * extraRooms) * 11).toLocaleString()}/yr
                          </div>
                        )}
                        <div className="text-xs text-slate-500 mt-2 font-semibold">
                           + ₹{(1499 + 1499 * extraRooms).toLocaleString()} one-time setup
                        </div>
                      </div>

                      <ul className="space-y-3 text-sm flex-grow text-slate-700">
                        <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" /> Mobile App Rx Scanner</li>
                        <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" /> Zero behavior change for doctor</li>
                        <li className="flex items-start gap-2"><Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" /> Includes 2,000 WhatsApp alerts/month</li>
                      </ul>
                    </Label>
                  </FormItem>
                </RadioGroup>
              )}
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* HARDWARE OPTIONS SECTION - Only for Pharmacy or Complete Suite Clinics */}
      {(clinicType === 'Pharmacy' || plan === 'The Complete Suite') && (
        <div className="bg-slate-50 p-6 rounded-xl border space-y-8 animate-in fade-in slide-in-from-top-4">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <TabletSmartphone className="h-5 w-5 text-slate-600" />
              <h3 className="text-lg font-bold text-slate-900">1. Select Your Device Plan</h3>
            </div>
            
            <FormField
              control={control}
              name="hardwareChoice"
              render={({ field: hwField }) => (
                <FormItem>
                  <FormControl>
                    <RadioGroup
                      onValueChange={hwField.onChange}
                      value={hwField.value}
                      className="grid grid-cols-1 md:grid-cols-3 gap-4"
                    >
                      <Label htmlFor="plan-upfront" className={`flex flex-col p-4 border rounded-lg cursor-pointer transition-all ${hwField.value === 'upfront' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'bg-white hover:border-slate-300'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <RadioGroupItem value="upfront" id="plan-upfront" />
                          <span className="font-bold">Tablet (Full Payment)</span>
                        </div>
                        <div className="text-2xl font-black text-slate-900">₹24,999</div>
                        <div className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-tight">Per Consulting Room</div>
                      </Label>

                      <Label htmlFor="plan-emi" className={`flex flex-col p-4 border rounded-lg cursor-pointer transition-all ${hwField.value === 'emi' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'bg-white hover:border-slate-300'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <RadioGroupItem value="emi" id="plan-emi" />
                          <span className="font-bold">Tablet (HaaS EMI)</span>
                        </div>
                        <div className="text-2xl font-black text-slate-900">₹2,083<span className="text-sm font-medium text-slate-500">/mo</span></div>
                        <div className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-tight">12 Month Ownership Plan</div>
                      </Label>

                      <Label htmlFor="plan-byot" className={`flex flex-col p-4 border rounded-lg cursor-pointer transition-all ${hwField.value === 'byot' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'bg-white hover:border-slate-300'}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <RadioGroupItem value="byot" id="plan-byot" />
                          <span className="font-bold">Own Device (BYOD)</span>
                        </div>
                        <div className="text-2xl font-black text-slate-900">₹0</div>
                        <div className="text-[10px] text-slate-500 mt-1 uppercase font-bold tracking-tight">Use Your Own iPad/Tablet</div>
                      </Label>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {hardwareChoice !== 'byot' && (
            <div className="pt-6 border-t animate-in fade-in slide-in-from-top-4">
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-bold text-slate-900">2. Free Trial Month Experience</h3>
              </div>
              
              <FormField
                control={control}
                name="hardwareDeployment"
                render={({ field: deployField }) => (
                  <FormItem>
                    <FormControl>
                      <RadioGroup
                        onValueChange={deployField.onChange}
                        value={deployField.value}
                        className="grid grid-cols-1 md:grid-cols-2 gap-4"
                      >
                        <Label htmlFor="deploy-immediate" className={`flex flex-col p-5 border rounded-xl cursor-pointer transition-all ${deployField.value === 'immediate' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'bg-white hover:border-slate-300'}`}>
                          <div className="flex items-center gap-2 mb-3">
                            <RadioGroupItem value="immediate" id="deploy-immediate" />
                            <span className="font-bold text-slate-900 text-base">Get Tablet Today</span>
                          </div>
                          <p className="text-sm text-slate-600 mb-3">Receive your premium Samsung Galaxy Tab setup immediately to start Month 1.</p>
                          <div className="mt-auto bg-slate-100 p-2 rounded text-[11px] font-bold text-slate-700 uppercase tracking-wide text-center">
                            {hardwareChoice === 'upfront' ? '₹24,999 DUE TODAY' : (hardwareChoice === 'emi' ? `₹${(2083 * numDoctors).toLocaleString()} DUE TODAY` : '₹0 DUE TODAY')}
                          </div>
                        </Label>

                        <Label htmlFor="deploy-delayed" className={`flex flex-col p-5 border rounded-xl cursor-pointer transition-all ${deployField.value === 'delayed' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'bg-white hover:border-slate-300'}`}>
                          <div className="flex items-center gap-2 mb-3">
                            <RadioGroupItem value="delayed" id="deploy-delayed" />
                            <span className="font-bold text-slate-900 text-base">Start with Scanner App (Delayed)</span>
                          </div>
                          <p className="text-sm text-slate-600 mb-3">Use your phone for for Month 1. Your tablet setup will be delivered after 30 days.</p>
                          <div className="mt-auto bg-emerald-100 p-2 rounded text-[11px] font-bold text-emerald-700 uppercase tracking-wide text-center">
                            ₹0 DUE TODAY (TRIAL)
                          </div>
                        </Label>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}
        </div>
      )}

      {/* PROMO CODE & PAYMENT */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 animate-in fade-in">
        <FormField
          control={control}
          name="promoCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Promo Code (optional)</FormLabel>
              <FormControl>
                <Input placeholder="KLOQO2025" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name="paymentMethod"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Payment Method (optional)</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="Card">Card</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                  <SelectItem value="NetBanking">NetBanking</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* SUMMARY FOOTER */}
      {(clinicType === 'Pharmacy' || plan) && (
        <div className="mt-8 p-6 bg-slate-900 text-white rounded-xl shadow-lg flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative border border-slate-700">
          <div className="absolute right-0 top-0 opacity-10 pointer-events-none w-64 h-64 translate-x-1/3 -translate-y-1/3 text-primary">
            <MonitorSmartphone className="w-full h-full" />
          </div>
          
          <div className="z-10 bg-slate-800/50 p-4 rounded-lg flex-1 backdrop-blur-sm border border-slate-700/50">
            <h4 className="text-slate-400 font-semibold mb-2 uppercase tracking-wider text-[11px] flex items-center gap-1">
              <CreditCard className="h-3 w-3" /> Checkout Summary
            </h4>
            
            <p className="text-2xl font-bold text-white mb-2">
              DUE TODAY: ₹{calculations.oneTimeDueToday.toLocaleString()}
            </p>
            
            {calculations.oneTimeDueToday === 0 ? (
              <p className="text-emerald-400 text-sm font-medium mb-4 italic">Start with zero upfront investment today.</p>
            ) : (
              <p className="text-slate-300 text-xs mb-4">Pay for physical hardware today to start Path B.</p>
            )}

            {calculations.totalDueIn30Days > 0 && (
              <div className="pt-3 border-t border-slate-700/50">
                <h5 className="text-slate-400 text-[10px] uppercase font-bold mb-1">Due in 30 days (Trial Over):</h5>
                <p className="text-xl font-bold text-white">₹{calculations.totalDueIn30Days.toLocaleString()}</p>
                <div className="text-slate-400 text-xs flex flex-col gap-0.5 mt-1">
                  {billingCycle === 'annually' ? (
                    <span>₹{calculations.planAnnualTotal.toLocaleString()} for 1 year software.</span>
                  ) : (
                    <span>₹{calculations.baseMonthly.toLocaleString()} for 1 month software.</span>
                  )}
                  {calculations.setupDueIn30Days > 0 && <span>₹{calculations.setupDueIn30Days.toLocaleString()} software setup.</span>}
                  <span className="text-emerald-400">First month software is FREE.</span>
                </div>
              </div>
            )}
          </div>
          
          <div className="z-10 text-right md:text-left bg-slate-800/50 p-4 rounded-lg flex-1 backdrop-blur-sm border border-slate-700/50">
            {calculations.recurringMonthlyDisplay > 0 ? (
              <>
                <h4 className="text-slate-400 font-semibold mb-2 uppercase tracking-wider text-[11px]">
                  Recurring Monthly
                </h4>
                <div className="flex items-baseline gap-2 max-md:justify-end">
                  <p className="text-3xl font-black text-primary">₹{calculations.recurringMonthlyDisplay.toLocaleString()}</p>
                </div>
                {hardwareChoice === 'emi' && (
                  <p className="text-xs text-amber-400 mt-1">Includes +₹{(2083 * numDoctors).toLocaleString()}/mo hardware EMI.</p>
                )}
                {billingCycle === 'annually' ? (
                  <p className="text-sm text-slate-300 mt-1 font-semibold text-emerald-400">Software billed annually. EMI starts in 30 days.</p>
                ) : (
                  <p className="text-sm text-slate-300 mt-1">Begins after 30 days.</p>
                )}
              </>
            ) : (
              <>
                <h4 className="text-slate-400 font-semibold mb-2 uppercase tracking-wider text-[11px]">
                  Recurring Monthly
                </h4>
                <p className="text-3xl font-black text-slate-500">₹0</p>
                <p className="text-sm text-slate-300 mt-1">Fully paid off for the year.</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
