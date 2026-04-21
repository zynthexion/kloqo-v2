import React from 'react';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { FormValues } from '@/hooks/use-phone-booking-details';

interface PatientRegistrationFormProps {
  form: UseFormReturn<FormValues>;
  onSubmit: (values: FormValues) => void;
  isSubmitting: boolean;
  selectedPatient: any | null;
  primaryPatient: any | null;
  toast: any;
}

export const PatientRegistrationForm: React.FC<PatientRegistrationFormProps> = ({
  form,
  onSubmit,
  isSubmitting,
  selectedPatient,
  primaryPatient,
  toast
}) => {
  return (
    <Form {...(form as any)}>
      <form 
        onSubmit={form.handleSubmit(onSubmit, (errors) => {
          console.error("Form Validation Errors:", errors);
          const firstError = Object.values(errors)[0] as any;
          if (firstError?.message) {
            toast({ variant: 'destructive', title: 'Form Error', description: firstError.message });
          }
        })} 
        className="space-y-4 pb-10 animate-in fade-in slide-in-from-bottom-4"
      >
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-6">
          {(!primaryPatient || selectedPatient) && (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none">
                  {selectedPatient ? 'Edit Selected Profile' : 'Register New Patient'}
                </h2>
                <span className="text-[10px] font-black bg-theme-blue/10 text-theme-blue px-2 py-1 rounded-full uppercase tracking-tight">
                  Verify Details
                </span>
              </div>

              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="patientName"
                  render={({ field }) => (
                    <FormItem>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                      <FormControl>
                        <Input placeholder="Patient's full name" {...field} className="h-12 rounded-xl bg-slate-50 border-slate-100 font-bold" />
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4 border-y border-slate-50 py-4 my-2">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                    <FormItem>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                          Account Phone <span className="text-slate-300 normal-case font-normal">(optional for relatives)</span>
                        </label>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">+91</span>
                            <Input placeholder="Blank ok for relatives" {...field} className="h-12 pl-10 rounded-xl bg-slate-50 border-slate-100 font-bold" />
                          </div>
                        </FormControl>
                        <FormMessage className="text-[10px]" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="communicationPhone"
                    render={({ field }) => (
                      <FormItem>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">WhatsApp No.</label>
                        <FormControl>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400">+91</span>
                            <Input placeholder="Same as primary" {...field} className="h-12 pl-10 rounded-xl bg-slate-50 border-slate-100 font-bold" />
                          </div>
                        </FormControl>
                        <FormMessage className="text-[10px]" />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="age"
                    render={({ field }) => (
                      <FormItem>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Age (Years)</label>
                        <FormControl>
                          <Input type="number" placeholder="Years" {...field} className="h-12 rounded-xl bg-slate-50 border-slate-100 font-bold" />
                        </FormControl>
                        <FormMessage className="text-[10px]" />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sex"
                    render={({ field }) => (
                      <FormItem>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Gender</label>
                        <Select onValueChange={field.onChange} defaultValue={field.value} key={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12 rounded-xl bg-slate-50 border-slate-100 font-bold">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-2xl border-slate-100 shadow-xl">
                            <SelectItem value="Male" className="font-bold">Male</SelectItem>
                            <SelectItem value="Female" className="font-bold">Female</SelectItem>
                            <SelectItem value="Other" className="font-bold">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-[10px]" />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="place"
                  render={({ field }) => (
                    <FormItem>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">City / Area</label>
                      <FormControl>
                        <Input placeholder="Location" {...field} className="h-12 rounded-xl bg-slate-50 border-slate-100 font-bold" />
                      </FormControl>
                      <FormMessage className="text-[10px]" />
                    </FormItem>
                  )}
                />
              </div>
            </>
          )}
        </div>

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full h-16 rounded-3xl bg-theme-blue hover:bg-theme-blue/90 text-white font-black text-lg shadow-xl shadow-theme-blue/20 transition-all active:scale-[0.98] mt-4 flex items-center justify-center gap-3"
        >
          {isSubmitting ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : (
            <>
              <span>Proceed to Selection</span>
              <ArrowLeft className="h-5 w-5 rotate-180" />
            </>
          )}
        </Button>
      </form>
    </Form>
  );
};
