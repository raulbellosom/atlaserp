// apps/desktop/src/modules/runly.pfm/hooks/use-pfm-queries.js
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { useAuth } from "../../../auth/AuthProvider";
import { runly } from "../../../lib/atlas";

function useToken() {
  const { session } = useAuth();
  return session?.access_token ?? null;
}

const keys = {
  wallets: ["pfm", "wallets"],
  wallet: (id) => ["pfm", "wallet", id],
  members: (id) => ["pfm", "wallet", id, "members"],
  movements: (id, query) => ["pfm", "wallet", id, "movements", query],
  categories: (kind) => ["pfm", "categories", kind ?? "all"],
  summary: (month) => ["pfm", "summary", month],
};

export function useWallets() {
  const token = useToken();
  return useQuery({
    queryKey: keys.wallets,
    queryFn: () => runly.pfm.listWallets(token),
    enabled: Boolean(token),
    staleTime: 30 * 1000,
    select: (res) => res.data ?? [],
  });
}

export function useWallet(walletId) {
  const token = useToken();
  return useQuery({
    queryKey: keys.wallet(walletId),
    queryFn: () => runly.pfm.getWallet(walletId, token),
    enabled: Boolean(token && walletId),
    select: (res) => res.data ?? null,
  });
}

export function useWalletMovements(walletId, query) {
  const token = useToken();
  return useQuery({
    queryKey: keys.movements(walletId, query),
    queryFn: () => runly.pfm.listWalletMovements(walletId, token, query),
    enabled: Boolean(token && walletId),
    placeholderData: keepPreviousData,
    select: (res) => res.data ?? [],
  });
}

export function usePfmCategories(kind) {
  const token = useToken();
  return useQuery({
    queryKey: keys.categories(kind),
    queryFn: () => runly.pfm.listCategories(token, kind ? { kind } : {}),
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
    select: (res) => res.data ?? [],
  });
}

export function usePfmSummary(month) {
  const token = useToken();
  return useQuery({
    queryKey: keys.summary(month),
    queryFn: () => runly.pfm.getSummary(token, { month }),
    enabled: Boolean(token && month),
    placeholderData: keepPreviousData,
    select: (res) => res.data ?? null,
  });
}

export function useRecurringRules() {
  const token = useToken();
  return useQuery({
    queryKey: ["pfm", "recurring"],
    queryFn: () => runly.pfm.listRecurringRules(token),
    enabled: Boolean(token),
    select: (res) => res.data ?? [],
  });
}

export function useUpcoming(days = 14) {
  const token = useToken();
  return useQuery({
    queryKey: ["pfm", "upcoming", days],
    queryFn: () => runly.pfm.listUpcoming(token, { days }),
    enabled: Boolean(token),
    staleTime: 30 * 1000,
    select: (res) => res.data ?? [],
  });
}

export function useReceipts() {
  const token = useToken();
  return useQuery({
    queryKey: ["pfm", "receipts"],
    queryFn: () => runly.pfm.listReceipts(token),
    enabled: Boolean(token),
    select: (res) => res.data ?? [],
    refetchInterval: (query) =>
      (query.state.data?.data ?? []).some((r) => r.status === "PROCESSING") ? 4000 : false,
  });
}

export function useReceipt(receiptId, { poll = true } = {}) {
  const token = useToken();
  return useQuery({
    queryKey: ["pfm", "receipt", receiptId],
    queryFn: () => runly.pfm.getReceipt(receiptId, token),
    enabled: Boolean(token && receiptId),
    select: (res) => res.data ?? null,
    refetchInterval: (query) =>
      poll && query.state.data?.data?.status === "PROCESSING" ? 3000 : false,
  });
}

export function useReceiptImageUrl(fileId) {
  const token = useToken();
  return useQuery({
    queryKey: ["pfm", "receipt-image", fileId],
    queryFn: async () => {
      const res = await runly.files.getSignedUrl(fileId, token);
      return res?.data?.signedUrl ?? res?.signedUrl ?? null;
    },
    enabled: Boolean(token && fileId),
    staleTime: 45 * 60 * 1000,
  });
}

export function useBudgets(month) {
  const token = useToken();
  return useQuery({
    queryKey: ["pfm", "budgets", month ?? "current"],
    queryFn: () => runly.pfm.listBudgets(token, month ? { month } : {}),
    enabled: Boolean(token),
    select: (res) => res.data ?? [],
  });
}

export function useGoals() {
  const token = useToken();
  return useQuery({
    queryKey: ["pfm", "goals"],
    queryFn: () => runly.pfm.listGoals(token),
    enabled: Boolean(token),
    select: (res) => res.data ?? [],
  });
}

// Ledger accounts the current user can see, for the optional "link this wallet
// to a bank account" picker in WalletFormSheet. Degrades to an empty list when
// the user lacks ledger.accounts.read or the module is not installed.
export function useLedgerAccounts() {
  const token = useToken();
  return useQuery({
    queryKey: ["pfm", "ledger-accounts"],
    queryFn: () => runly.ledger.listAccounts(token),
    enabled: Boolean(token),
    retry: false,
    staleTime: 5 * 60 * 1000,
    select: (res) => res?.data ?? [],
  });
}

