# Future Work: Backend Final Polish (Enterprise Grade)

Elevate the generated medical document from a basic composite to a professional, verifiable medical prescription.

## User Review Required

> [!IMPORTANT]
> **QR Code Entrypoint**: Add a QR code that encodes the public prescription URL. This allows pharmacists or patients to scan the physical paper and verify the digital original, enhancing trust and compliance.

## Proposed Changes

### [backend]

#### [MODIFY] [PrescriptionPDFService.ts](file:///Users/jinodevasia/Desktop/Kloqo-Production%20copy/kloqo-v2/backend/src/infrastructure/pdf/PrescriptionPDFService.ts)
- **QR Code Integration**:
    - Import `qrcode` and generate a Data URL buffer of the `prescriptionUrl`.
    - Embed and draw the QR code in the footer area (bottom-right).
- **Geometric Refinement**:
    - Add a subtle secondary colored line beneath the primary Teal Header for a more "designed" look.
    - Soften the Rx Watermark further (`opacity: 0.05` instead of `0.08`) to ensure even light pen strokes are clearly visible over it.
- **Dynamic Context**:
    - Ensure the service accepts the `prescriptionUrl` to bake it into the QR code.

#### [MODIFY] [CompleteAppointmentWithPrescriptionUseCase.ts](file:///Users/jinodevasia/Desktop/Kloqo-Production%20copy/kloqo-v2/backend/src/application/CompleteAppointmentWithPrescriptionUseCase.ts)
- **Sequencing Logic**:
    - Since we need the `downloadURL` *before* we generate the PDF (to put it in the QR code), pre-calculate the Firebase Storage URL (it's predictable), generate the PDF with the QR code, then upload both.

## Verification Plan

### Manual Verification
- **QR Scan**: Scan the generated PDF with a phone to verify it opens the correct storage link.
- **Visual Audit**: Confirm the document looks "premium" and the watermark is non-obstructive.
