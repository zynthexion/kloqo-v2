
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, CheckCircle } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const formSchema = z.object({
    name: z.string().min(2, { message: "Name must be at least 2 characters." }),
    age: z.coerce.number().int().positive({ message: "Age must be a positive number." }).min(1, { message: "Please enter a valid age." }),
    place: z.string().min(2, { message: "Place is required." }),
    phone: z.string()
        .refine((val) => {
            if (!val || val.length === 0) return false;
            const cleaned = val.replace(/^\+91/, '').replace(/\D/g, ''); 
            return cleaned.length === 10;
        }, {
            message: "Please enter exactly 10 digits for the phone number."
        }),
    sex: z.string().min(1, { message: "Sex is required." }),
});

export default function PatientRegistrationForm() {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);
    const searchParams = useSearchParams();
    const { toast } = useToast();
    const [clinicId, setClinicId] = useState<string | null>(null);

    useEffect(() => {
        const id = searchParams.get('clinicId');
        if (id) {
            setClinicId(id);
        } else {
            toast({ variant: 'destructive', title: 'Error', description: 'Clinic ID is missing from the link.' });
        }
    }, [searchParams, toast]);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: '',
            age: undefined,
            place: '',
            phone: '',
            sex: '',
        },
    });

    async function onSubmit(values: z.infer<typeof formSchema>) {
        if (!clinicId) {
            toast({ variant: 'destructive', title: 'Error', description: 'Cannot register patient without a clinic ID.' });
            return;
        }
        setIsSubmitting(true);
        try {
            const cleaned = values.phone.replace(/^\+91/, '').replace(/\D/g, '');
            const fullPhoneNumber = `+91${cleaned}`;

            const response = await fetch(`${API_URL}/patients/manage`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: values.name,
                    age: values.age,
                    place: values.place,
                    phone: fullPhoneNumber,
                    sex: values.sex,
                    clinicId,
                    isLinkPending: false
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Registration failed');
            }

            setIsSubmitted(true);
        } catch (error: any) {
            console.error('Patient registration failed:', error);
            toast({
                variant: 'destructive',
                title: 'Registration Failed',
                description: error.message || 'An unexpected error occurred.'
            });
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-muted/20 p-4">
            <Card className="w-full max-w-sm rounded-2xl border bg-card shadow-lg">
                <CardHeader className="text-center">
                    <CardTitle className="text-2xl font-bold">Walk-in Registration</CardTitle>
                    <CardDescription>
                        Please enter your details to register for your appointment.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isSubmitted ? (
                        <div className="flex flex-col items-center justify-center text-center gap-4 py-8">
                            <CheckCircle className="h-16 w-16 text-green-500" />
                            <h2 className="text-xl font-semibold">Registration Complete!</h2>
                            <p className="text-muted-foreground">
                                Thank you. You can now close this window. Your token will be generated by the receptionist.
                            </p>
                        </div>
                    ) : (
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Full Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. Jane Smith" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="age"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Age</FormLabel>
                                            <FormControl>
                                                <Input type="number" placeholder="e.g. 34" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="phone"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Phone Number</FormLabel>
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
                                                            let value = e.target.value.replace(/\D/g, '');
                                                            value = value.replace(/^91/, '');
                                                            if (value.length > 10) value = value.slice(0, 10);
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
                                    name="sex"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Sex</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select sex" />
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
                                <FormField
                                    control={form.control}
                                    name="place"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Place</FormLabel>
                                            <FormControl>
                                                <Input placeholder="e.g. Cityville" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <Button type="submit" className="w-full mt-6 bg-[#256cad] hover:bg-[#256cad]/90 text-white" disabled={isSubmitting || !clinicId}>
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Submitting...
                                        </>
                                    ) : (
                                        'Submit Registration'
                                    )}
                                </Button>
                            </form>
                        </Form>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
