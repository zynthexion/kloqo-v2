import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as fs from 'fs';
import * as path from 'path';
import { Appointment, Clinic, Doctor } from '@kloqo/shared';

export class PrescriptionPDFService {
  async generate(params: {
    appointment: Appointment;
    clinic: Clinic;
    doctor: Doctor;
    inkBuffer: Buffer;
  }): Promise<Buffer> {
    const { appointment, clinic, doctor, inkBuffer } = params;
    
    // Create Document (A4: 595.28 x 841.89)
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]);
    const { width, height } = page.getSize();
    
    // Fonts
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    // 1. GEOMETRIC HEADER (Teal Polygon)
    // Mental Model: (0,0) is Bottom-Left. Header is at Y = height.
    const tealColor = rgb(0.08, 0.72, 0.65); // #14B8A6
    const headerHeight = 140;
    
    // Path string: Top-Left -> Top-Right (65%) -> Angled Cut -> Bottom-Left -> Close
    const headerPath = `M 0 ${height} L ${width * 0.65} ${height} L ${width * 0.55} ${height - headerHeight} L 0 ${height - headerHeight} Z`;
    page.drawSvgPath(headerPath, { color: tealColor });
    
    // Light gray accent layer in background
    const accentPath = `M ${width * 0.5} ${height} L ${width} ${height} L ${width} ${height - headerHeight} L ${width * 0.6} ${height - headerHeight} Z`;
    page.drawSvgPath(accentPath, { color: rgb(0.96, 0.98, 1.0) }); // slate-50

    // 2. DOCTOR INFORMATION
    page.drawText(`Dr. ${doctor.name}`, {
      x: 50,
      y: height - 65,
      size: 24,
      font: fontBold,
      color: rgb(1, 1, 1),
    });
    
    page.drawText(doctor.department?.toUpperCase() || 'GENERAL MEDICINE', {
      x: 50,
      y: height - 85,
      size: 10,
      font: fontBold,
      color: rgb(0.95, 0.95, 1),
    });
    
    page.drawText(doctor.specialty?.toUpperCase() || 'SPECIALIST', {
      x: 50,
      y: height - 100,
      size: 8,
      font: fontBold,
      color: rgb(0.85, 0.9, 1),
    });

    // 3. CLINIC LOGO
    try {
      const logoPath = path.join(__dirname, '../../../../assets/logo.png');
      if (fs.existsSync(logoPath)) {
        const logoBytes = fs.readFileSync(logoPath);
        const logoImage = await pdfDoc.embedPng(logoBytes);
        const logoDims = logoImage.scale(0.35);
        page.drawImage(logoImage, {
          x: width - logoDims.width - 50,
          y: height - logoDims.height - 40,
          width: logoDims.width,
          height: logoDims.height,
        });
      }
    } catch (e) {
      console.warn('PDF Logo failed to load:', e);
    }

    // 4. PATIENT INFORMATION GRID (Y Offset 180 from top)
    const gridY = height - 180;
    const drawGridItem = (label: string, value: string, x: number, y: number) => {
      page.drawText(label.toUpperCase(), { x, y, size: 7, font: fontBold, color: rgb(0.5, 0.5, 0.6) });
      page.drawText(String(value), { x: x + 60, y, size: 10, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
    };

    drawGridItem('Name:', appointment.patientName, 60, gridY);
    drawGridItem('Weight:', appointment.weight ? `${appointment.weight} Kg` : '-', width / 2 + 20, gridY);
    drawGridItem('Age:', appointment.age?.toString() || '-', 60, gridY - 20);
    drawGridItem('Height:', appointment.height ? `${appointment.height} cm` : '-', width / 2 + 20, gridY - 20);
    drawGridItem('Gender:', appointment.sex || '-', 60, gridY - 40);
    drawGridItem('Date:', new Date().toLocaleDateString('en-GB'), width / 2 + 20, gridY - 40);
    drawGridItem('Contact:', appointment.communicationPhone || '-', 60, gridY - 60);

    // 5. RX WATERMARK
    page.drawText('Rx', {
      x: width / 2 - 120,
      y: height / 2 - 40,
      size: 300,
      font: fontBold,
      color: rgb(0.96, 0.96, 0.96),
      opacity: 0.8,
    });

    // 6. HANDWRITING OVERLAY (INK)
    try {
      const inkImage = await pdfDoc.embedPng(inkBuffer);
      page.drawImage(inkImage, {
        x: 0,
        y: 0,
        width: width,
        height: height,
      });
    } catch (e) {
      console.error('Failed to overlay ink layer:', e);
    }

    // 7. SIGNATURE LINE
    page.drawLine({
      start: { x: width - 200, y: 140 },
      end: { x: width - 50, y: 140 },
      thickness: 1,
      color: rgb(0.1, 0.1, 0.1),
    });
    page.drawText('Signature', {
      x: width - 150,
      y: 125,
      size: 9,
      font: fontBold,
      color: rgb(0.3, 0.3, 0.3),
    });

    // 8. FOOTER
    page.drawText(clinic.name.toUpperCase(), {
      x: 60,
      y: 50,
      size: 16,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.3),
    });
    page.drawText(clinic.address || '', {
      x: 60,
      y: 35,
      size: 8,
      font: fontRegular,
      color: rgb(0.4, 0.4, 0.4),
    });

    return Buffer.from(await pdfDoc.save());
  }
}
