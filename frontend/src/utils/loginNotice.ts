import { Alert } from 'react-native';

/**
 * Right after logging in: the server says how many OTHER phones are still
 * signed in to this account (they were just told about this login). One
 * plain notice, so the person knows — HANDOFF §56.
 */
export function tellOtherPhones(count: number | undefined): void {
  if (!count) return;
  Alert.alert(
    'Signed in on another phone too',
    `Your account is also signed in on ${count} other ${count === 1 ? 'phone' : 'phones'}. If that isn't you, go to Edit profile → Secure my account.`,
  );
}
