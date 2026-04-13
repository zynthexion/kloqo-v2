"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from '@/contexts/language-context';
import { Patient } from "@kloqo/shared";
import { apiRequest } from "@/lib/api-client";

const formSchema = z.object({
  name: z.string()
    .min(3, { message: "Name must be at least 3 characters." })
    .regex(/^[a-zA-Z\s]+$/, { message: "Name must contain only alphabets and spaces." })
    .refine(name => !name.startsWith(' ') && !name.endsWith(' ') && !name.includes('  '), {
      message: "Spaces are only allowed between letters, not at the start, end, or multiple consecutive spaces."
    }),
  age: z.coerce.number({ required_error: "Age is required.", invalid_type_error: "Age must be a number." })
    .min(1, { message: "Age must be a positive number above zero." })
    .max(120, { message: "Age must be less than 120." }),
  sex: z.enum(["Male", "Female", "Other"], { required_error: "Please select a gender." }),
  phone: z.string()
    .optional()
    .refine((val) => {
      if (!val || val.length === 0) return true;
      const cleaned = val.replace(/^\+91/, '').replace(/\D/g, '');
      return cleaned.length === 10;
    }, {
      message: "Phone number must be exactly 10 digits."
    }),
  place: z.string().min(2, { message: "Location is required." }),
});

type AddRelativeFormValues = {
  name: string;
  age: number;
  sex: "Male" | "Female" | "Other";
  place: string;
  phone?: string;
};

type AddRelativeDialogProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  primaryPatientPhone: string;
  clinicId: string | null;
  onRelativeAdded: (newRelative: Patient) => void;
  genderPreference?: 'Men' | 'Women' | 'General';
};

export function AddRelativeDialog({
  isOpen,
  setIsOpen,
  primaryPatientPhone,
  onRelativeAdded,
  clinicId,
  genderPreference,
}: AddRelativeDialogProps) {
  const { t } = useLanguage();
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const form = useForm<AddRelativeFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      age: undefined,
      sex: genderPreference === 'Men' ? 'Male' : (genderPreference === 'Women' ? 'Female' : 'Male'),
      phone: "",
      place: "",
    },
  });

  const onSubmit = (values: AddRelativeFormValues) => {
    startTransition(async () => {
      if (!primaryPatientPhone || !clinicId) {
        toast({ variant: 'destructive', title: t.common.error, description: t.patientForm.patientCreationFailed });
        return;
      }

      try {
        const newRelative = await apiRequest<Patient>('/patients/add-relative', {
          method: 'POST',
          body: JSON.stringify({
            primaryPatientPhone,
            clinicId,
            relative: values
          })
        });

        onRelativeAdded(newRelative);

        toast({
          title: t.messages.success,
          description: t.patientForm.tokenGenerated,
        });
        setIsOpen(false);
        form.reset();
      } catch (error: any) {
        console.error("Error adding relative:", error);
        toast({
          variant: "destructive",
          title: t.common.error,
          description: error.message || t.patientForm.patientCreationFailed,
        });
      }
    });
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setIsOpen(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        onInteractOutside={(e) => {
          e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t.bookAppointment.addNewPatient}</DialogTitle>
          <DialogDescription>
            {t.patientForm.newPatientDetails}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.patientForm.name}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t.patientForm.enterPatientName}
                      {...field}
                      value={field.value || ''}
                      onChange={(e) => {
                        field.onChange(e);
                        form.trigger('name');
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="age"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.patientForm.age}</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder={t.patientForm.enterAge}
                        {...field}
                        value={field.value?.toString() ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || /^\d+$/.test(val)) {
                            field.onChange(val);
                            form.trigger('age');
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sex"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t.patientForm.gender}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t.patientForm.selectGender} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Male">{t.patientForm.male}</SelectItem>
                        <SelectItem value="Female">{t.patientForm.female}</SelectItem>
                        <SelectItem value="Other">{t.patientForm.other}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.patientForm.phone} ({t.common.optional})</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">+91</span>
                      <Input
                        type="tel"
                        {...field}
                        value={field.value || ''}
                        className="pl-12"
                        placeholder={t.patientForm.phonePlaceholder}
                        onChange={(e) => {
                          let value = e.target.value.replace(/\D/g, '');
                          value = value.replace(/^91/, '');
                          if (value.length > 10) {
                            value = value.slice(0, 10);
                          }
                          field.onChange(value);
                        }}
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="place"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t.patientForm.place}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t.patientForm.enterPlace}
                      {...field}
                      value={field.value || ''}
                      onChange={(e) => {
                        field.onChange(e);
                        form.trigger('place');
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                {t.common.cancel}
              </Button>
              <Button type="submit" disabled={isPending || !form.formState.isValid}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t.patientForm.saveChanges}
              </Button>
            </DialogFooter>

          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
