'use client';

import { 
  Building2, Target, Briefcase, Users, UserPlus 
} from 'lucide-react';

export const GLOSSARY: Record<string, string> = {
  MRR: "Monthly Recurring Revenue - The predictable revenue Kloqo earns every month from subscriptions and fees.",
  ARR: "Annual Recurring Revenue - Your MRR multiplied by 12. It shows what your yearly revenue would be at the current scale.",
  GMV: "Gross Merchandise Value - The total value of all doctor consultations processed through Kloqo.",
  "Patient Reach": "The total number of unique patients who have booked appointments using Kloqo.",
  LTV: "Lifetime Value - The total profit expected from a single clinic over the entire time they use Kloqo.",
  CAC: "Customer Acquisition Cost - The money spent on marketing and sales to sign up one new clinic.",
  "Payback Period": "How many months of profit it takes to recover the money spent to acquire a clinic.",
  "Rule of 40": "Growth % + Profit %. A score of 40% is healthy. A negative score means high burn vs low revenue.",
  TAM: "Total Addressable Market - The total revenue opportunity if every single clinic in India used Kloqo.",
  SAM: "Serviceable Addressable Market - The revenue opportunity from clinics that are a perfect fit for Kloqo today.",
  SOM: "Serviceable Obtainable Market - The portion of the market Kloqo can realistically capture in the next 2-3 years.",
  "Contribution Margin": "The profit made per clinic after paying for direct costs like SMS and Cloud hosting.",
  Burn: "The total money spent on operations (Salaries, Rent, Tech) before earning profit.",
};

export const HIRING_PLAN = [
  { role: 'Founder/CEO', time: 'Month 1', status: 'Active', icon: Building2 },
  { role: 'Level A Funding', time: 'Month 6', status: 'Planned', icon: Target },
  { role: 'CTO (Architect)', time: 'Month 7', status: 'Planned', icon: UserPlus },
  { role: 'Lead Dev (NextJS)', time: 'Month 8', status: 'Planned', icon: Briefcase },
  { role: 'Sales Head', time: 'Month 8', status: 'Planned', icon: Users },
  { role: 'Mobile Dev', time: 'Year 2', status: 'Planned', icon: Briefcase },
];

export const COHORT_DATA = [
  { month: 'Jan 2024', size: 10, m1: 100, m2: 90, m3: 80 },
  { month: 'Feb 2024', size: 15, m1: 100, m2: 93, m3: 86 },
  { month: 'Mar 2024', size: 20, m1: 100, m2: 95 },
  { month: 'Apr 2024', size: 25, m1: 100 },
];
