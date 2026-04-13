

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
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/api-client";
import type { Patient } from '@kloqo/shared';

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

type AddRelativeFormValues = z.infer<typeof formSchema>;

type AddRelativeDialogProps = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  primaryMemberId: string;
  onRelativeAdded: (newRelative: Patient) => void;
};

export function AddRelativeDialog({
  isOpen,
  setIsOpen,
  primaryMemberId,
  onRelativeAdded,
}: AddRelativeDialogProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const clinicId = currentUser?.clinicId;

  const form = useForm<AddRelativeFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      age: undefined,
      sex: undefined,
      phone: "",
      place: "",
    },
  });

  const onSubmit = (values: AddRelativeFormValues) => {
    if (!clinicId) return;

    startTransition(async () => {
      try {
        const result = await apiRequest<Patient>('/patients/add-relative', {
          method: 'POST',
          body: JSON.stringify({
            primaryPatientId: primaryMemberId,
            clinicId,
            relative: values
          }),
        });

        onRelativeAdded(result);

        toast({
          title: "Relative Added",
          description: `${values.name} has been added to the family.`,
        });
        setIsOpen(false);
        form.reset();
      } catch (error: any) {
        console.error("Error adding relative:", error);
        toast({
          variant: "destructive",
          title: "Error",
          description: error.message || "Failed to add relative. Please try again.",
        });
      }
    });
  };

  const handleOpenChange = (open: boolean) => {
    // Only close when explicitly requested (via Cancel or close button), not on outside click
    if (!open) {
      setIsOpen(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        onInteractOutside={(e) => {
          e.preventDefault(); // Prevent closing when clicking outside
        }}
        onEscapeKeyDown={(e) => {
          e.preventDefault(); // Prevent closing with ESC key - only close via Cancel or close button
        }}
      >
        <DialogHeader>
          <DialogTitle>Add New Relative</DialogTitle>
          <DialogDescription>
            Enter the details for the new family member.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter full name"
                      {...field}
                      value={field.value || ''}
                      onBlur={field.onBlur}
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
                    <FormLabel>Age</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="Enter the age"
                        {...field}
                        value={field.value?.toString() ?? ''}
                        onBlur={field.onBlur}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '' || /^\d+$/.test(val)) {
                            field.onChange(val);
                            form.trigger('age');
                          }
                        }}
                        className="[&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [-moz-appearance:textfield]"
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
                    <FormLabel>Gender</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
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
                  <FormLabel>Phone Number (Optional)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">+91</span>
                      <Input
                        type="tel"
                        {...field}
                        value={field.value || ''}
                        className="pl-12"
                        placeholder="Enter 10-digit number"
                        onChange={(e) => {
                          // Only allow digits, max 10 digits
                          let value = e.target.value.replace(/\D/g, ''); // Remove all non-digits
                          // Remove +91 if user tries to enter it manually
                          value = value.replace(/^91/, '');
                          // Limit to 10 digits
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
                  <FormLabel>Place</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter city or town"
                      {...field}
                      value={field.value || ''}
                      onBlur={field.onBlur}
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
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || !form.formState.isValid}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Relative
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
