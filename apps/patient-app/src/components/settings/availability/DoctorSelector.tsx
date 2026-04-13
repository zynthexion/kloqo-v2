'use client';

import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Doctor } from '@kloqo/shared';

interface DoctorSelectorProps {
  doctors: Doctor[];
  selectedDoctorId: string | undefined;
  onSelect: (id: string) => void;
}

export function DoctorSelector({ doctors, selectedDoctorId, onSelect }: DoctorSelectorProps) {
  return (
    <div className="space-y-2">
      <Label>Select Doctor</Label>
      <Select onValueChange={onSelect} value={selectedDoctorId}>
        <SelectTrigger className="bg-white">
          <SelectValue placeholder="Select a doctor" />
        </SelectTrigger>
        <SelectContent>
          {doctors.map(doc => (
            <SelectItem key={doc.id} value={doc.id}>Dr. {doc.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
