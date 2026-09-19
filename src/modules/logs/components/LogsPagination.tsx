import { CursorTableFooter } from '@/shared/table';

interface LogsPaginationProps {
  page: number;
  pageSize: number;
  pageSizeOptions: readonly number[];
  totalPages: number;
  label: string;
  previousLabel: string;
  nextLabel: string;
  canPrevious: boolean;
  canNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
}

export function LogsPagination({
  page,
  pageSize,
  pageSizeOptions,
  totalPages,
  label,
  previousLabel,
  nextLabel,
  canPrevious,
  canNext,
  onPrevious,
  onNext,
  onPageChange,
  onPageSizeChange,
}: LogsPaginationProps) {
  return (
    <CursorTableFooter
      canNext={canNext}
      canPrevious={canPrevious}
      nextLabel={nextLabel}
      onNext={onNext}
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
      onPrevious={onPrevious}
      page={page}
      pageLabel={label.replace("{page}", String(page))}
      pageSize={pageSize}
      pageSizeOptions={pageSizeOptions}
      previousLabel={previousLabel}
      totalPages={totalPages}
    />
  );
}
