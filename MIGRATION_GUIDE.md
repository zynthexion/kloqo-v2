# Firebase Migration Guide: Production to Duplicate

This guide outlines the step-by-step process used to migrate data from the production Firebase project to a duplicate environment for V2 testing and development.

## ⚠️ Old Production Credentials (Backup Reference)
Use these ONLY for backup purposes. DO NOT use these as your primary project credentials anymore.

**Project ID**: `kloqo-clinic-multi-33968-4c50b`
**Private Key**:
```text
-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDNd5wqkl5mmYE9
/s5uc+r8PMWUk3gZszc8Z1CUYbE1u879iDar6HdNzblXBKk0mmEJjTX5lR2BvHrU
n171g+ePM+N6Kts6pY8mWRtbWa4g9dBju8b+cRS4vIAGSnZ1lkkNzFAB2fJPLttJ
8Alvaa00PvQg+/84hnxMJNP8yA1BxiU+ZeEYp5L7/rOp5Ng7scHx2UIN/9D4KEbp
DEE0KFTSj2LZeGVPSDRBp5yhfZWKKOBeZIs1QhncIMZTXd0kQevjBkKJMKNohl2x
WmFzkdJ72Bb3n+IUnM4RZUlFISPRDoF8gP5vbsF259G7A2yyohPGi2hB+cx9uzl3
bpz3rBG/AgMBAAECggEAOvrNOMk4UPJaj62/myQqPYrCWrJ0RMhVoEC1+EoMwPRu
6Ac8Tl+WM57Mx6ZeXeu81C2VY1YDGNU+Wx9+djKNe2V1NIHt2Wlh7KuidzgIjIyT
a7Wg2zQhsx/lDik81Oc1hED0bHugG0vDhfdh9fnbTsaNdJRxwEuWjZL6yTKx34Ga
EpEsAYIQfNTwYSw61v8Mc7SPWZOjUHENCkNZjHlOYNVdFOLRZsTRnl9kvmf4uK2d
g9x4oMzKyrT0HF9kjYdMVNZWVSHi2FIoSXwMGkjxick+zraxZ9+XbxHq0M9AMqoO
lkOgk1FD8qRNtiITqDrO3Y9rVtUKPpnp4RAhBt9d3QKBgQDzdhoBZVUtHy5lS2Us
Wp4a9YgsclKjyaVNcRIfgRRcjLSvvYVyRWwOU5F138iyMTOtxYJplx8qsjyHkcia
Rt3IYvpOu5uYpK+OAGAwOg692uCFz8PGBZrE21lCMEn6PNqELKzq8JYr0fxzKjDs
myFQgvV7ny1fFFjei3x8tMzSrQKBgQDYDJPvEXe5gWA8GxAbM/UoU3EOOxEbrkWc
DW2ayt+fOGuA1MRfRnCNK84p46RWy6XlAT45MleMV7FTmyB6hAQaMMOr2e9tMEts
YN6S3vbFa6Iwdv17RdBpCwcDwgq3U9j2XE+SGRg2OfNVAcjxkITns35lxUvg7YWz
v37Imv3vmwKBgAapJ4L8Q71NShapXmY9QHAaYZRduFcU0DnzKvzDqkvx6YuZUspS
jedCcAtaiQIfCHvrmGrNIKQpZjCLU4KtB6pQ0upOha5Cay8mYXtQS1D0aQogKgoD
4z0ZhzKhYZTAD3ZoRn7TADjIsPBxqg7/G4U5X//21eXxB5FnHYvH4oatAoGAcvqO
nqEaFjwYZbyN/+No3+JQfsNEik7a1eQ10bVLWm+fs3o1dTM8yCw9rEsQBq+eJjEyT
DuGJ0jjBOJtwN4OWo1GccRL05wkyuqT7DvL2Ja7YjC5nTHmlJqIlw4w7I8HNz57l
Af208vb4Vx8yD803zg+qjwLnFPeTlkutb5l8100CgYApG9ZAtyWmF1E1aLwq96n0
si2RN+fv+pqhcHBbDxdW9W6j63E1UyjnLxvVhCTlN6CgV5b+/k+E+x4nvUQxFp0q
FmuVzXlJdpcQcQO61S4hbIS53KHlqyONq03TYYsqdKHXnuXyt4Vs3LFqYrv+ibvG
SxdF7P8O0SN+OYtPRI+yIA==
-----END PRIVATE KEY-----
```

