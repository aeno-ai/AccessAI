import { Link } from 'react-router';
import { AuthCard } from '../components/AuthCard';
import { useDocumentTitle } from '../hooks/useDocumentTitle';

export default function NotFoundPage() {
  useDocumentTitle('Page not found');

  return (
    <AuthCard title="Page not found" subtitle="That page doesn't exist.">
      <Link className="btn btn-primary btn-block" to="/users">
        Go to the admin panel
      </Link>
    </AuthCard>
  );
}
