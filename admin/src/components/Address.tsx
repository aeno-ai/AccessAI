import { Link } from 'react-router';
import { useAddressVisibility } from '../hooks/useAddressVisibility';

type AddressProps = {
  ip: string | null;
  // Where the address links to when shown (default: everything from it).
  to?: string;
};

// A network address: dots until "Show addresses" is on, then a link to the
// activity from that address.
export function Address({ ip, to }: AddressProps) {
  const { shown } = useAddressVisibility();
  if (!ip) return <>—</>;
  if (!shown) {
    return (
      <span className="address-hidden" aria-label="Address hidden">
        •••••••
      </span>
    );
  }
  return <Link to={to ?? `/activity?ip=${encodeURIComponent(ip)}`}>{ip}</Link>;
}
