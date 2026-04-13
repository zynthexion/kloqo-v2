const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const getHeaders = () => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
};

/**
 * Requests an impersonation token for a specific clinic.
 * This token contains 'clinicId' and 'clinicAdmin' claims.
 */
export async function impersonateClinic(clinicId: string): Promise<string> {
  const response = await fetch(`${API_URL}/superadmin/impersonate/${clinicId}`, {
    method: 'POST',
    headers: getHeaders()
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to generate impersonation token');
  }

  return data.customToken; // This is actually the ID Token returned from our updated UseCase
}
