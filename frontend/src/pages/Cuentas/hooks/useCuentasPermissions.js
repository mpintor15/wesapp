import { useMemo } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getCuentasPermissions } from '../utils/cuentasPermissions';

const useCuentasPermissions = () => {
  const { user } = useAuth();

  return useMemo(() => getCuentasPermissions(user), [user]);
};

export default useCuentasPermissions;
