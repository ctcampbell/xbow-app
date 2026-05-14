import { useParams } from 'react-router-dom';
import NotFound from '../pages/NotFound';

export default function RequireNumericId({ children }: { children: JSX.Element }) {
  const { id } = useParams();
  if (!id || !/^\d+$/.test(id)) return <NotFound />;
  return children;
}
