import { useParams } from "react-router-dom";
import { useAuth } from "../../../auth/AuthProvider";
import { resolveLedgerSection } from "../lib/ledger-utils";
import { LedgerSummary } from "./LedgerSummary";
import { LedgerAccounts } from "./LedgerAccounts";
import { LedgerAccountDetail } from "./LedgerAccountDetail";
import { LedgerMovements } from "./LedgerMovements";
import { LedgerReports } from "./LedgerReports";

export default function LedgerScreen() {
  const { "*": wildcard } = useParams();
  const { session } = useAuth();
  const token = session?.access_token;
  const routePath = wildcard ? `/${wildcard}` : "/";
  const section = resolveLedgerSection(routePath);

  if (section === "accounts") return <LedgerAccounts token={token} />;
  if (section === "account-detail") return <LedgerAccountDetail token={token} />;
  if (section === "movements") return <LedgerMovements token={token} />;
  if (section === "reports") return <LedgerReports token={token} />;
  return <LedgerSummary token={token} />;
}
