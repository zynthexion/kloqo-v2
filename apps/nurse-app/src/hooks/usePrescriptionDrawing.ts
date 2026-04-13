'use client';

import { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { getStroke } from 'perfect-freehand';
import { format } from 'date-fns';
import { Doctor, Clinic, Patient, Appointment } from '@kloqo/shared';

interface Stroke {
  points: number[][];
  color: string;
  width: number;
}

interface UsePrescriptionDrawingOptions {
  doctor: Doctor;
  clinic: Clinic;
  patient: Patient;
  appointment: Appointment;
}

export function usePrescriptionDrawing({ 
  doctor, 
  clinic, 
  patient, 
  appointment 
}: UsePrescriptionDrawingOptions) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<number[][] | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const strokeOptions = useMemo(() => ({
    size: 2.5,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
  }), []);

  const getSvgPathFromStroke = useCallback((stroke: number[][]) => {
    if (!stroke.length) return "";
    const outlinePoints = getStroke(stroke, strokeOptions);
    const d = outlinePoints.reduce(
      (acc, [x, y], i) => {
        if (i === 0) acc.push("M", x, y, "Q");
        else acc.push(x, y);
        return acc;
      },
      [] as any[]
    );
    d.push("Z");
    return d.join(" ");
  }, [strokeOptions]);

  const drawMetadata = useCallback((ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const margin = 60;
    const headerHeight = 160;
    
    // Header Background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, headerHeight);
    
    // Doctor Details (Left)
    ctx.textAlign = 'left';
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 28px "Inter", "PT Sans", sans-serif';
    ctx.fillText(doctor.name.toUpperCase(), margin, 50);
    
    ctx.font = '700 16px "Inter", "PT Sans", sans-serif';
    ctx.fillStyle = '#334155';
    ctx.fillText(doctor.qualifications || 'MBBS, MD', margin, 75);
    
    ctx.font = '600 14px "Inter", "PT Sans", sans-serif';
    ctx.fillStyle = '#64748b';
    ctx.fillText(`Reg No: ${doctor.registrationNumber || 'NMC/12345/ABC'}`, margin, 95);

    // Clinic Details (Right)
    ctx.textAlign = 'right';
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 20px "Inter", "PT Sans", sans-serif';
    ctx.fillText(clinic.name, width - margin, 50);
    
    ctx.font = '500 13px "Inter", "PT Sans", sans-serif';
    ctx.fillStyle = '#64748b';
    const addr = clinic.address || '123 Medical Square, Healthcare City';
    const addrLines = addr.match(/.{1,45}/g) || [addr];
    addrLines.forEach((line, i) => {
      ctx.fillText(line, width - margin, 75 + (i * 18));
    });
    
    ctx.font = '700 13px "Inter", "PT Sans", sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(`Contact: ${clinic.pharmacyPhone || (clinic as any).phone || ''}`, width - margin, 75 + (addrLines.length * 18) + 5);

    // Separator Line
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(margin, headerHeight - 10);
    ctx.lineTo(width - margin, headerHeight - 10);
    ctx.stroke();

    // Patient Block
    const pbTop = headerHeight + 10;
    ctx.textAlign = 'left';
    
    const patientFields = [
      { label: 'PATIENT NAME', value: patient.name.toUpperCase() },
      { label: 'AGE / SEX', value: `${patient.age || 'N/A'}Y / ${patient.sex || 'N/A'}` },
      { label: 'DATE', value: format(new Date(), 'dd MMM yyyy') },
      { label: 'WEIGHT / HEIGHT', value: `${patient.weight || '-'} kg / ${patient.height || '-'} cm` },
      { label: 'TOKEN ID', value: `#${appointment.tokenNumber}` }
    ];

    const colWidth = (width - (margin * 2)) / 3;
    
    patientFields.forEach((field, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = margin + (col * colWidth);
      const y = pbTop + (row * 60);

      ctx.font = '800 11px "Inter", "PT Sans", sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(field.label, x, y + 20);

      ctx.font = '800 16px "Inter", "PT Sans", sans-serif';
      ctx.fillStyle = '#1e293b';
      ctx.fillText(field.value, x, y + 42);
    });

    // Rx Symbol
    ctx.font = 'italic 700 64px "Georgia", "serif"';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('Rx', margin, pbTop + 140);

    // Footer / Signature
    const footerTop = height - 150;
    ctx.textAlign = 'center';
    
    ctx.strokeStyle = '#cbd5e1';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(width - 300, footerTop + 60);
    ctx.lineTo(width - margin, footerTop + 60);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = '900 14px "Inter", sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.fillText(doctor.name.toUpperCase(), width - 175, footerTop + 85);
    
    ctx.font = '700 11px "Inter", sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`Reg No: ${doctor.registrationNumber || ''}`, width - 175, footerTop + 105);
    
    ctx.font = '600 10px "Inter", sans-serif';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText('Digital Prescription Signature / Stamp', width - 175, footerTop + 125);
    
    ctx.textAlign = 'left';
  }, [doctor, clinic, patient, appointment]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawMetadata(ctx, canvas.width, canvas.height);

    // Grid Layout
    const startGridAt = 220;
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 1;
    for (let i = startGridAt; i < canvas.height - 120; i += 35) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }

    ctx.fillStyle = '#1e1b4b';

    strokes.forEach((stroke) => {
      const pathData = getSvgPathFromStroke(stroke.points);
      const path = new Path2D(pathData);
      ctx.fill(path);
    });

    if (currentStroke) {
      const pathData = getSvgPathFromStroke(currentStroke);
      const path = new Path2D(pathData);
      ctx.fill(path);
    }
  }, [strokes, currentStroke, drawMetadata, getSvgPathFromStroke]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  useEffect(() => {
    const handleResize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const parent = canvas.parentElement;
      if (!parent) return;
      
      const targetWidth = 1200;
      const ratio = parent.clientHeight / parent.clientWidth;
      
      canvas.width = targetWidth;
      canvas.height = targetWidth * ratio;
      
      canvas.style.width = `${parent.clientWidth}px`;
      canvas.style.height = `${parent.clientHeight}px`;
      
      redraw();
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [redraw]);

  const onPointerDown = (e: React.PointerEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsDrawing(true);
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    setCurrentStroke([[(e.clientX - rect.left) * scale, (e.clientY - rect.top) * scale, e.pressure]]);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDrawing || !currentStroke) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    setCurrentStroke([...currentStroke, [(e.clientX - rect.left) * scale, (e.clientY - rect.top) * scale, e.pressure]]);
  };

  const onPointerUp = () => {
    if (currentStroke) {
      setStrokes([...strokes, { points: currentStroke, color: '#1e1b4b', width: 2.5 }]);
    }
    setCurrentStroke(null);
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    if (confirm('Are you sure you want to clear this prescription?')) {
      setStrokes([]);
      setCurrentStroke(null);
    }
  };

  const getBlob = async (quality: number = 0.85): Promise<Blob | null> => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    if (strokes.length === 0) return null;
    
    return new Promise((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
    });
  };

  return {
    canvasRef,
    clearCanvas,
    getBlob,
    hasDrawing: strokes.length > 0,
    pointerHandlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerLeave: onPointerUp,
    }
  };
}
