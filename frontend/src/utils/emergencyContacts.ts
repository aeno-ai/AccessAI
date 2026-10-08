import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch } from '@/api/apiClient';

export type EmergencyContact = {
  _id: string;
  name: string;
  phoneNumber: string;
  relationship?: string;
};

export type EmergencyContactInput = {
  name: string;
  phoneNumber: string;
  relationship?: string;
};

// Same rule as the backend (validators/contactValidators.js).
export const PHONE_PATTERN = /^[+]?[\d\s()-]{7,20}$/;

const STORAGE_KEY = 'emergencyContacts:v1';

/**
 * The emergency contacts last seen from the server, kept on the phone so an
 * SOS can still be texted to them with no internet. Editing them needs the
 * internet; reading them never does.
 */
export async function getCachedContacts(): Promise<EmergencyContact[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as EmergencyContact[]) : [];
  } catch {
    return [];
  }
}

async function cacheContacts(contacts: EmergencyContact[]): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
  } catch {
    // The next successful refresh will try again.
  }
}

/** Signing out must forget them, so the next person on this phone never texts them. */
export async function clearCachedContacts(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}

/** Fetches the list from the server and updates the copy on the phone. Throws if offline. */
export async function refreshContacts(): Promise<EmergencyContact[]> {
  const contacts = await apiFetch<EmergencyContact[]>('/contacts');
  const slim = contacts.map(({ _id, name, phoneNumber, relationship }) => ({ _id, name, phoneNumber, relationship }));
  await cacheContacts(slim);
  return slim;
}

export async function saveContact(input: EmergencyContactInput, id?: string): Promise<EmergencyContact[]> {
  await apiFetch(id ? `/contacts/${id}` : '/contacts', {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(input),
  });
  return refreshContacts();
}

export async function deleteContact(id: string): Promise<EmergencyContact[]> {
  await apiFetch(`/contacts/${id}`, { method: 'DELETE' });
  return refreshContacts();
}
