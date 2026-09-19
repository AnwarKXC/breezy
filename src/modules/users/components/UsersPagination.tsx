import { CursorTableFooter } from '@/shared/table'

interface UsersPaginationProps {
  canNext: boolean
  canPrevious: boolean
  page: number
  pageSize: number
  pageSizeOptions: readonly number[]
  label: string
  previousLabel: string
  nextLabel: string
  totalPages: number
  onNext: () => void
  onPageChange: (page: number) => void
  onPageSizeChange: (pageSize: number) => void
  onPrevious: () => void
}

export function UsersPagination(props: UsersPaginationProps) {
  return (
    <CursorTableFooter
      canNext={props.canNext}
      canPrevious={props.canPrevious}
      nextLabel={props.nextLabel}
      onNext={props.onNext}
      onPageChange={props.onPageChange}
      onPageSizeChange={props.onPageSizeChange}
      onPrevious={props.onPrevious}
      page={props.page}
      pageLabel={props.label}
      pageSize={props.pageSize}
      pageSizeOptions={props.pageSizeOptions}
      previousLabel={props.previousLabel}
      totalPages={props.totalPages}
    />
  )
}

