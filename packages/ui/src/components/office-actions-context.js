import { createContext, useContext } from 'react';

export const OfficeActionsContext = createContext(null);
export function useOfficeActions() { return useContext(OfficeActionsContext); }
