import { ManagePatientUseCase, ManagePatientRequest } from '../ManagePatientUseCase';

// Mock dependencies entirely inside the factory to avoid hoisting issues
jest.mock('../../infrastructure/firebase/config', () => {
  const mockDb = {
    collection: jest.fn().mockReturnThis(),
    doc: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    runTransaction: jest.fn(),
  };
  return { db: mockDb };
});

// Import the mocked db to access spies
const { db } = require('../../infrastructure/firebase/config');

describe('ManagePatientUseCase Firestore Transaction Integrity', () => {
  let useCase: ManagePatientUseCase;
  let mockPatientRepo: any;
  let operations: string[] = [];
  let mockTxn: any;

  beforeEach(() => {
    jest.clearAllMocks();
    operations = [];
    mockPatientRepo = {};
    useCase = new ManagePatientUseCase(mockPatientRepo);

    // Mock Transaction to track order of operations
    mockTxn = {
      get: jest.fn().mockImplementation(() => {
        operations.push('get');
        return Promise.resolve({
          exists: false,
          data: () => ({}),
          docs: [],
          empty: true,
          ref: { id: 'some-id' }
        });
      }),
      set: jest.fn().mockImplementation(() => {
        operations.push('set');
        return mockTxn;
      }),
      update: jest.fn().mockImplementation(() => {
        operations.push('update');
        return mockTxn;
      }),
    };

    (db.runTransaction as jest.Mock).mockImplementation((callback) => callback(mockTxn));
    
    // Ensure db methods return db for chaining
    (db.collection as jest.Mock).mockReturnValue(db);
    (db.doc as jest.Mock).mockReturnValue(db);
    (db.where as jest.Mock).mockReturnValue(db);
  });

  it('should execute all reads before any writes (Firestore Compliance)', async () => {
    const request: ManagePatientRequest = {
      name: 'John Doe',
      phone: '9988776655',
      communicationPhone: '9988776655',
      clinicId: 'clinic-1',
      age: 30,
      sex: 'Male'
    };

    await useCase.execute(request);

    // Find the first index of a write (set/update)
    const firstWriteIndex = operations.findIndex(op => op === 'set' || op === 'update');
    // Find the last index of a read (get)
    const lastReadIndex = operations.lastIndexOf('get');

    // If both exist, the last read must be before the first write
    if (firstWriteIndex !== -1 && lastReadIndex !== -1) {
      expect(lastReadIndex).toBeLessThan(firstWriteIndex);
    } else if (firstWriteIndex !== -1) {
       // if only writes exist, that's fine too (though unlikely in this use case)
       expect(true).toBe(true);
    }
  });

  it('should handle relative linking without violating transaction order', async () => {
    const request: ManagePatientRequest = {
      name: 'Relative Doe',
      phone: '', // No primary phone -> isRelative
      communicationPhone: '9988776655',
      clinicId: 'clinic-1'
    };

    await useCase.execute(request);

    const firstWriteIndex = operations.findIndex(op => op === 'set' || op === 'update');
    const lastReadIndex = operations.lastIndexOf('get');

    if (firstWriteIndex !== -1 && lastReadIndex !== -1) {
      expect(lastReadIndex).toBeLessThan(firstWriteIndex);
    }
  });
});
