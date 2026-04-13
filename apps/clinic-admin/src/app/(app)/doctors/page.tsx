"use client";

import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Loader2, PlusCircle, LayoutDashboard, UserCheck, CalendarDays, ShieldCheck, BarChart3, Coffee, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDoctorsPageState } from "@/hooks/use-doctors-page-state";
import { DoctorListItem } from "@/components/doctors/DoctorListItem";
import { ProfileTab } from "@/components/doctors/ProfileTab";
import { AvailabilityTab } from "@/components/doctors/AvailabilityTab";
import { RoleTab } from "@/components/doctors/RoleTab";
import { BreakTab } from "@/components/doctors/BreakTab";
import { StatsTab } from "@/components/doctors/StatsTab";
import { AddDoctorForm } from "@/components/doctors/add-doctor-form";
import { ReviewsSection } from "@/components/reviews-section";
import { UpgradePlanModal } from "@/components/doctors/upgrade-plan-modal";
import { Badge } from "@/components/ui/badge";
import { ActivityLogTab } from "@/components/doctors/ActivityLogTab";

const TABS = [
  { id: "details", label: "Profile", icon: UserCheck },
  { id: "availability", label: "Slots", icon: CalendarDays },
  { id: "roles", label: "Roles", icon: ShieldCheck },
  { id: "breaks", label: "Breaks", icon: Coffee },
  { id: "logs", label: "Logs", icon: Zap },
  { id: "stats", label: "Stats", icon: BarChart3 },
  { id: "reviews", label: "Rating", icon: LayoutDashboard }
];

