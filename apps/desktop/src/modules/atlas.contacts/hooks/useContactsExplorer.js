import { useMemo, useState } from "react";

const PAGE_SIZE = 20;

const TYPE_ORDER = { customer: 0, supplier: 1, company: 2, person: 3 };

function getTypeOrder(type) {
  return TYPE_ORDER[type] ?? 99;
}

function sortContacts(contacts, by, dir) {
  const multiplier = dir === "asc" ? 1 : -1;
  return [...contacts].sort((a, b) => {
    let cmp = 0;
    if (by === "name") {
      cmp = (a.name ?? "").localeCompare(b.name ?? "", "es", {
        sensitivity: "base",
      });
    } else if (by === "type") {
      cmp = getTypeOrder(a.type) - getTypeOrder(b.type);
    } else {
      // createdAt (default)
      cmp = new Date(a.createdAt ?? 0) - new Date(b.createdAt ?? 0);
    }
    return cmp * multiplier;
  });
}

export function useContactsExplorer(contacts = []) {
  const [viewMode, setViewMode] = useState("table");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    type: "",
    status: "",
    hasEmail: "",
    hasPhone: "",
  });
  const [sort, setSort] = useState({ by: "createdAt", dir: "desc" });
  const [selectedIds, setSelectedIds] = useState([]);
  const [page, setPage] = useState(1);

  function setFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  function handleSetSearch(value) {
    setSearch(value);
    setPage(1);
  }

  function handleSetFilters(newFilters) {
    setFilters(newFilters);
    setPage(1);
  }

  function cycleSort(by) {
    setSort((prev) => {
      if (prev.by === by) {
        return { by, dir: prev.dir === "desc" ? "asc" : "desc" };
      }
      return { by, dir: "desc" };
    });
  }

  // --- filtered + sorted pipeline ---
  const filteredContacts = useMemo(() => {
    let result = contacts;

    // search
    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.legalName?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q) ||
          c.taxId?.toLowerCase().includes(q),
      );
    }

    // type filter
    if (filters.type) {
      result = result.filter((c) => c.type === filters.type);
    }

    // status filter
    if (filters.status === "enabled") {
      result = result.filter((c) => c.enabled === true);
    } else if (filters.status === "disabled") {
      result = result.filter((c) => c.enabled === false);
    }

    // hasEmail filter
    if (filters.hasEmail === "yes") {
      result = result.filter((c) => Boolean(c.email));
    } else if (filters.hasEmail === "no") {
      result = result.filter((c) => !c.email);
    }

    // hasPhone filter
    if (filters.hasPhone === "yes") {
      result = result.filter((c) => Boolean(c.phone));
    } else if (filters.hasPhone === "no") {
      result = result.filter((c) => !c.phone);
    }

    return sortContacts(result, sort.by, sort.dir);
  }, [contacts, search, filters, sort]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredContacts.length / PAGE_SIZE),
  );

  const safePage = Math.min(page, totalPages);

  const paginatedContacts = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredContacts.slice(start, start + PAGE_SIZE);
  }, [filteredContacts, safePage]);

  // --- selection ---
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedCount = selectedIds.length;

  function toggleSelect(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  function selectVisible() {
    const visibleIds = paginatedContacts.map((c) => c.id);
    setSelectedIds((prev) => {
      const existing = new Set(prev);
      visibleIds.forEach((id) => existing.add(id));
      return [...existing];
    });
  }

  function selectAll() {
    setSelectedIds(filteredContacts.map((c) => c.id));
  }

  function deselectVisible() {
    const visibleIds = new Set(paginatedContacts.map((c) => c.id));
    setSelectedIds((prev) => prev.filter((id) => !visibleIds.has(id)));
  }

  return {
    // state
    viewMode,
    search,
    filters,
    sort,
    page: safePage,
    pageSize: PAGE_SIZE,
    // derived
    filteredContacts,
    paginatedContacts,
    totalPages,
    totalFiltered: filteredContacts.length,
    selectedSet,
    selectedCount,
    selectedIds,
    // actions
    setViewMode,
    setSearch: handleSetSearch,
    setFilters: handleSetFilters,
    setFilter,
    cycleSort,
    setPage,
    toggleSelect,
    clearSelection,
    selectVisible,
    deselectVisible,
    selectAll,
  };
}
