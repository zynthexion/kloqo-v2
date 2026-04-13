'use client';

import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { 
  Command, 
  CommandGroup, 
  CommandItem, 
  CommandList, 
  CommandEmpty 
} from "@/components/ui/command";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Search, 
  Loader2, 
  Link as LinkIcon, 
  Plus, 
  UserPlus, 
  UserCheck, 
  Crown 
} from "lucide-react";
import { 
  FormItem, 
  FormLabel, 
  FormControl, 
  FormMessage 
} from "@/components/ui/form";
import { cn } from "@/lib/utils";
import type { UseFormReturn } from "react-hook-form";
import type { AppointmentFormValues } from "@/hooks/use-appointments-page";

interface PatientDirectoryProps {
  form: UseFormReturn<AppointmentFormValues>;
  state: {
    patientSearchTerm: string;
    patientSearchResults: any[];
    isPatientPopoverOpen: boolean;
    selectedPatient: any;
    primaryPatient: any;
    bookingFor: 'member' | 'relative';
    relatives: any[];
    isPending: boolean;
    isSendingLink: boolean;
    isDrawerExpanded: boolean;
    doctors: any[];
    hasSelectedOption: boolean;
  };
  actions: {
    setIsPatientPopoverOpen: (open: boolean) => void;
    setSelectedPatient: (patient: any) => void;
    setPrimaryPatient: (patient: any) => void;
    setHasSelectedOption: (has: boolean) => void;
    setBookingFor: (type: 'member' | 'relative') => void;
    setIsAddRelativeDialogOpen: (open: boolean) => void;
    setIsDrawerExpanded: (expanded: boolean) => void;
    handlePatientSearch: (term: string) => void;
    handlePatientSelect: (patient: any) => void;
    handleRelativeSelect: (relative: any) => void;
    handlePatientSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleSendLink: () => void;
  };
  patientInputRef: React.RefObject<HTMLInputElement>;
}

