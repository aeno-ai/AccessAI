import { useAddressVisibility } from '../hooks/useAddressVisibility';

// One button that shows or hides every network address on every page.
export function AddressToggle() {
  const { shown, setShown } = useAddressVisibility();
  return (
    <button
      type="button"
      className="btn btn-secondary btn-small"
      aria-pressed={shown}
      onClick={() => setShown(!shown)}
    >
      {shown ? 'Hide addresses' : 'Show addresses'}
    </button>
  );
}
