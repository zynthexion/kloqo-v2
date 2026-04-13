"use client";

import { UseFormReturn } from "react-hook-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Edit, Save, Loader2 } from "lucide-react";
import type { User } from '@kloqo/shared';

interface ProfileSettingsProps {
  userProfile: User | null;
  isEditingProfile: boolean;
  setIsEditingProfile: (editing: boolean) => void;
  isPending: boolean;
  profileForm: UseFormReturn<any>;
  passwordForm: UseFormReturn<any>;
  onProfileSubmit: (values: any) => void;
  onPasswordSubmit: (values: any) => void;
  handleCancelProfile: () => void;
}

export function ProfileSettings({
  userProfile,
  isEditingProfile,
  setIsEditingProfile,
  isPending,
  profileForm,
  passwordForm,
  onProfileSubmit,
  onPasswordSubmit,
  handleCancelProfile,
}: ProfileSettingsProps) {
  if (!userProfile) {
    return <Card><CardHeader><CardTitle>Loading Profile...</CardTitle></CardHeader></Card>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Login & Personal Information</CardTitle>
          {!isEditingProfile && (
            <Button variant="outline" size="icon" onClick={() => setIsEditingProfile(true)} disabled={isPending}>
              <Edit className="w-4 h-4" />
            </Button>
          )}
        </div>
        <CardDescription>Your personal and login information.</CardDescription>
      </CardHeader>
      <Form {...profileForm}>
        <form onSubmit={profileForm.handleSubmit(onProfileSubmit)}>
          <CardContent className="space-y-4">
            <FormField control={profileForm.control} name="name" render={({ field }) => (
              <FormItem>
                <FormLabel>Admin Name</FormLabel>
                <FormControl><Input {...field} disabled={!isEditingProfile || isPending} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <FormItem>
              <FormLabel>Email Address</FormLabel>
              <Input type="email" value={userProfile?.email || ""} disabled />
            </FormItem>
            <FormField control={profileForm.control} name="phone" render={({ field }) => (
              <FormItem>
                <FormLabel>Phone</FormLabel>
                <FormControl><Input {...field} disabled={!isEditingProfile || isPending} /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            {isEditingProfile && (
              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="ghost" onClick={handleCancelProfile} disabled={isPending}>Cancel</Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Changes
                </Button>
              </div>
            )}
          </CardContent>
        </form>
      </Form>
      <Separator />
      <CardFooter className="pt-6">
        <Form {...passwordForm}>
          <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="w-full space-y-4">
            <p className="font-medium text-sm">Change Password</p>
            <FormField control={passwordForm.control} name="currentPassword" render={({ field }) => (
              <FormItem><FormLabel>Current Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={passwordForm.control} name="newPassword" render={({ field }) => (
              <FormItem><FormLabel>New Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <FormField control={passwordForm.control} name="confirmPassword" render={({ field }) => (
              <FormItem><FormLabel>Confirm New Password</FormLabel><FormControl><Input type="password" {...field} /></FormControl><FormMessage /></FormItem>
            )} />
            <Button type="submit" variant="secondary" className="w-full" disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Set New Password
            </Button>
          </form>
        </Form>
      </CardFooter>
    </Card>
  );
}
