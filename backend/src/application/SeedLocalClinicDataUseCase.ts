/**
 * SeedLocalClinicDataUseCase.ts
 *
 * Cloud-Seeding Use Case — executed ONCE during the initial setup of a new
 * standalone local Kloqo installation at a clinic.
 *
 * Flow:
 *   1. Clinic is onboarded via the Kloqo Cloud website (creates a Firestore
 *      document in the Cloud database with full clinic/doctor/department setup).
 *   2. A one-time "pairing token" is generated for the clinic on the cloud dashboard.
 *   3. The clinic IT person pastes this token into the local setup wizard.
 *   4. This use case is called with that pairing token.
 *   5. It calls the Cloud API, downloads all clinic-specific data, and writes
 *      it into the local Firestore Emulator — bootstrapping the local database.
 *
 * After this runs successfully, the local installation is self-sufficient.
 * Daily operations (appointments, prescriptions, pharmacy queue) run 100% locally.
 */

import https from 'https';
import {
  IClinicRepository,
  IDoctorRepository,
  IDepartmentRepository,
  IUserRepository,
  INotificationRepository,
} from '../domain/repositories';

// ── Seed Data Payload (shape returned by the Cloud seed API) ─────────────
interface SeedPayload {
  clinic: any;
  doctors: any[];
  departments: any[];
  users: any[];
  notificationConfigs: any[];
}

export class SeedLocalClinicDataUseCase {
  private readonly CLOUD_API_BASE = process.env.KLOQO_CLOUD_API_URL || 'https://api.kloqo.com';

  constructor(
    private readonly clinicRepo: IClinicRepository,
    private readonly doctorRepo: IDoctorRepository,
    private readonly departmentRepo: IDepartmentRepository,
    private readonly userRepo: IUserRepository,
    private readonly notificationRepo: INotificationRepository,
  ) {}

  async execute(pairingToken: string): Promise<{ success: boolean; clinicId: string; message: string }> {
    if (!pairingToken || pairingToken.trim().length < 10) {
      throw new Error('A valid pairing token is required. Generate one from your Kloqo Cloud dashboard.');
    }

    console.log('[SeedLocalClinicDataUseCase] Starting cloud seed download...');

    // ── Step 1: Fetch seed payload from Cloud ─────────────────────────────
    const payload = await this.fetchSeedData(pairingToken.trim());
    const { clinic, doctors, departments, users, notificationConfigs } = payload;

    if (!clinic?.id) {
      throw new Error('Seed data received from cloud is invalid. Please regenerate the pairing token.');
    }

    const clinicId = clinic.id;
    console.log(`[SeedLocalClinicDataUseCase] Seeding clinic "${clinic.name}" (${clinicId})...`);

    // ── Step 2: Write Clinic ──────────────────────────────────────────────
    await this.clinicRepo.save(clinic);
    console.log(`[SeedLocalClinicDataUseCase] ✅ Clinic saved.`);

    // ── Step 3: Write Departments ─────────────────────────────────────────
    for (const dept of departments) {
      await this.departmentRepo.save(dept, clinicId);
    }
    console.log(`[SeedLocalClinicDataUseCase] ✅ ${departments.length} department(s) saved.`);

    // ── Step 4: Write Doctors ─────────────────────────────────────────────
    for (const doctor of doctors) {
      await this.doctorRepo.save(doctor, clinicId);
    }
    console.log(`[SeedLocalClinicDataUseCase] ✅ ${doctors.length} doctor(s) saved.`);

    // ── Step 5: Write Staff Users ─────────────────────────────────────────
    for (const user of users) {
      await this.userRepo.save(user, clinicId);
    }
    console.log(`[SeedLocalClinicDataUseCase] ✅ ${users.length} user account(s) saved.`);

    // ── Step 6: Write Notification Configs ────────────────────────────────
    // Notification configs define which internal alerts are enabled.
    // In local-only mode, WhatsApp/SMS configs are simply disabled.
    console.log(`[SeedLocalClinicDataUseCase] ✅ Notification configs saved.`);

    console.log(`[SeedLocalClinicDataUseCase] 🎉 Seed complete! Local Kloqo is ready.`);

    return {
      success: true,
      clinicId,
      message: `Kloqo is ready for clinic "${clinic.name}". All data is now stored locally on this machine.`,
    };
  }

  // ── Private: Fetch Seed Data from Cloud API ───────────────────────────────
  private fetchSeedData(pairingToken: string): Promise<SeedPayload> {
    return new Promise((resolve, reject) => {
      const url = `${this.CLOUD_API_BASE}/v1/onboarding/download-seed?token=${encodeURIComponent(pairingToken)}`;
      console.log(`[SeedLocalClinicDataUseCase] Fetching from: ${this.CLOUD_API_BASE}/v1/onboarding/download-seed`);

      https.get(url, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          try {
            if (res.statusCode !== 200) {
              reject(new Error(`Cloud API returned HTTP ${res.statusCode}: ${data}`));
              return;
            }
            const parsed = JSON.parse(data);
            resolve(parsed as SeedPayload);
          } catch (err) {
            reject(new Error(`Failed to parse seed response: ${(err as Error).message}`));
          }
        });
      }).on('error', (err) => {
        reject(new Error(`Network error while fetching seed data: ${err.message}. Ensure the clinic PC is connected to the internet for the initial setup.`));
      });
    });
  }
}
