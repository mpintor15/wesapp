import { useState } from 'react';
import createRequestGuard from '../utils/requestGuard';

// One guard instance per hook/component lifetime, stable across re-renders.
const useRequestGuard = () => {
  const [guard] = useState(createRequestGuard);
  return guard;
};

export default useRequestGuard;