---

## Migration Steps

### 1. Pre-requisites
- Ensure `.env` in `backend/` is configured with the **NEW** project credentials:
  - `FIREBASE_PROJECT_ID`
  - `FIREBASE_SERVICE_ACCOUNT` (JSON string)
  - `FIREBASE_WEB_API_KEY` (Public key)

### 2. Backup Phase (From OLD Project)
These scripts must be temporarily pointed to the old service account.
1. **Firestore Data Backup**:
   Run the backup script to save all collections to JSON files:
   ```bash
   npm run backup
   ```
   *Files saved in: `backups/TIMESTAMP/`*

2. **Authentication Users Backup**:
   Run the dedicated auth backup script:
   ```bash
   npx ts-node src/scripts/backup-auth.ts
   ```
   *File saved in: `backups/TIMESTAMP/auth_users_backup.json`*

### 3. Time Standardization Phase (NEW - V2 Golden Standard)
Before restoring, run the time standardization script on the downloaded JSON files.
This converts legacy 12-hour times (`"04:10 PM"`) to 24-hour (`"16:10"`) and ensures
all event timestamps are native Firestore `{ _seconds, _nanoseconds }` maps.

```bash
npx ts-node src/scripts/standardize-times.ts ../backups/TIMESTAMP
```

**Collections upgraded:**
- `appointments.json` — `time` (12h→24h), all event timestamps
- `doctors.json` — `availabilitySlots` (12h→24h), `availabilityExtensions`→`dateOverrides`
- `clinics.json` — `operatingHours` (12h→24h), `registrationDate`, `planStartDate`
- `patients.json` — `createdAt`, `updatedAt`
- `prescriptions.json` — `date`, `createdAt`
- `doctor_punctuality_logs.json` — `scheduledTime` (12h→24h), `timestamp`
- `whatsapp_sessions.json` — `lastMessageAt`

*This script is idempotent — safe to run multiple times without double-converting.*

### 4. Restoration Phase (To NEW Project)
Ensure `.env` is set to the **NEW** project before running these.
1. **Restore Firestore Collections**:
   Point this script to the directory containing your JSON files:
   ```bash
   npx ts-node src/scripts/restore-firestore.ts ../backups/TIMESTAMP
   ```
   *Note: For the `users` collection, the script automatically uses the `uid` field as the Document ID to ensure compatibility with Firebase Auth.*

2. **Migrate Authentication Users**:
   Point this script to the specific auth backup JSON file:
   ```bash
   npx ts-node src/scripts/migrate-auth-users.ts ../backups/TIMESTAMP/auth_users_backup.json
   ```

### 4. Data Patching & Cleanup Phase
1. **Fix Data Visibility (isDeleted field)**:
   Run the migration script to add `isDeleted: false` to all legacy records:
   ```bash
   npx ts-node src/scripts/migrate-isDeleted.ts
   ```

2. **Normalize Timestamps**:
   Convert "broken" JSON date objects into native Firestore Timestamps to fix analytics crashes:
   ```bash
   npx ts-node src/scripts/normalize-timestamps.ts
   ```

3. **Migrate Role Strings to Arrays (V2 Multi-Role)**:
   Convert legacy `role: string` into the new `roles: string[]` array structure across the users collection:
   ```bash
   npx ts-node src/scripts/migrateRolesToArrays.ts
   ```

### 5. Post-Migration Setup
1. **Create Super Admin User**:
   If you need to create a new super admin account to access the dashboard:
   ```bash
   curl -X POST http://localhost:3001/superadmin/users \
        -H "Content-Type: application/json" \
        -d '{
              "email": "admin@example.com",
              "password": "StrongPassword123!",
              "name": "Admin Name",
              "role": "superAdmin"
            }'
   ```

## Final Verification
- Restart the backend server (`npm run dev:backend`).
- Access the Superadmin dashboard to verify data visibility and user login.
