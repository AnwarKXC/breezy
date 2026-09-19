"use client";

import { useCallback, useMemo, useState } from "react";

interface UseTableOptions<T> {
  searchText?: (item: T) => string;
}

const defaultSearchText = <T,>(item: T) => JSON.stringify(item);

export function useTable<T>(items: T[], pageSize = 10, options: UseTableOptions<T> = {}) {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"row" | "grid">("row");
  const getSearchText = options.searchText ?? defaultSearchText;

  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    const normalized = query.toLowerCase();
    return items.filter((item) => getSearchText(item).toLowerCase().includes(normalized));
  }, [getSearchText, items, query]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedItems = useMemo(
    () => filteredItems.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [currentPage, filteredItems, pageSize],
  );

  const updateQuery = useCallback((value: string) => {
    setQuery(value);
    setPage(1);
  }, []);

  return { filteredItems, page: currentPage, paginatedItems, query, setPage, setQuery: updateQuery, setView, totalPages, view };
}
