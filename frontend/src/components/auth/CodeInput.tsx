import { AuthInput } from '@/components/auth/AuthInput';

type Props = {
  value: string;
  onChange: (code: string) => void;
  autoFocus?: boolean;
  editable?: boolean;
  onSubmit?: () => void;
};

/**
 * The box for a 6-digit emailed code. Digits only, and the phone can fill
 * it from the email or SMS on its own (one-time-code autofill).
 */
export function CodeInput({ value, onChange, autoFocus = true, editable = true, onSubmit }: Props) {
  return (
    <AuthInput
      label="6-digit code"
      placeholder="123456"
      value={value}
      onChangeText={(text) => onChange(text.replace(/\D/g, ''))}
      keyboardType="number-pad"
      maxLength={6}
      textContentType="oneTimeCode"
      autoComplete="one-time-code"
      autoFocus={autoFocus}
      editable={editable}
      returnKeyType="done"
      onSubmitEditing={onSubmit}
    />
  );
}
