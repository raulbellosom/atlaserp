// apps/desktop/src/modules/atlas.pfm/hooks/use-pfm-queries.js
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { useAuth } from "../../../auth/AuthProvider";
import { atlas } from "../../../lib/atlas";

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
    queryFn: () => atlas.pfm.listWallets(token),
    enabled: Boolean(token),
    staleTime: 30 * 1000,
    select: (res) => res.data ?? [],
  });
}

export function useWallet(walletId) {
  const token = useToken();
  return useQuery({
    queryKey: keys.wallet(walletId),
    queryFn: () => atlas.pfm.getWallet(walletId, token),
    enabled: Boolean(token && walletId),
    select: (res) => res.data ?? null,
  });
}

export function useWalletMovements(walletId, query) {
  const token = useToken();
  return useQuery({
    queryKey: keys.movements(walletId, query),
    queryFn: () => atlas.pfm.listWalletMovements(walletId, token, query),
    enabled: Boolean(token && walletId),
    placeholderData: keepPreviousData,
    select: (res) => res.data ?? [],
  });
}

export function usePfmCategories(kind) {
  const token = useToken();
  return useQuery({
    queryKey: keys.categories(kind),
    queryFn: () => atlas.pfm.listCategories(token, kind ? { kind } : {}),
    enabled: Boolean(token),
    staleTime: 5 * 60 * 1000,
    select: (res) => res.data ?? [],
  });
}

export function usePfmSummary(month) {
  const token = useToken();
  return useQuery({
    queryKey: keys.summary(month),
    queryFn: () => atlas.pfm.getSummary(token, { month }),
    enabled: Boolean(token && month),
    placeholderData: keepPreviousData,
    select: (res) => res.data ?? null,
  });
}

export function useRecurringRules() {
  const token = useToken();
  return useQuery({
    queryKey: ["pfm", "recurring"],
    queryFn: () => atlas.pfm.listRecurringRules(token),
    enabled: Boolean(token),
    select: (res) => res.data ?? [],
  });
}

export function useUpcoming(days = 14) {
  const token = useToken();
  return useQuery({
    queryKey: ["pfm", "upcoming", days],
    queryFn: () => atlas.pfm.listUpcoming(token, { days }),
    enabled: Boolean(token),
    staleTime: 30 * 1000,
    select: (res) => res.data ?? [],
  });
}

export function useWalletMembers(walletId, enabled = true) {
  const token = useToken();
  return useQuery({
    queryKey: keys.members(walletId),
    queryFn: () => atlas.pfm.listWalletMembers(walletId, token),
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
    mutationFn: (data) => atlas.pfm.createWallet(data, token),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateWallet() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ id, ...data }) => atlas.pfm.updateWallet(id, data, token),
    onSuccess: (_r, v) => invalidate(v.id),
  });
}

export function useSetWalletEnabled() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ id, enabled }) => atlas.pfm.setWalletEnabled(id, enabled, token),
    onSuccess: () => invalidate(),
  });
}

export function useCreateMovement() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ walletId, ...data }) => atlas.pfm.createWalletMovement(walletId, data, token),
    onSuccess: (_r, v) => invalidate(v.walletId),
  });
}

export function useUpdateMovement() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ movementId, walletId, ...data }) =>
      atlas.pfm.updateMovement(movementId, data, token),
    onSuccess: (_r, v) => invalidate(v.walletId),
  });
}

export function useSetMovementEnabled() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ movementId, walletId, enabled }) =>
      atlas.pfm.setMovementEnabled(movementId, enabled, token),
    onSuccess: (_r, v) => invalidate(v.walletId),
  });
}

export function useConfirmMovement() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ movementId, walletId, amount }) =>
      atlas.pfm.confirmMovement(movementId, amount, token),
    onSuccess: (_r, v) => invalidate(v.walletId),
  });
}

export function useSkipMovement() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ movementId, walletId }) => atlas.pfm.skipMovement(movementId, token),
    onSuccess: (_r, v) => invalidate(v.walletId),
  });
}

export function useEnrichLedgerMovement() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ walletId, ltxId, ...data }) =>
      atlas.pfm.enrichLedgerMovement(walletId, ltxId, data, token),
    onSuccess: (_r, v) => invalidate(v.walletId),
  });
}

export function useCreateRecurringRule() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: (data) => atlas.pfm.createRecurringRule(data, token),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateRecurringRule() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ id, ...data }) => atlas.pfm.updateRecurringRule(id, data, token),
    onSuccess: () => invalidate(),
  });
}

export function useSetRecurringRuleEnabled() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ id, enabled }) => atlas.pfm.setRecurringRuleEnabled(id, enabled, token),
    onSuccess: () => invalidate(),
  });
}

export function useCreatePfmCategory() {
  const token = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => atlas.pfm.createCategory(data, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pfm", "categories"] }),
  });
}

export function useUpsertWalletMember() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ walletId, ...data }) => atlas.pfm.upsertWalletMember(walletId, data, token),
    onSuccess: (_r, v) => invalidate(v.walletId),
  });
}

export function useRemoveWalletMember() {
  const token = useToken();
  const invalidate = useInvalidatePfm();
  return useMutation({
    mutationFn: ({ walletId, userId }) => atlas.pfm.removeWalletMember(walletId, userId, token),
    onSuccess: (_r, v) => invalidate(v.walletId),
  });
}
