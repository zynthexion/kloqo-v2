import { useMemo } from 'react';

export interface PricingParams {
  clinicType: 'Clinic' | 'Pharmacy';
  plan: string;
  numDoctors: number;
  billingCycle: 'monthly' | 'annually';
  hardwareChoice: 'upfront' | 'emi' | 'byot';
  hardwareDeployment: 'immediate' | 'delayed';
  // Context for upgrades
  isUpgradeFlow?: boolean; 
  isTrialActive?: boolean;
  currentPlanStr?: string;
  currentNumDoctors?: number;
  daysRemainingInCycle?: number;
}

export function usePricingCalculator({
  clinicType,
  plan,
  numDoctors,
  billingCycle,
  hardwareChoice,
  hardwareDeployment,
  isUpgradeFlow = false,
  isTrialActive = false,
  currentPlanStr = '',
  currentNumDoctors = 1,
  daysRemainingInCycle
}: PricingParams) {
  
  return useMemo(() => {
    let baseMonthly = 0;
    let softwareSetupTotal = 0;
    const extraRooms = Math.max(0, numDoctors - 1);
    
    if (clinicType === 'Pharmacy') {
      baseMonthly = 2999 + (1499 * extraRooms);
    } else {
      switch (plan) {
        case 'Standalone Software':
          baseMonthly = 3999 + (1999 * extraRooms);
          break;
        case 'The Complete Suite':
          baseMonthly = 1999 + (999 * extraRooms);
          break;
        case 'Starter Scan / BYOD':
          baseMonthly = 999 + (499 * extraRooms);
          softwareSetupTotal += 1499 * numDoctors;
          break;
      }
    }

    // Hardware Calculations
    let hardwareEmiMonthly = 0;
    let hardwareUpfrontTotal = 0;

    let addedHardwareSeats = numDoctors; // for signup, charge for all.
    if (isUpgradeFlow) {
        // Only charge hardware for newly added seats
        addedHardwareSeats = Math.max(0, numDoctors - currentNumDoctors);
    }

    if (hardwareChoice === 'emi') {
      hardwareEmiMonthly = 2083 * addedHardwareSeats;
    } else if (hardwareChoice === 'upfront') {
      hardwareUpfrontTotal = 24999 * addedHardwareSeats;
    }

    const planAnnualTotal = baseMonthly * 11; // 1 month free if annual
    
    let oneTimeDueToday = 0;
    let totalDueIn30Days = 0;
    let proratedSoftwareAmount = 0;

    if (isUpgradeFlow) {
         // Mid-month upgrade logic here.
         // Software Proration
         let oldMonthly = 0;
         const oldExtraRooms = Math.max(0, currentNumDoctors - 1);
         if (clinicType === 'Pharmacy') {
             oldMonthly = 2999 + (1000 * oldExtraRooms);
         } else {
             switch (currentPlanStr) {
                 case 'Standalone Software': oldMonthly = 3999 + (1999 * oldExtraRooms); break;
                 case 'The Complete Suite': oldMonthly = 1999 + (999 * oldExtraRooms); break;
                 case 'Starter Scan / BYOD': oldMonthly = 999 + (499 * oldExtraRooms); break;
             }
         }

         const monthlyIncrease = Math.max(0, baseMonthly - oldMonthly);
         
          if (isTrialActive) {
             proratedSoftwareAmount = 0;
          } else {
             // Strict Proration: (Addition / 30) * DaysRemaining
             const daysLeft = daysRemainingInCycle ?? 15; // default to 15 if not provided for safety
             proratedSoftwareAmount = (monthlyIncrease / 30) * daysLeft;
          }

        // Hardware is immediate in upgrade flow if they want it
        if (hardwareDeployment === 'immediate') {
             if (hardwareChoice === 'upfront') {
                 oneTimeDueToday = hardwareUpfrontTotal + proratedSoftwareAmount;
             } else if (hardwareChoice === 'emi') {
                 oneTimeDueToday = hardwareEmiMonthly + proratedSoftwareAmount;
             }
        } else {
            oneTimeDueToday = proratedSoftwareAmount; // only software due today if delayed hardware
        }
        
        totalDueIn30Days = (billingCycle === 'annually' ? planAnnualTotal : baseMonthly) + 
                           (hardwareChoice === 'emi' ? hardwareEmiMonthly : 0);

    } else {
        // Original Signup Logic
        if (hardwareDeployment === 'immediate') {
        if (hardwareChoice === 'upfront') {
            oneTimeDueToday = hardwareUpfrontTotal;
        } else if (hardwareChoice === 'emi') {
            oneTimeDueToday = hardwareEmiMonthly;
        }
        } else {
        if (hardwareChoice === 'upfront') {
            totalDueIn30Days += hardwareUpfrontTotal;
        }
        }

        if (billingCycle === 'annually') {
        totalDueIn30Days += planAnnualTotal;
        } else {
        totalDueIn30Days += baseMonthly;
        }
        if (plan === 'Starter Scan / BYOD') {
        totalDueIn30Days += softwareSetupTotal;
        }
    }

    const recurringMonthlyDisplay = billingCycle === 'annually' ? hardwareEmiMonthly : (baseMonthly + hardwareEmiMonthly);

    return { 
      baseMonthly, 
      softwareSetupTotal, 
      hardwareEmiMonthly, 
      hardwareUpfrontTotal,
      oneTimeDueToday,
      totalDueIn30Days,
      recurringMonthlyDisplay,
      planAnnualTotal,
      setupDueIn30Days: (plan === 'Starter Scan / BYOD' ? softwareSetupTotal : 0),
      proratedSoftwareAmount
    };
  }, [
      clinicType, plan, hardwareChoice, hardwareDeployment, numDoctors, 
      billingCycle, isUpgradeFlow, isTrialActive, currentPlanStr, currentNumDoctors, daysRemainingInCycle
    ]);
}
