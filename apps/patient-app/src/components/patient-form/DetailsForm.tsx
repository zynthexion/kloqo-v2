import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLanguage } from '@/contexts/language-context';

export function DetailsForm({ form, isEditingPrimary, disablePhoneEditing }: any) {
    const { t } = useLanguage();
    const pt = t.patientForm as any;

    return (
        <div className="space-y-4">
            <h3 className="font-medium text-slate-800 border-b pb-2">{pt.patientDetails || 'Patient Details'}</h3>
            <div className="grid grid-cols-2 gap-4">
                <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                        <FormItem className="col-span-2">
                            <FormLabel className="text-slate-700 font-medium">{pt.patientFullName || 'Patient Full Name'}</FormLabel>
                            <FormControl>
                                <Input
                                    placeholder={pt.namePlaceholder || 'Name'}
                                    {...field}
                                    className="h-12 bg-white border-slate-200 focus:border-theme-blue focus:ring-theme-blue capitalize transition-colors"
                                />
                            </FormControl>
                            <FormMessage className="text-red-500 font-medium text-xs mt-1" />
                        </FormItem>
                    )}
                />
                
                <FormField
                    control={form.control}
                    name="age"
                    render={({ field: { value, onChange, ...fieldProps } }) => (
                        <FormItem>
                            <FormLabel className="text-slate-700 font-medium">{pt.age || 'Age'}</FormLabel>
                            <FormControl>
                                <Input
                                    type="number"
                                    placeholder="25"
                                    min="1"
                                    max="120"
                                    {...fieldProps}
                                    value={value === undefined ? "" : value}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        onChange(val === "" ? undefined : Number(val));
                                    }}
                                    className="h-12 bg-white border-slate-200 focus:border-theme-blue focus:ring-theme-blue transition-colors"
                                />
                            </FormControl>
                            <FormMessage className="text-red-500 font-medium text-xs mt-1" />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="sex"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel className="text-slate-700 font-medium">{pt.sex || 'Gender'}</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ""} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger className="h-12 bg-white border-slate-200 focus:border-theme-blue focus:ring-theme-blue transition-colors">
                                        <SelectValue placeholder={pt.select || 'Select'} />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent className="bg-white border-slate-100 shadow-xl rounded-xl">
                                    <SelectItem value="Male" className="focus:bg-slate-50">{pt.male || 'Male'}</SelectItem>
                                    <SelectItem value="Female" className="focus:bg-slate-50">{pt.female || 'Female'}</SelectItem>
                                    <SelectItem value="Other" className="focus:bg-slate-50">{pt.other || 'Other'}</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage className="text-red-500 font-medium text-xs mt-1" />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                        <FormItem className="col-span-2">
                            <FormLabel className="text-slate-700 font-medium">
                                {pt.mobileNumber || 'Mobile Number'}
                                <span className="text-slate-400 text-xs font-normal ml-2">({pt.whatsAppSms || 'WhatsApp/SMS'})</span>
                            </FormLabel>
                            <div className="relative flex items-center">
                                <span className="absolute left-4 text-slate-500 font-medium">+91</span>
                                <FormControl>
                                    <Input
                                        placeholder="9876543210"
                                        maxLength={10}
                                        {...field}
                                        disabled={disablePhoneEditing}
                                        className="h-12 pl-12 bg-white border-slate-200 focus:border-theme-blue focus:ring-theme-blue tracking-wider transition-colors disabled:bg-slate-50 disabled:text-slate-500"
                                    />
                                </FormControl>
                            </div>
                            <FormMessage className="text-red-500 font-medium text-xs mt-1" />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="place"
                    render={({ field }) => (
                        <FormItem className="col-span-2">
                            <FormLabel className="text-slate-700 font-medium">{pt.place || 'Place'}</FormLabel>
                            <FormControl>
                                <Input
                                    placeholder={pt.placePlaceholder || 'City'}
                                    {...field}
                                    className="h-12 bg-white border-slate-200 focus:border-theme-blue focus:ring-theme-blue capitalize transition-colors"
                                />
                            </FormControl>
                            <FormMessage className="text-red-500 font-medium text-xs mt-1" />
                        </FormItem>
                    )}
                />
            </div>
        </div>
    );
}
