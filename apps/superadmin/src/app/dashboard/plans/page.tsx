'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Zap, Smartphone, MessageSquare, AlertCircle, Crown, Box, Wallet, Users, Stethoscope, Calculator, TrendingUp, Activity, TrendingDown, Gift } from 'lucide-react';

const SaaSPlansPage = () => {
    // --- State ---
    const [doctors, setDoctors] = useState(1);
    const [patientsPerHour, setPatientsPerHour] = useState(5); // New state: default 5 patients/hr (12 mins per patient)
    const [messagesPerPatient, setMessagesPerPatient] = useState(1);
    const [calcPlan, setCalcPlan] = useState('Starter');

    // --- Dynamic Pricing Logic ---
    const starterAnnual = 11999 + ((doctors - 1) * 5000);
    const growthAnnual = 17999 + ((doctors - 1) * 7000);
    const proAnnual = 24999 + ((doctors - 1) * 9000);

    // --- Margin Calculator Logic ---
    const shiftHours = 8;
    const workingDaysPerMonth = 26;
    const costPerMessage = 0.12;

    // Daily calculations based on dynamic patients per hour
    const maxPatientsPerDoctorDaily = shiftHours * patientsPerHour;
    const maxDailyAppointments = doctors * maxPatientsPerDoctorDaily;
    const totalDailyMessages = maxDailyAppointments * messagesPerPatient;

    // Cost calculations
    const dailyApiCost = totalDailyMessages * costPerMessage;
    const monthlyApiCost = dailyApiCost * workingDaysPerMonth;

    // Revenue & Profit calculations
    let activeAnnualRevenue = starterAnnual;
    if (calcPlan === 'Growth') activeAnnualRevenue = growthAnnual;
    if (calcPlan === 'Pro Bundle') activeAnnualRevenue = proAnnual;

    const monthlyRevenue = activeAnnualRevenue / 12;
    const monthlyProfit = monthlyRevenue - monthlyApiCost;
    const profitMarginPercentage = ((monthlyProfit / monthlyRevenue) * 100).toFixed(1);

    // --- Dynamic Credit Allocations ---
    const growthCredits = 3500 + (doctors - 1) * 1500;
    const proCredits = 5000 + (doctors - 1) * 1500;

    // Starter Bonus: ₹1000 base + ₹500 per additional doctor
    // At ₹0.25/msg (Mini Pack rate), ₹500 = 2000 msgs
    const starterBonusRupees = 1000 + (doctors - 1) * 500;
    const starterBonusMessages = (starterBonusRupees / 500) * 2000;

    const formatPrice = (price: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(price);

    return (
        <div className="space-y-16 pb-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Header Section */}
            <div className="text-center space-y-4 pt-10">
                <h1 className="text-4xl font-extrabold tracking-tight text-gray-900">Simple Annual Pricing</h1>
                <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                    One payment, one year of peace. All annual plans include <strong className="text-gray-900">Unlimited Patients</strong>.
                    <br />Need flexibility? Check out our <span className="text-green-600 font-bold">Flexi Packs</span> below.
                </p>
            </div>

            {/* INTERACTIVE PRICING & MARGIN CONTROLS */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-5xl mx-auto">

                {/* DOCTOR SLIDER (Client Facing) */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-center">
                    <div className="flex justify-between items-center mb-4">
                        <label htmlFor="doctor-slider" className="text-lg font-bold text-gray-800 flex items-center gap-2">
                            <Stethoscope className="h-5 w-5 text-primary" />
                            How many doctors in your clinic?
                        </label>
                        <span className="bg-primary/10 text-primary font-extrabold text-xl px-4 py-1 rounded-lg">
                            {doctors}
                        </span>
                    </div>
                    <input
                        id="doctor-slider"
                        type="range"
                        min="1"
                        max="10"
                        value={doctors}
                        onChange={(e) => setDoctors(parseInt(e.target.value))}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <div className="flex justify-between text-xs text-gray-400 mt-2 font-medium">
                        <span>1 (Solo Clinic)</span>
                        <span>10+ (Polyclinic)</span>
                    </div>
                </div>

                {/* FOUNDER'S MARGIN CALCULATOR (Internal Tooling) */}
                <div className="bg-slate-900 p-6 rounded-2xl shadow-lg border border-slate-700 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-slate-800 text-slate-300 px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-bl-lg">
                        Margin Sandbox
                    </div>

                    <div className="flex items-center gap-2 mb-4 text-slate-100">
                        <Calculator className="h-5 w-5 text-emerald-400" />
                        <h3 className="font-bold text-lg">WhatsApp Cost Projection</h3>
                    </div>

                    <div className="space-y-4 mb-5">
                        {/* New Slider: Patients per Hour */}
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-sm font-medium text-slate-300">Patients per Hour (Per Doctor)</label>
                                <span className="font-bold text-emerald-400">{patientsPerHour} / hr</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="20"
                                value={patientsPerHour}
                                onChange={(e) => setPatientsPerHour(parseInt(e.target.value))}
                                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                            />
                        </div>

                        {/* Slider: Messages per Patient */}
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="text-sm font-medium text-slate-300">Messages per Patient</label>
                                <span className="font-bold text-emerald-400">{messagesPerPatient} msg</span>
                            </div>
                            <input
                                type="range"
                                min="1"
                                max="5"
                                value={messagesPerPatient}
                                onChange={(e) => setMessagesPerPatient(parseInt(e.target.value))}
                                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                            />
                            <p className="text-[10px] text-slate-400 mt-1">At ₹0.12 per Meta API message</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                        <div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                                <Activity className="h-3 w-3" /> Max 8-Hr Capacity
                            </p>
                            <p className="font-bold text-sm">{maxDailyAppointments} Patients/day</p>
                            <p className="text-xs text-slate-500">{totalDailyMessages} msgs sent daily</p>
                        </div>
                        <div>
                            <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">API Spend</p>
                            <p className="font-bold text-sm text-red-400">{formatPrice(dailyApiCost)} / day</p>
                            <p className="text-xs text-slate-500">{formatPrice(monthlyApiCost)} / month</p>
                        </div>

                        <div className="col-span-2 pt-3 mt-1 border-t border-slate-700">
                            {/* Plan Selector for Margin Calculation */}
                            <div className="flex gap-2 mb-3">
                                {['Starter', 'Growth', 'Pro Bundle'].map(plan => (
                                    <button
                                        key={plan}
                                        onClick={() => setCalcPlan(plan)}
                                        className={`flex-1 text-xs font-bold py-1.5 rounded-md transition-all ${calcPlan === plan ? 'bg-emerald-500 text-slate-900' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}
                                    >
                                        {plan}
                                    </button>
                                ))}
                            </div>

                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">{calcPlan} Profit</p>
                                    <p className={`font-extrabold text-xl ${monthlyProfit > 0 ? 'text-emerald-400' : 'text-red-500'}`}>
                                        {formatPrice(monthlyProfit)} <span className="text-sm font-normal">/ mo</span>
                                    </p>
                                </div>
                                <div className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 ${Number(profitMarginPercentage) >= 50 ? 'bg-emerald-500/20 text-emerald-400' : Number(profitMarginPercentage) > 0 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                                    {Number(profitMarginPercentage) >= 50 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                    {profitMarginPercentage}% Margin
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* SECTION 1: ANNUAL PLANS */}
            <div>
                <h2 className="text-xl font-bold text-gray-900 mb-6 mt-8 flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                    Annual Subscriptions
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-start">

                    {/* TIER 1: STARTER */}
                    <Card className={`flex flex-col border-2 transition-all duration-300 h-full ${calcPlan === 'Starter' ? 'border-primary shadow-lg ring-4 ring-primary/10' : 'border-gray-100 hover:border-gray-300 shadow-sm'}`}>
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-xl font-bold text-gray-700">Starter</CardTitle>
                                <Badge variant="secondary" className="bg-gray-100 text-gray-600">Software Only</Badge>
                            </div>
                            <div className="mt-4">
                                <span className="text-4xl font-extrabold text-gray-900">{formatPrice(starterAnnual).replace('₹', '₹ ')}</span>
                                <span className="text-gray-500 font-medium">/year</span>
                            </div>
                            <p className="text-xs text-green-600 font-bold uppercase tracking-wide bg-green-50 inline-block px-2 py-1 rounded mt-2">
                                Effective: {formatPrice(Math.round(starterAnnual / 12)).replace('₹', '₹ ')}/mo
                            </p>
                            <CardDescription className="pt-3">
                                Essential queue management for clinics with existing hardware.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 space-y-4">
                            {/* BONUS BOX */}
                            <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                                <div className="flex items-center gap-2 font-bold text-amber-700 mb-1 text-xs uppercase tracking-wide">
                                    <Gift className="h-4 w-4" />
                                    Initial Purchase Bonus
                                </div>
                                <p className="text-xs text-gray-600 leading-snug">
                                    <strong>FREE WhatsApp Credits</strong> (Worth ₹{starterBonusRupees.toLocaleString()}). Includes {starterBonusMessages.toLocaleString()} messages to get you started!
                                </p>
                            </div>

                            <ul className="space-y-3 shrink-0">
                                <PlanFeature text={`${doctors} Doctor Login${doctors > 1 ? 's' : ''}`} bold icon={<Users className="h-3.5 w-3.5 text-gray-500" />} />
                                <PlanFeature text="Unlimited Patients" bold />
                                <PlanFeature text="Nurse App Access Only" bold highlighted icon={<Smartphone className="h-3.5 w-3.5 text-primary" />} />
                                <PlanFeature text="No Clinic Admin (Desktop)" dimmed icon={<AlertCircle className="h-3.5 w-3.5 text-gray-400" />} />
                                <PlanFeature text="Pay-as-you-go WhatsApp" icon={<AlertCircle className="h-3.5 w-3.5 text-amber-500" />} />
                                <PlanFeature text="Basic Queue Management" />
                            </ul>
                        </CardContent>
                        <CardFooter>
                            <Button variant={calcPlan === 'Starter' ? 'default' : 'outline'} className="w-full font-semibold">Select Starter</Button>
                        </CardFooter>
                    </Card>

                    {/* TIER 2: GROWTH */}
                    <Card className={`flex flex-col border-2 transition-all duration-300 h-full relative ${calcPlan === 'Growth' ? 'border-primary shadow-lg ring-4 ring-primary/10 bg-blue-50/50' : 'border-blue-100 hover:border-blue-300 bg-blue-50/30 shadow-md'}`}>
                        <div className="absolute top-0 right-0 bg-blue-600 text-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-bl-lg">
                            Most Popular
                        </div>
                        <CardHeader>
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-xl font-bold text-blue-700 flex items-center gap-2">
                                    <Users className="h-5 w-5" />
                                    Growth
                                </CardTitle>
                            </div>
                            <div className="mt-4">
                                <span className="text-4xl font-extrabold text-gray-900">{formatPrice(growthAnnual).replace('₹', '₹ ')}</span>
                                <span className="text-gray-500 font-medium">/year</span>
                            </div>
                            <p className="text-xs text-blue-600 font-bold uppercase tracking-wide bg-blue-100 inline-block px-2 py-1 rounded mt-2">
                                Effective: {formatPrice(Math.round(growthAnnual / 12)).replace('₹', '₹ ')}/mo
                            </p>
                            <CardDescription className="pt-3">
                                Enhanced operational tools with multi-login support.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 space-y-5">
                            <div className="p-3 bg-white rounded-lg border border-blue-200 shadow-sm">
                                <div className="flex items-center gap-2 font-bold text-blue-800 mb-1 text-xs uppercase tracking-wider">
                                    <Box className="h-3.5 w-3.5" />
                                    Included Hardware
                                </div>
                                <div className="text-xs flex items-center gap-2 font-medium text-gray-700">
                                    <Check className="h-3 w-3 text-green-500" /> FREE Smart Stick (Fire TV)
                                </div>
                            </div>

                            <ul className="space-y-3 shrink-0">
                                <PlanFeature text="Everything in Starter" bold />
                                <PlanFeature text="Clinic Admin (Desktop) Access" bold highlighted icon={<Box className="h-3.5 w-3.5 text-primary" />} />
                                <PlanFeature text="Analytics & Revenue Reports" icon={<TrendingUp className="h-3.5 w-3.5 text-blue-600" />} />
                                <PlanFeature text="Patient Data & Performance Charts" icon={<Activity className="h-3.5 w-3.5 text-blue-600" />} />
                                <PlanFeature text="Review Collection for Doctors" highlighted icon={<MessageSquare className="h-3.5 w-3.5 text-green-600" />} />
                                <PlanFeature text={`${growthCredits.toLocaleString()} WhatsApp Credits/mo`} bold icon={<MessageSquare className="h-3.5 w-3.5 text-green-600" />} />
                            </ul>
                        </CardContent>
                        <CardFooter>
                            <Button className={`w-full font-bold shadow-lg ${calcPlan === 'Growth' ? 'bg-primary hover:bg-primary/90' : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'}`}>
                                Select Growth
                            </Button>
                        </CardFooter>
                    </Card>

                    {/* TIER 3: PRO BUNDLE (Hardware) */}
                    <Card className={`flex flex-col relative overflow-hidden border-2 shadow-2xl scale-105 z-10 h-full ${calcPlan === 'Pro Bundle' ? 'border-emerald-500 ring-4 ring-emerald-500/20' : 'border-primary'}`}>
                        <div className={`absolute top-0 inset-x-0 h-1.5 ${calcPlan === 'Pro Bundle' ? 'bg-emerald-500' : 'bg-primary'}`} />
                        <CardHeader className="bg-primary/5 pb-8">
                            <CardTitle className={`text-2xl font-bold flex items-center gap-2 ${calcPlan === 'Pro Bundle' ? 'text-emerald-600' : 'text-primary'}`}>
                                <Crown className={`h-6 w-6 ${calcPlan === 'Pro Bundle' ? 'fill-emerald-600' : 'fill-primary'}`} />
                                Pro Bundle
                            </CardTitle>
                            <div className="mt-4">
                                <span className="text-5xl font-extrabold text-gray-900">{formatPrice(proAnnual).replace('₹', '₹ ')}</span>
                                <span className="text-gray-500 font-medium">/year</span>
                            </div>
                            <p className="text-xs text-primary font-bold uppercase tracking-wide bg-primary/10 inline-block px-2 py-1 rounded mt-2">
                                Effective: {formatPrice(Math.round(proAnnual / 12)).replace('₹', '₹ ')}/mo
                            </p>
                            <CardDescription className="pt-2 text-gray-600">
                                The complete "Plug & Play" tablet system.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="flex-1 space-y-5 pt-6">
                            <div className="p-3 bg-gray-900 text-white rounded-lg border border-gray-800 shadow-inner">
                                <div className="flex items-center gap-2 font-bold text-yellow-400 mb-2 text-xs uppercase tracking-wider">
                                    <Box className="h-4 w-4" />
                                    Full Hardware Kit (Worth ₹15,500)
                                </div>
                                <ul className="space-y-1.5">
                                    <li className="text-xs flex items-center gap-2">
                                        <Check className="h-3 w-3 text-green-400" /> Samsung Galaxy Tab A9
                                    </li>
                                    <li className="text-xs flex items-center gap-2">
                                        <Check className="h-3 w-3 text-green-400" /> Metal Desktop Stand
                                    </li>
                                    <li className="text-xs flex items-center gap-2 font-bold text-white">
                                        <Check className="h-3 w-3 text-green-400" /> FREE Smart Stick
                                    </li>
                                </ul>
                            </div>

                            <ul className="space-y-3 shrink-0">
                                <PlanFeature text="Everything in Growth Plan" bold />
                                <PlanFeature text="Doctor Punctuality Report" highlighted icon={<Activity className="h-3.5 w-3.5 text-emerald-600" />} />
                                <PlanFeature text="Staff Performance Tracker" icon={<TrendingUp className="h-3.5 w-3.5 text-emerald-600" />} />
                                <PlanFeature text="Top Doctor Highlighting (1 Week FREE)" highlighted icon={<Crown className="h-3.5 w-3.5 text-amber-500" />} />
                                <PlanFeature text="Priority Patient App Placement" icon={<Smartphone className="h-3.5 w-3.5 text-emerald-600" />} />
                                <PlanFeature text={`${proCredits.toLocaleString()} WhatsApp Credits/mo`} bold icon={<MessageSquare className="h-3.5 w-3.5 text-primary" />} />
                            </ul>
                        </CardContent>
                        <CardFooter className="bg-primary/5 pt-6">
                            <Button className={`w-full shadow-lg h-11 text-md font-bold ${calcPlan === 'Pro Bundle' ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20' : 'bg-primary hover:bg-primary/90 shadow-primary/20'}`}>
                                Get Pro Bundle
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>

            {/* SECTION 2: FLEXI PACKS */}
            <div className="pt-10 border-t border-gray-200">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <Wallet className="h-6 w-6 text-green-600" />
                            Flexi Packs <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full uppercase tracking-wide">Pay-Per-Patient</span>
                        </h2>
                        <p className="text-gray-500 mt-1">
                            Can't commit to a year? Buy credits that never expire.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <Card className="border-gray-200 hover:border-green-400 hover:shadow-md transition-all">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-bold text-gray-600">Starter Pack</CardTitle>
                            <div className="text-3xl font-extrabold text-gray-900 mt-2">₹499</div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-lg font-bold text-green-600 mb-1">300 Patient Credits</div>
                            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center text-sm">
                                <span className="text-gray-500">Cost per patient</span>
                                <span className="font-bold bg-gray-100 px-2 py-1 rounded">₹1.66</span>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button variant="outline" className="w-full border-green-200 text-green-700 hover:bg-green-50">Buy Pack</Button>
                        </CardFooter>
                    </Card>

                    <Card className="border-green-200 bg-green-50/30 hover:shadow-md transition-all relative">
                        <div className="absolute top-0 right-0 bg-green-600 text-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest rounded-bl-lg">
                            Popular
                        </div>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-bold text-gray-600">Value Pack</CardTitle>
                            <div className="text-3xl font-extrabold text-gray-900 mt-2">₹1,499</div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-lg font-bold text-green-600 mb-1">1,000 Patient Credits</div>
                            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center text-sm">
                                <span className="text-gray-500">Cost per patient</span>
                                <span className="font-bold bg-green-100 text-green-800 px-2 py-1 rounded">₹1.50</span>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button className="w-full bg-green-600 hover:bg-green-700">Buy Pack</Button>
                        </CardFooter>
                    </Card>

                    <Card className="border-gray-200 hover:border-green-400 hover:shadow-md transition-all">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-lg font-bold text-gray-600">Jumbo Pack</CardTitle>
                            <div className="text-3xl font-extrabold text-gray-900 mt-2">₹2,999</div>
                        </CardHeader>
                        <CardContent>
                            <div className="text-lg font-bold text-green-600 mb-1">2,500 Patient Credits</div>
                            <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center text-sm">
                                <span className="text-gray-500">Cost per patient</span>
                                <span className="font-bold bg-gray-100 px-2 py-1 rounded">₹1.20</span>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button variant="outline" className="w-full border-green-200 text-green-700 hover:bg-green-50">Buy Pack</Button>
                        </CardFooter>
                    </Card>
                </div>
                <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200 text-xs text-gray-500 flex gap-2 items-start">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <p><strong>Note:</strong> Flexi plans are "Software Only". Hardware must be purchased separately or clinics can use their own devices.</p>
                </div>
            </div>

            {/* SECTION 3: WHATSAPP ADD-ONS */}
            <div className="pt-10 border-t border-gray-200">
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 bg-green-50 rounded-lg">
                        <MessageSquare className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">WhatsApp Packs</h2>
                        <p className="text-sm text-gray-500">
                            Required for Flexi & Starter. (Annual plans include monthly message credits).
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
                    <div className="flex items-center justify-between p-5 border rounded-xl bg-white hover:border-gray-300 transition-all">
                        <div>
                            <div className="text-sm font-bold text-gray-500 uppercase">Mini Pack</div>
                            <div className="text-2xl font-extrabold text-gray-900">₹500</div>
                            <div className="text-xs text-gray-400 mt-1">2,000 Messages (₹0.25/msg)</div>
                        </div>
                        <Button variant="outline" size="sm">Add</Button>
                    </div>
                    <div className="flex items-center justify-between p-5 border border-green-200 bg-green-50/20 rounded-xl hover:shadow-sm transition-all">
                        <div>
                            <div className="text-sm font-bold text-green-700 uppercase flex items-center gap-2">
                                Mega Pack <Badge className="bg-green-600 text-[10px] h-4">Best</Badge>
                            </div>
                            <div className="text-2xl font-extrabold text-gray-900">₹2,000</div>
                            <div className="text-xs text-gray-500 mt-1">10,000 Messages (₹0.20/msg)</div>
                        </div>
                        <Button className="bg-green-600 hover:bg-green-700">Add</Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Helper Components ---
const PlanFeature = ({ text, bold = false, highlighted = false, dimmed = false, icon }: { text: string; bold?: boolean; highlighted?: boolean; dimmed?: boolean; icon?: React.ReactNode }) => (
    <li className={`flex items-start gap-3 ${dimmed ? 'opacity-50' : ''}`}>
        <div className={`mt-0.5 rounded-full p-0.5 shrink-0 ${highlighted ? 'bg-primary/20 text-primary' : 'bg-gray-100 text-gray-500'}`}>
            {icon || <Check className="h-3.5 w-3.5" />}
        </div>
        <span className={`text-sm ${bold ? 'font-bold text-gray-900' : 'text-gray-600'} ${highlighted ? 'text-primary font-semibold' : ''} ${dimmed ? 'line-through' : ''}`}>
            {text}
        </span>
    </li>
);

export default SaaSPlansPage;