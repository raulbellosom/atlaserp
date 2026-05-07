import { useParams } from 'react-router-dom';
import { useAuth } from '../../../auth/AuthProvider';
import { resolveFinanceSection } from '../lib/finance-utils';
import { FinanceSummary } from './FinanceSummary';
import { FinanceAr } from './FinanceAr';
import { FinanceAp } from './FinanceAp';
import { FinanceAging } from './FinanceAging';
import { FinanceApplications } from './FinanceApplications';
import { FinanceAccounts } from './FinanceAccounts';
import { FinanceEntries } from './FinanceEntries';
import { FinanceTaxes } from './FinanceTaxes';
import { FinanceFxRates } from './FinanceFxRates';

export default function FinanceScreen() {
  const { '*': wildcard } = useParams();
  const { session } = useAuth();
  const token = session?.access_token;
  const routePath = wildcard ? `/${wildcard}` : '/';
  const activeSection = resolveFinanceSection(routePath);

  if (activeSection === 'ar') return <FinanceAr token={token} />;
  if (activeSection === 'ap') return <FinanceAp token={token} />;
  if (activeSection === 'aging') return <FinanceAging token={token} />;
  if (activeSection === 'applications') return <FinanceApplications token={token} />;
  if (activeSection === 'accounts') return <FinanceAccounts token={token} />;
  if (activeSection === 'entries') return <FinanceEntries token={token} />;
  if (activeSection === 'taxes') return <FinanceTaxes token={token} />;
  if (activeSection === 'fx-rates') return <FinanceFxRates token={token} />;
  return <FinanceSummary token={token} />;
}
