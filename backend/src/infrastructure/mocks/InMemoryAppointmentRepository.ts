import { Appointment, PaginatedResponse, PaginationParams } from '../../../../packages/shared/src/index';
import { IAppointmentRepository, ITransaction } from '../../domain/repositories';

export class InMemoryAppointmentRepository implements IAppointmentRepository {
  private appointments: Appointment[] = [];
  private tokenCounters: Map<string, number> = new Map();
  private slotLocks: Set<string> = new Set();
  private bookedCounts: Map<string, number> = new Map();

  private lock: Promise<void> = Promise.resolve();

  // Simple serializable transaction implementation
  async runTransaction<T>(action: (transaction: ITransaction) => Promise<T>): Promise<T> {
    // Wait for previous transaction to finish (Mutex)
    const release = await this.acquireLock();
    
    // Snapshot state for potential rollback (though Mutex prevents most conflicts)
    const backupAppointments = JSON.parse(JSON.stringify(this.appointments));
    const backupCounters = new Map(this.tokenCounters);
    const backupLocks = new Set(this.slotLocks);
    const backupBookedCounts = new Map(this.bookedCounts);

    try {
      const result = await action({} as ITransaction);
      return result;
    } catch (error) {
      // Rollback on error
      this.appointments = backupAppointments;
      this.tokenCounters = backupCounters;
      this.slotLocks = backupLocks;
      this.bookedCounts = backupBookedCounts;
      throw error;
    } finally {
      release();
    }
  }

  private async acquireLock(): Promise<() => void> {
    let resolveLock: () => void;
    const newLock = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    
    const previousLock = this.lock;
    this.lock = newLock;
    await previousLock;
    
    return resolveLock!;
  }

  async findByDoctorAndDate(doctorId: string, date: string): Promise<Appointment[]> {
    return this.appointments.filter(a => a.doctorId === doctorId && a.date === date);
  }

  async findByClinicAndDate(clinicId: string, date: string): Promise<Appointment[]> {
    return this.appointments.filter(a => a.clinicId === clinicId && a.date === date);
  }

  async findPaginatedByClinicAndDate(clinicId: string, date: string, params: PaginationParams): Promise<PaginatedResponse<Appointment>> {
    const filtered = this.appointments.filter(a => a.clinicId === clinicId && a.date === date);
    const start = (params.page - 1) * params.limit;
    const end = start + params.limit;
    const data = filtered.slice(start, end);
    const total = filtered.length;
    const totalPages = Math.ceil(total / params.limit);

    return {
      data,
      total,
      page: params.page,
      limit: params.limit,
      totalPages,
      hasMore: end < total
    };
  }

  async findById(id: string): Promise<Appointment | null> {
    return this.appointments.find(a => a.id === id) || null;
  }

  async save(appointment: Appointment, _transaction?: ITransaction): Promise<void> {
    this.appointments.push({ ...appointment });
  }

  async update(id: string, data: Partial<Appointment>, _transaction?: ITransaction): Promise<void> {
    const index = this.appointments.findIndex(a => a.id === id);
    if (index !== -1) {
      this.appointments[index] = { ...this.appointments[index], ...data, updatedAt: new Date() };
    }
  }

  async incrementTokenCounter(counterId: string, _isClassic: boolean, _transaction?: ITransaction): Promise<number> {
    const current = this.tokenCounters.get(counterId) || 0;
    const next = current + 1;
    this.tokenCounters.set(counterId, next);
    return next;
  }

  async peekTokenCounter(counterId: string): Promise<number> {
    return this.tokenCounters.get(counterId) || 0;
  }

  async createSlotLock(lockId: string, _data: any, _transaction: ITransaction): Promise<void> {
    if (this.slotLocks.has(lockId)) {
      throw new Error(`Slot lock ${lockId} already exists`);
    }
    this.slotLocks.add(lockId);
  }

  async releaseSlotLock(lockId: string, _transaction?: ITransaction): Promise<void> {
    this.slotLocks.delete(lockId);
  }

  async updateBookedCount(clinicId: string, doctorId: string, date: string, sessionIndex: number, delta: 1 | -1, _transaction: ITransaction): Promise<void> {
    const key = `${clinicId}_${doctorId}_${date}_s${sessionIndex}`;
    const current = this.bookedCounts.get(key) || 0;
    this.bookedCounts.set(key, current + delta);
  }

  // --- Helpers for assertions ---
  getAppointments(): Appointment[] {
    return this.appointments;
  }

  getBookedCount(clinicId: string, doctorId: string, date: string, sessionIndex: number): number {
    const key = `${clinicId}_${doctorId}_${date}_s${sessionIndex}`;
    return this.bookedCounts.get(key) || 0;
  }

  setAppointments(appointments: Appointment[]) {
    this.appointments = [...appointments];
  }

  // --- Unimplemented/Not needed for these tests ---
  async findAll(_params?: PaginationParams): Promise<PaginatedResponse<Appointment> | Appointment[]> { return []; }
  async findByClinicId(_clinicId: string): Promise<Appointment[]> { return []; }
  async findLatestByPatientAndClinic(_patientId: string, _clinicId: string): Promise<Appointment | null> { return null; }
  async findAllByPatientAndClinic(_patientId: string, _clinicId: string): Promise<Appointment[]> { return []; }
  async findLatestByPatientIds(_patientIds: string[], _clinicId: string): Promise<Map<string, Appointment>> { return new Map(); }
  async findByPatientId(_patientId: string): Promise<Appointment[]> { return []; }
  async findByPatientIds(patientIds: string[]): Promise<Appointment[]> {
    return this.appointments.filter(a => patientIds.includes(a.patientId));
  }
  async countByStatus(_clinicId: string, _status: string): Promise<number> { return 0; }
  async countByPharmacyStatus(_clinicId: string, _status: string): Promise<number> { return 0; }
  async findCompletedByClinic(_clinicId: string, _filters: any): Promise<Appointment[]> { return []; }
  async findCompletedByPatientInClinic(_pId: string, _cId: string): Promise<Appointment[]> { return []; }
  async delete(_id: string): Promise<void> {}
}