export function useWalletMembers(walletId, enabled = true) {
  const token = useToken();
  return useQuery({
    queryKey: keys.members(walletId),
    queryFn: () => runly.pfm.listWalletMembers(walletId, token),
    enabled: Boolean(token && walletId && enabled),
    select: (res) => res.data ?? [],
  });
}

function useInvalidatePfm() {
  const qc = useQueryClient();
  return (walletId) => {
    qc.invalidateQueries({ queryKey: ["pfm"] });
    if (walletId) qc.invalidateQueries({ queryKey: keys.wallet(walletId) });
  };
}

export function useCreateWallet() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: (data) => runly.pfm.createWallet(data, token),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateWallet() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ id, ...data }) => runly.pfm.updateWallet(id, data, token),
    onSuccess: (_r, v) => invalidate(v.id),
  });
}

export function useSetWalletEnabled() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ id, enabled }) => runly.pfm.setWalletEnabled(id, enabled, token),
    onSuccess: () => invalidate(),
  });
}

export function useCreateMovement() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ walletId, ...data }) => runly.pfm.createWalletMovement(walletId, data, token),
    onSuccess: (_r, v) => invalidate(v.walletId),
  });
}

export function useUpdateMovement() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ movementId, walletId, ...data }) =>
      runly.pfm.updateMovement(movementId, data, token),
    onSuccess: (_r, v) => invalidate(v.walletId),
  });
}

export function useSetMovementEnabled() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ movementId, walletId, enabled }) =>
      runly.pfm.setMovementEnabled(movementId, enabled, token),
    onSuccess: (_r, v) => invalidate(v.walletId),
  });
}

export function useConfirmMovement() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ movementId, walletId, amount }) =>
      runly.pfm.confirmMovement(movementId, amount, token),
    onSuccess: (_r, v) => invalidate(v.walletId),
  });
}

export function useSkipMovement() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ movementId, walletId }) => runly.pfm.skipMovement(movementId, token),
    onSuccess: (_r, v) => invalidate(v.walletId),
  });
}

export function useEnrichLedgerMovement() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ walletId, ltxId, ...data }) =>
      runly.pfm.enrichLedgerMovement(walletId, ltxId, data, token),
    onSuccess: (_r, v) => invalidate(v.walletId),
  });
}

export function useCreateRecurringRule() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: (data) => runly.pfm.createRecurringRule(data, token),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateRecurringRule() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ id, ...data }) => runly.pfm.updateRecurringRule(id, data, token),
    onSuccess: () => invalidate(),
  });
}

export function useSetRecurringRuleEnabled() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ id, enabled }) => runly.pfm.setRecurringRuleEnabled(id, enabled, token),
    onSuccess: () => invalidate(),
  });
}

export function useUploadReceipt() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file) => {
      const fd = new FormData();
      fd.append("file", file);
      return runly.pfm.uploadReceipt(fd, token);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pfm", "receipts"] }),
  });
}

export function useConfirmReceipt() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ id, ...data }) => runly.pfm.confirmReceipt(id, data, token),
    onSuccess: (_r, v) => invalidate(v.walletId),
  });
}

export function useRetryReceipt() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => runly.pfm.retryReceipt(id, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pfm", "receipts"] }),
  });
}

export function useCreateBudget() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({ mutationFn: (d) => runly.pfm.createBudget(d, token), onSuccess: () => invalidate() });
}
export function useUpdateBudget() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ id, ...d }) => runly.pfm.updateBudget(id, d, token),
    onSuccess: () => invalidate(),
  });
}
export function useSetBudgetEnabled() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ id, enabled }) => runly.pfm.setBudgetEnabled(id, enabled, token),
    onSuccess: () => invalidate(),
  });
}
export function useCreateGoal() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({ mutationFn: (d) => runly.pfm.createGoal(d, token), onSuccess: () => invalidate() });
}
export function useUpdateGoal() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ id, ...d }) => runly.pfm.updateGoal(id, d, token),
    onSuccess: () => invalidate(),
  });
}
export function useSetGoalEnabled() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ id, enabled }) => runly.pfm.setGoalEnabled(id, enabled, token),
    onSuccess: () => invalidate(),
  });
}
export function useContributeGoal() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ id, amount }) => runly.pfm.contributeGoal(id, amount, token),
    onSuccess: () => invalidate(),
  });
}
export function useAdjustWalletBalance() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ id, ...data }) => runly.pfm.adjustWalletBalance(id, data, token),
    onSuccess: (_r, v) => invalidate(v.id),
  });
}

export function useCreatePfmCategory() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => runly.pfm.createCategory(data, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pfm", "categories"] }),
  });
}

export function useUpdatePfmCategory() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => runly.pfm.updateCategory(id, data, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pfm", "categories"] }),
  });
}

export function useSetPfmCategoryEnabled() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }) => runly.pfm.setCategoryEnabled(id, enabled, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pfm", "categories"] }),
  });
}

export function useUpsertWalletMember() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ walletId, ...data }) => runly.pfm.upsertWalletMember(walletId, data, token),
    onSuccess: (_r, v) => invalidate(v.walletId),
  });
}

export function useRemoveWalletMember() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ walletId, userId }) => runly.pfm.removeWalletMember(walletId, userId, token),
    onSuccess: (_r, v) => invalidate(v.walletId),
  });
}
