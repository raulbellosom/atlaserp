import { useMemo, useState } from "react";

const PAGE_SIZE = 20;

function sortEmployees(employees, by, dir) {
  const multiplier = dir === "asc" ? 1 : -1;
  return [...employees].sort((a, b) => {
    let cmp = 0;
    if (by === "name") {
      const nameA = `${a.firstName ?? ""} ${a.lastName ?? ""}`.trim();
      const nameB = `${b.firstName ?? ""} ${b.lastName ?? ""}`.trim();
      cmp = nameA.localeCompare(nameB, "es", { sensitivity: "base" });
    } else if (by === "hireDate") {
      cmp = new Date(a.hireDate ?? 0) - new Date(b.hireDate ?? 0);
    } else {
      // createdAt default
      cmp = new Date(a.createdAt ?? 0) - new Date(b.createdAt ?? 0);
    }
    return cmp * multiplier;
  });
}

export function useHrExplorer(employees = []) {
  const [viewMode, setViewMode] = useState("table");
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ status: "", employmentType: "" });
  const [sort, setSort] = useState({ by: "createdAt", dir: "desc" });
  const [page, setPage] = useState(1);

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
      if (prev.by === by)
        return { by, dir: prev.dir === "desc" ? "asc" : "desc" };
      return { by, dir: "desc" };
    });
  }

  const filteredEmployees = useMemo(() => {
    let result = employees;

    const q = search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (e) =>
          `${e.firstName ?? ""} ${e.lastName ?? ""}`
            .toLowerCase()
            .includes(q) ||
          e.employeeCode?.toLowerCase().includes(q) ||
          e.workEmail?.toLowerCase().includes(q) ||
          e.jobTitle?.toLowerCase().includes(q) ||
          e.department?.toLowerCase().includes(q),
      );
    }

    if (filters.status) {
      result = result.filter((e) => e.status === filters.status);
    }

    if (filters.employmentType) {
      result = result.filter(
        (e) => e.employmentType === filters.employmentType,
      );
    }

    return sortEmployees(result, sort.by, sort.dir);
  }, [employees, search, filters, sort]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredEmployees.length / PAGE_SIZE),
  );
  const safePage = Math.min(page, totalPages);

  const paginatedEmployees = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredEmployees.slice(start, start + PAGE_SIZE);
  }, [filteredEmployees, safePage]);

  return {
    viewMode,
    search,
    filters,
    sort,
    page: safePage,
    pageSize: PAGE_SIZE,
    filteredEmployees,
    paginatedEmployees,
    totalPages,
    totalFiltered: filteredEmployees.length,
    setViewMode,
    setSearch: handleSetSearch,
    setFilters: handleSetFilters,
    cycleSort,
    setPage,
  };
}