export function PatientDirectory({ form, state, actions, patientInputRef }: PatientDirectoryProps) {
  const {
    patientSearchTerm,
    patientSearchResults,
    isPatientPopoverOpen,
    selectedPatient,
    primaryPatient,
    bookingFor,
    relatives,
    isPending,
    isSendingLink,
    isDrawerExpanded,
    doctors,
    hasSelectedOption
  } = state;

  const {
    setIsPatientPopoverOpen,
    setSelectedPatient,
    setPrimaryPatient,
    setHasSelectedOption,
    setBookingFor,
    setIsAddRelativeDialogOpen,
    setIsDrawerExpanded,
    handlePatientSelect,
    handleRelativeSelect,
    handlePatientSearchChange,
    handleSendLink
  } = actions;

  return (
    <div className="space-y-4">
      {/* Step 1: Patient Search */}
      <div className="space-y-4">
        <Popover open={isPatientPopoverOpen} onOpenChange={setIsPatientPopoverOpen}>
          <PopoverTrigger asChild>
            <FormItem>
              <FormLabel>Search Patient by Phone</FormLabel>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <FormControl>
                  <Input
                    ref={patientInputRef}
                    placeholder="Start typing 10-digit phone number..."
                    value={patientSearchTerm}
                    onChange={handlePatientSearchChange}
                    onFocus={() => setIsDrawerExpanded(false)}
                    className="pl-8"
                    maxLength={10}
                  />
                </FormControl>
              </div>
              <FormMessage />
            </FormItem>
          </PopoverTrigger>

          <PopoverContent onOpenAutoFocus={(e) => e.preventDefault()} className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandList>
                {(isPending ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">Searching...</div>
                ) : patientSearchTerm.length >= 5 ? (
                  <CommandGroup>
                    {patientSearchResults.map((patient) => {
                      const isClinicPatient = patient.clinicIds?.includes(doctors[0]?.clinicId || "");
                      return (
                        <CommandItem
                          key={patient.id}
                          value={patient.phone}
                          onSelect={() => handlePatientSelect(patient)}
                          className="flex justify-between items-center"
                        >
                          <div>
                            {patient.name || "Unnamed Patient"}
                            <span className="text-xs text-muted-foreground ml-2">{patient.phone}</span>
                          </div>
                          <Badge variant={isClinicPatient ? "secondary" : "outline"} className={cn(
                            isClinicPatient ? "text-blue-600 border-blue-500" : "text-amber-600 border-amber-500"
                          )}>
                            {isClinicPatient ? <UserCheck className="mr-1.5 h-3 w-3" /> : <Crown className="mr-1.5 h-3 w-3" />}
                            {isClinicPatient ? "Existing Patient" : "Kloqo Member"}
                          </Badge>
                        </CommandItem>
                      );
                    })}
                    <CommandItem
                      value="add-new-patient"
                      onSelect={() => {
                        setSelectedPatient(null);
                        setPrimaryPatient(null);
                        setHasSelectedOption(true);
                        setIsPatientPopoverOpen(false);
                        form.reset({
                          ...form.getValues(),
                          patientName: "",
                          age: undefined,
                          sex: undefined,
                          phone: patientSearchTerm,
                          place: "",
                          doctor: doctors.length > 0 ? doctors[0].id : "",
                          department: doctors.length > 0 ? doctors[0].department || "" : "",
                          date: undefined,
                          time: undefined,
                          bookedVia: "Advanced Booking",
                        });
                      }}
                      className="flex items-center space-x-2 py-2 text-blue-600 hover:text-blue-700 border-t"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add as new patient</span>
                    </CommandItem>
                  </CommandGroup>
                ) : (
                  patientSearchTerm.length >= 5 && <CommandEmpty>No patient found.</CommandEmpty>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {!isDrawerExpanded && (
          <div className="border p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <Label>Send Patient Booking Link</Label>
              <Button type="button" onClick={handleSendLink} disabled={isSendingLink || patientSearchTerm.length < 10}>
                {isSendingLink ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LinkIcon className="mr-2 h-4 w-4" />}
                Send WhatsApp Link
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Member Info & Relatives */}
      {primaryPatient && (
        <div className="mb-4 pt-4 border-t">
          <Tabs value={bookingFor} onValueChange={(value) => setBookingFor(value as any)}>
            <TabsList className="grid w-full grid-cols-2 bg-muted/30">
              <TabsTrigger value="member">For Member</TabsTrigger>
              <TabsTrigger value="relative">For a Relative</TabsTrigger>
            </TabsList>
            <TabsContent value="member" className="mt-4">
              <div className="text-sm p-4 bg-muted/50 rounded-lg">
                <p><strong>Name:</strong> {primaryPatient.name}</p>
                <p><strong>Place:</strong> {primaryPatient.place}</p>
              </div>
            </TabsContent>
            <TabsContent value="relative">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Existing Relatives</h4>
                  <Button type="button" size="sm" variant="ghost" className="text-blue-600 h-7" onClick={() => setIsAddRelativeDialogOpen(true)}>
                    <UserPlus className="mr-1 h-3 w-3" /> Add New
                  </Button>
                </div>
                {relatives.length > 0 ? (
                  <ScrollArea className="h-40">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {relatives.map((relative) => (
                        <div
                          key={relative.id}
                          className="flex flex-col items-center justify-center p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer text-center transition-colors"
                          onClick={() => handleRelativeSelect(relative)}
                        >
                          <Avatar className="h-10 w-10 mb-2">
                            <AvatarFallback>{relative.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium leading-none mb-1">{relative.name}</p>
                            <p className="text-[10px] text-muted-foreground">{relative.sex}, {relative.age} yrs</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <div className="text-center py-6 border-2 border-dashed rounded-lg bg-muted/20">
                    <p className="text-xs text-muted-foreground mb-3">No relatives found for this member.</p>
                    <Button type="button" size="sm" variant="outline" onClick={() => setIsAddRelativeDialogOpen(true)}>
                      <UserPlus className="mr-2 h-4 w-4" /> Add First Relative
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}
