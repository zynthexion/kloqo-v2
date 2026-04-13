'use client';

import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import PatientSearchResults from '@/components/clinic/patient-search-results';
import type { Patient, Doctor } from '@kloqo/shared';
import type { UseFormReturn } from 'react-hook-form';
import type { WalkInFormValues } from '@/hooks/use-walk-in-registration';

interface ManualRegistrationProps {
  phoneNumber: string;
  setPhoneNumber: (val: string) => void;
  isSearchingPatient: boolean;
  searchedPatients: Patient[];
  selectPatient: (p: Patient) => void;
  selectedPatientId: string | null;
  showForm: boolean;
  form: UseFormReturn<WalkInFormValues>;
  onSubmit: (values: WalkInFormValues) => void;
  isSubmitting: boolean;
  doctor: Doctor | null;
}

export function ManualRegistration({
  phoneNumber,
  setPhoneNumber,
  isSearchingPatient,
  searchedPatients,
  selectPatient,
  selectedPatientId,
  showForm,
  form,
  onSubmit,
  isSubmitting,
  doctor
}: ManualRegistrationProps) {
  return (
    <Card className="w-full shadow-lg mt-4">
      <CardHeader>
        <CardTitle className="text-2xl">Manual Registration</CardTitle>
        <CardDescription>Enter patient's phone number to begin.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="relative flex-1 flex items-center">
            <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm h-10">
              +91
            </span>
            <Input
              type="tel"
              placeholder="Enter 10-digit phone number"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
              className="flex-1 rounded-l-none"
              maxLength={10}
            />
            {isSearchingPatient && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin h-4 w-4 text-muted-foreground" />}
          </div>

          {searchedPatients.length > 0 && (
            <PatientSearchResults
              patients={searchedPatients}
              onSelectPatient={selectPatient}
              selectedPatientId={selectedPatientId}
            />
          )}

          {showForm && (
            <div className="pt-4 border-t">
              <h3 className="mb-4 font-semibold text-lg">{selectedPatientId ? 'Confirm Details' : 'New Patient Form'}</h3>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="patientName" render={({ field }) => (
                    <FormItem><FormLabel>Full Name</FormLabel><FormControl><Input placeholder="e.g. Jane Smith" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField control={form.control} name="age" render={({ field }) => (
                      <FormItem><FormLabel>Age</FormLabel><FormControl>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="Enter the age"
                          {...field}
                          value={field.value?.toString() ?? ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '' || /^\d+$/.test(val)) {
                              field.onChange(val);
                              form.trigger('age');
                            }
                          }}
                          className="[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
                        /></FormControl><FormMessage /></FormItem>
                    )} />
                    <FormField control={form.control} name="sex" render={({ field }) => (
                      <FormItem><FormLabel>Sex</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}><FormControl><SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="Male">Male</SelectItem>
                            <SelectItem value="Female">Female</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select><FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={form.control} name="place" render={({ field }) => (
                    <FormItem><FormLabel>Place</FormLabel><FormControl><Input placeholder="e.g. Cityville" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <Button type="submit" className="w-full mt-6 bg-[#f38d17] hover:bg-[#f38d17]/90" disabled={isSubmitting || !doctor}>
                    {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Checking Queue...</> : 'Get Token'}
                  </Button>
                </form>
              </Form>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