export default function DoctorsPage() {
  const {
    doctors, selectedDoctor, setSelectedDoctor,
    clinicDepartments, appointments, activeTab, setActiveTab,
    dateRange, setDateRange, leaveCalDate, setLeaveCalDate,
    tempAccessibleMenus, setTempAccessibleMenus,
    isSavingAccess, isRevokingAccess, handleSaveAccess, handleRevokeAccess,
    updateDoctorField, updateDoctorFields, isPending, clinicDetails, fetchAllData
  } = useDoctorsPageState();

  const [showAddForm, setShowAddForm] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const numDoctors = clinicDetails?.numDoctors ?? 1;
  const currentDoctorCount = clinicDetails?.currentDoctorCount ?? doctors.length;
  const isAtLimit = currentDoctorCount >= numDoctors;

  const handleAddConsultantClick = () => {
    if (isAtLimit) {
      setShowUpgradeModal(true);
    } else {
      setShowAddForm(true);
    }
  };

  if (doctors.length === 0 && !clinicDetails) {
    return (
      <div className="flex flex-col items-center justify-center p-24 bg-slate-50 min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-theme-blue/20 mb-6" />
        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Loading Clinical Staff...</h2>
      </div>
    );
  }

  return (
    <>
      <AddDoctorForm
        isOpen={showAddForm}
        setIsOpen={setShowAddForm}
        doctor={null}
        departments={clinicDepartments}
        updateDepartments={() => fetchAllData()}
        onSave={() => setShowAddForm(false)}
      />

      {/* Upgrade Plan Modal (Paywall Intercept) */}
      <UpgradePlanModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        clinicDetails={clinicDetails}
      />

      <div className="flex h-screen bg-white font-pt-sans overflow-hidden">
        {/* Sidebar List */}
        <aside className="w-[380px] border-r border-slate-100 flex flex-col bg-slate-50/30 shadow-2xl shadow-black/5">
          <header className="p-8 pb-4">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-1 uppercase">Medical Staff</h1>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Resource management dashboard</p>
              </div>
              {/* Live seat counter badge */}
              <Badge variant={isAtLimit ? "destructive" : "secondary"} className="font-black text-xs shrink-0">
                {currentDoctorCount}/{numDoctors} seats
              </Badge>
            </div>
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300 group-hover:text-theme-blue transition-colors" />
              <Input 
                placeholder="Search Consultants..." 
                className="pl-12 h-12 rounded-2xl border-none bg-white shadow-xl shadow-black/5 font-black text-slate-700 text-xs uppercase tracking-widest placeholder:text-slate-300 focus-visible:ring-theme-blue/20" 
              />
            </div>
          </header>

          <section className="flex-1 overflow-y-auto px-6 py-4 space-y-3 custom-scrollbar">
            {doctors.map(doctor => (
              <DoctorListItem 
                key={doctor.id} 
                doctor={doctor} 
                isSelected={selectedDoctor?.id === doctor.id} 
                onSelect={() => setSelectedDoctor(doctor)} 
              />
            ))}
            <Button
              variant="outline"
              onClick={handleAddConsultantClick}
              className={`w-full h-16 rounded-[2rem] border-2 border-dashed text-xs tracking-widest font-black uppercase transition-all ${
                isAtLimit
                  ? "border-amber-300 text-amber-500 hover:border-amber-400 hover:bg-amber-50"
                  : "border-slate-200 text-slate-400 hover:border-theme-blue hover:text-theme-blue"
              }`}
            >
              <PlusCircle className="h-5 w-5 mr-3" />
              {isAtLimit ? "Upgrade to Add Consultant" : "Add Consultant"}
            </Button>
          </section>
        </aside>

        {/* Main Panel */}
        <main className="flex-1 flex flex-col bg-white overflow-hidden">
          {selectedDoctor ? (
            <>
              <header className="p-8 border-b border-slate-50 bg-white z-10 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    <div className="h-16 w-16 rounded-2xl border-2 border-slate-50 shadow-xl shadow-black/5 overflow-hidden ring-4 ring-slate-50">
                      <img src={selectedDoctor.avatar} alt={selectedDoctor.name} className="h-full w-full object-cover" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-slate-800 tracking-tight leading-none mb-1">Dr. {selectedDoctor.name}</h2>
                      <div className="flex items-center gap-2">
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{selectedDoctor.specialty}</span>
                         <div className="h-1 w-1 bg-slate-300 rounded-full" />
                         <span className="text-[10px] font-black text-theme-blue uppercase tracking-widest leading-none">{selectedDoctor.department}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50/50 p-1.5 rounded-2xl border-2 border-slate-50 shadow-inner">
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                      <TabsList className="bg-transparent h-12 gap-1 px-1">
                        {TABS.map(tab => (
                          <TabsTrigger 
                            key={tab.id} value={tab.id}
                            className="rounded-xl px-5 h-9 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-white data-[state=active]:text-theme-blue data-[state=active]:shadow-lg data-[state=active]:shadow-black/5"
                          >
                            <tab.icon className="h-3.5 w-3.5 mr-2" strokeWidth={3} /> {tab.label}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </Tabs>
                  </div>
                </div>
              </header>

              <section className="flex-1 overflow-y-auto p-10 bg-slate-50/30 custom-scrollbar">
                 <div className="max-w-6xl mx-auto pb-20">
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsContent value="details" className="m-0 mt-0">
                      <ProfileTab doctor={selectedDoctor} departments={clinicDepartments} onUpdate={updateDoctorField} isPending={isPending} />
                    </TabsContent>
                    <TabsContent value="availability" className="m-0 mt-0">
                      <AvailabilityTab doctor={selectedDoctor} onUpdate={updateDoctorField} isPending={isPending} />
                    </TabsContent>
                    <TabsContent value="roles" className="m-0 mt-0">
                      <RoleTab 
                        doctor={selectedDoctor} 
                        onUpdate={updateDoctorFields} 
                        isPending={isPending} 
                      />
                    </TabsContent>
                    <TabsContent value="breaks" className="m-0 mt-0">
                      <BreakTab doctor={selectedDoctor} leaveDate={leaveCalDate} onDateChange={setLeaveCalDate} onUpdate={updateDoctorField} isPending={isPending} />
                    </TabsContent>
                    <TabsContent value="stats" className="m-0 mt-0">
                      <StatsTab doctor={selectedDoctor} appointments={appointments} dateRange={dateRange} onRangeChange={setDateRange} />
                    </TabsContent>
                    <TabsContent value="logs" className="m-0 mt-0">
                      <ActivityLogTab doctor={selectedDoctor} />
                    </TabsContent>
                    <TabsContent value="reviews" className="m-0 mt-0">
                      <ReviewsSection reviews={selectedDoctor.reviewList || []} />
                    </TabsContent>
                  </Tabs>
                 </div>
              </section>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-8 bg-slate-50/20">
               <div className="h-40 w-40 rounded-[3.5rem] bg-white border-2 border-dashed border-slate-100 flex items-center justify-center shadow-2xl shadow-black/5">
                  <LayoutDashboard className="h-16 w-16 text-slate-200" strokeWidth={1} />
               </div>
               <div className="text-center space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 animate-pulse">Select Consultant</p>
                  <p className="text-xs font-bold text-slate-300 uppercase tracking-widest">To begin session & availability management</p>
               </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
