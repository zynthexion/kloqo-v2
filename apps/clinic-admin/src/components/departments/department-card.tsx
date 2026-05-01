"use client";

import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, Users, Trash } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DynamicIcon } from "./dynamic-icon";
import type { Department } from "@kloqo/shared";

interface DepartmentCardProps {
  department: Department;
  doctorsInDept: string[];
  getDoctorAvatar: (name: string) => string;
  onViewDoctors: (dept: Department) => void;
  onDelete: (dept: Department) => void;
}

export function DepartmentCard({
  department,
  doctorsInDept,
  getDoctorAvatar,
  onViewDoctors,
  onDelete,
}: DepartmentCardProps) {
  return (
    <Card className="overflow-hidden flex flex-col aspect-square">
      <div className="h-2/3 w-full flex items-center justify-center bg-muted/30">
        <DynamicIcon name={department.icon} className="w-16 h-16 text-muted-foreground opacity-50" />
      </div>
      <CardContent className="p-3 flex-grow flex flex-col justify-center">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-base font-semibold truncate">{department.name}</h3>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-6 w-6 p-0">
                <span className="sr-only">Open menu</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onViewDoctors(department)}>
                <Users className="mr-2 h-4 w-4" />
                See All Doctors
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onDelete(department)} className="text-red-600">
                <Trash className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <div className="flex items-center mt-1">
          <div className="flex -space-x-2">
            {doctorsInDept.slice(0, 3).map((doctorName, index) => {
              const avatarUrl = getDoctorAvatar(doctorName);
              return (
                <div key={index} className="relative">
                  <Image
                    src={avatarUrl || '/default-doctor.png'}
                    alt={doctorName}
                    width={24}
                    height={24}
                    className="w-6 h-6 rounded-full border-2 border-white object-cover"
                    unoptimized={true}
                  />
                </div>
              );
            })}
          </div>
          {doctorsInDept.length > 0 ? (
            <span className="text-xs text-muted-foreground ml-2 truncate">
              {doctorsInDept.length} {doctorsInDept.length > 1 ? 'doctors' : 'doctor'}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">No doctors</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
