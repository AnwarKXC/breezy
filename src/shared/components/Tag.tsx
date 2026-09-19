export interface TagProps {
  active?: boolean
  children: React.ReactNode
  onClick?: () => void
  className?: string
}

export function Tag({ active = false, children, onClick, className = '' }: TagProps) {
  const baseClasses = 'inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-medium transition'

  const activeClasses = 'bg-[#1A1A1A] text-white'
  const inactiveClasses = 'bg-[#F5F5F5] text-[#787774] hover:bg-[#EAEAEA] cursor-pointer'

  return (
    <span
      className={`
        ${baseClasses}
        ${active ? activeClasses : inactiveClasses}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </span>
  )
}

export default Tag