"use client";

import { UseFormReturn } from "react-hook-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Edit, Save, Loader2 } from "lucide-react";

interface ClinicDetailsSettingsProps {
  clinicDetails: any;
  isEditingClinic: boolean;
  setIsEditingClinic: (editing: boolean) => void;
  isPending: boolean;
  clinicForm: UseFormReturn<any>;
  onClinicSubmit: (values: any) => void;
  handleCancelClinic: () => void;
  currentDoctorCount: number;
}

export function ClinicDetailsSettings({
  clinicDetails,
  isEditingClinic,
  setIsEditingClinic,
  isPending,
  clinicForm,
  onClinicSubmit,
  handleCancelClinic,
  currentDoctorCount,
}: ClinicDetailsSettingsProps) {
  if (!clinicDetails) return <Card><CardHeader><CardTitle>Loading Clinic Details...</CardTitle></CardHeader></Card>;

  const isMultiDoctorClinic = clinicForm.watch('type') === 'Multi-Doctor';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>General Information</CardTitle>
          {!isEditingClinic && (
            <Button variant="outline" size="icon" onClick={() => setIsEditingClinic(true)} disabled={isPending}>
              <Edit className="w-4 h-4" />
            </Button>
          )}
        </div>
        <CardDescription>General information about your clinic.</CardDescription>
      </CardHeader>
      <Form {...clinicForm}>
        <form onSubmit={clinicForm.handleSubmit(onClinicSubmit)}>
          <CardContent className="space-y-4">
            <FormField control={clinicForm.control} name="name" render={({ field }) => (
              <FormItem><FormLabel>Clinic Name</FormLabel><FormControl><Input {...field} disabled={!isEditingClinic || isPending} placeholder="Enter clinic name" /></FormControl><FormMessage /></FormItem>
            )} />
            
            <FormField control={clinicForm.control} name="type" render={({ field }) => (
              <FormItem>
                <FormLabel>Clinic Type</FormLabel>
                <Select
                  onValueChange={(v) => {
                    field.onChange(v);
                    if (v === 'Single Doctor') {
                      clinicForm.setValue('numDoctors', 1);
                    } else if (v === 'Multi-Doctor' && clinicForm.getValues('numDoctors') < 2) {
                      clinicForm.setValue('numDoctors', Math.max(2, currentDoctorCount));
                    }
                  }}
                  value={field.value}
                  disabled={!isEditingClinic || isPending}
                >
                  <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                  <SelectContent>
                    <SelectItem value="Single Doctor" disabled={currentDoctorCount > 1}>
                      Single Doctor {currentDoctorCount > 1 && "(Not available-Multiple doctors exist)"}
                    </SelectItem>
                    <SelectItem value="Multi-Doctor">Multi-Doctor</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={clinicForm.control} name="numDoctors" render={({ field }) => {
              const minValue = isMultiDoctorClinic ? Math.max(2, currentDoctorCount) : 1;
              const isSingleDoctor = clinicForm.watch('type') === 'Single Doctor';
              return (
                <FormItem>
                  <FormLabel>Number of Doctors Limit</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      {...field}
                      onChange={e => {
                        if (isSingleDoctor) return;
                        const val = Math.max(minValue, parseInt(e.target.value, 10) || 0);
                        field.onChange(val);
                      }}
                      disabled={!isEditingClinic || isSingleDoctor || isPending}
                      value={isSingleDoctor ? 1 : field.value}
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Currently using {currentDoctorCount} of {field.value} available slots.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              );
            }} />

            <FormField control={clinicForm.control} name="clinicRegNumber" render={({ field }) => (
              <FormItem><FormLabel>Registration Number</FormLabel><FormControl><Input {...field} disabled={!isEditingClinic || isPending} /></FormControl><FormMessage /></FormItem>
            )} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={clinicForm.control} name="addressLine1" render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Address Line 1 <span className="text-destructive">*</span></FormLabel>
                  <FormControl><Input placeholder="Street Address" {...field} disabled={!isEditingClinic || isPending} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={clinicForm.control} name="city" render={({ field }) => (
                <FormItem>
                  <FormLabel>City / Town</FormLabel>
                  <FormControl><Input {...field} disabled={!isEditingClinic || isPending} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={clinicForm.control} name="pincode" render={({ field }) => (
                <FormItem>
                  <FormLabel>Pincode</FormLabel>
                  <FormControl><Input {...field} disabled={!isEditingClinic || isPending} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={clinicForm.control} name="mapsLink" render={({ field }) => (
              <FormItem><FormLabel>Google Maps Link</FormLabel><FormControl><Input {...field} disabled={!isEditingClinic || isPending} /></FormControl><FormMessage /></FormItem>
            )} />

            <FormItem>
              <FormLabel>Plan</FormLabel>
              <div><Badge>{clinicDetails?.plan || "Standard"}</Badge></div>
            </FormItem>

            {isEditingClinic && (
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="ghost" onClick={handleCancelClinic} disabled={isPending}>Cancel</Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Changes
                </Button>
              </div>
            )}
          </CardContent>
        </form>
      </Form>
    </Card>
  );
}
