"use client";

import React from "react";
import {
  Stethoscope,
  HeartPulse,
  Baby,
  Sparkles,
  BrainCircuit,
  Bone,
  Award,
  Droplets,
  Filter,
  Droplet,
  Eye,
  Ear,
  Brain,
  PersonStanding,
  Radiation,
  Siren,
  Microwave,
  TestTube,
  Bug,
  Scissors,
  Ambulance,
  Wind,
  type LucideIcon,
} from "lucide-react";

const Pregnant = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 16.5a2.5 2.5 0 1 1-5 0c0-4.5 5-10.5 5-10.5s5 6 5 10.5a2.5 2.5 0 1 1-5 0Z" />
    <path d="M10 16.5a2.5 2.5 0 1 0-5 0c0-4.5-5-10.5-5-10.5s5 6 5 10.5a2.5 2.5 0 1 0-5 0Z" />
    <path d="M8 8a4 4 0 1 0 8 0c0-2.5-4-6-4-6s-4 3.5-4 6Z" />
  </svg>
);

const Tooth = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.3 13.4c.5-1 .5-2.2.1-3.2-.4-1-1.2-1.8-2.2-2.2-.9-.4-2-.5-3-.1-1.1.4-2.1 1.2-2.7 2.2-.6-1-1.6-1.8-2.7-2.2-1.1-.4-2.1-.2-3 .1-1 .4-1.8 1.2-2.2 2.2-.4 1-.4 2.2.1 3.2.5 1 1.2 1.8 2.2 2.2.9.4 2 .5 3 .1 1.1-.4 2.1-1.2 2.7-2.2.6 1 1.6 1.8 2.7 2.2 1 .4 2.1.2 3-.1 1-.4 1.8-1.2 2.2-2.2Z" />
    <path d="m18 13-1.5-3.5" />
    <path d="m6 13 1.5-3.5" />
    <path d="M12 18.5V22" />
    <path d="M9.5 15.5s-1-2-2-2" />
    <path d="M14.5 15.5s1-2 2-2" />
  </svg>
);

const iconMap: Record<string, LucideIcon | React.FC> = {
  Stethoscope, HeartPulse, Baby, Sparkles, BrainCircuit, Bone, Award, Droplets, Filter, Droplet, Eye, Ear, Brain, PersonStanding, Radiation, Siren, Microwave, TestTube, Bug, Scissors, Ambulance, Wind, Pregnant, Tooth
};

export const DynamicIcon = ({ name, className }: { name: string, className: string }) => {
  const IconComponent = iconMap[name] || Stethoscope;
  return <IconComponent className={className} />;
};
