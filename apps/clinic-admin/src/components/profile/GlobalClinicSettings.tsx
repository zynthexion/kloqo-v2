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
import { Edit, Save, Loader2 } from "lucide-react";

interface GlobalClinicSettingsProps {
  clinicDetails: any;
  isEditingSettings: boolean;
  setIsEditingSettings: (editing: boolean) => void;
  isPending: boolean;
  settingsForm: UseFormReturn<any>;
  onSettingsSubmit: (values: any) => void;
  handleCancelSettings: () => void;
}

export function GlobalClinicSettings({
  clinicDetails,
  isEditingSettings,
  setIsEditingSettings,
  isPending,
  settingsForm,
  onSettingsSubmit,
  handleCancelSettings,
}: GlobalClinicSettingsProps) {
  if (!clinicDetails) return <Card><CardHeader><CardTitle>Loading Clinic Settings...</CardTitle></CardHeader></Card>;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Clinic Settings</CardTitle>
          {!isEditingSettings && (
            <Button variant="outline" size="icon" onClick={() => setIsEditingSettings(true)} disabled={isPending}>
              <Edit className="w-4 h-4" />
            </Button>
          )}
        </div>
        <CardDescription>Configure walk-in token allotment and booking preferences.</CardDescription>
      </CardHeader>
      <Form {...settingsForm}>
        <form onSubmit={settingsForm.handleSubmit(onSettingsSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={settingsForm.control}
              name="walkInTokenAllotment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Walk-in Token Allotment</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="2"
                      {...field}
                      onChange={e => field.onChange(parseInt(e.target.value, 10) || 2)}
                      disabled={!isEditingSettings || isPending}
                    />
                  </FormControl>
                  <FormDescription>
                    Allot one walk-in token after every X online tokens.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={settingsForm.control}
              name="tokenDistribution"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Token Distribution Method</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={!isEditingSettings || isPending}
                  >
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="classic">Kloqo Classic (Best for Walk-ins)</SelectItem>
                      <SelectItem value="advanced">Kloqo Advanced (Strict Slot Timing)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={settingsForm.control}
              name="genderPreference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Clinic Gender Preference</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={!isEditingSettings || isPending}
                  >
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="None">No Preference</SelectItem>
                      <SelectItem value="Men">Men Only</SelectItem>
                      <SelectItem value="Women">Women Only</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {isEditingSettings && (
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="ghost" onClick={handleCancelSettings} disabled={isPending}>Cancel</Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Settings
                </Button>
              </div>
            )}
          </CardContent>
        </form>
      </Form>
    </Card>
  );
}
