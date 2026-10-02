'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface TableAction {
  destructive?: boolean
  label: string
  onSelect: () => void
}

interface MenuPosition {
  left: number
  top: number
}

interface TableActionsMenuProps {
  actions: TableAction[]
  ariaLabel: string
}

const menuWidth = 176
const menuGap = 8

function getMenuPosition(button: HTMLButtonElement, menuHeight: number): MenuPosition {
  const rect = button.getBoundingClientRect()
  const fitsBelow = rect.bottom + menuGap + menuHeight < window.innerHeight
  const left = Math.min(
    Math.max(12, rect.right - menuWidth),
    window.innerWidth - menuWidth - 12,
  )

  return {
    left,
    top: fitsBelow ? rect.bottom + menuGap : rect.top - menuGap - menuHeight,
  }
}

export function TableActionsMenu({ actions, ariaLabel }: TableActionsMenuProps) {
  const dropdownId = useId()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<MenuPosition | null>(null)

  const closeMenu = useCallback(() => setOpen(false), [])

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return
    const estimatedHeight = actions.length * 36 + 12
    setPosition(getMenuPosition(buttonRef.current, estimatedHeight))
  }, [actions.length])

  function toggleMenu(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    updatePosition()
    setOpen((value) => !value)
  }

  function handleSelect(action: TableAction) {
    action.onSelect()
    closeMenu()
  }

  useEffect(() => {
    if (!open) return

    updatePosition()

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return
      closeMenu()
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        closeMenu()
        buttonRef.current?.focus()
        return
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
      const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])
      if (!items.length) return
      event.preventDefault()
      const index = items.indexOf(document.activeElement as HTMLButtonElement)
      const step = event.key === 'ArrowDown' ? 1 : -1
      items[(index + step + items.length) % items.length]?.focus()
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('resize', closeMenu)
    window.addEventListener('scroll', closeMenu, true)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
    }
  }, [closeMenu, open, updatePosition])

  // Move focus to the first item once the menu is positioned (keyboard users land inside it).
  useEffect(() => {
    if (open && position) menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus()
  }, [open, position])

  if (!actions.length) return null

  return (
    <div className="flex justify-end">
      <button
        ref={buttonRef}
        aria-controls={dropdownId}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={ariaLabel}
        className="grid h-9 w-9 place-items-center rounded-lg text-[#787774] transition-colors hover:bg-accent/10 hover:text-accent-ink focus-visible:outline-2 focus-visible:outline-accent-ink"
        onClick={toggleMenu}
        type="button"
      >
        <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </button>

      {open && position
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[120] w-44 overflow-hidden rounded-xl border border-[#EAEAEA] bg-white p-1.5 text-sm shadow-[0_18px_40px_rgba(16,26,36,0.14)]"
              id={dropdownId}
              role="menu"
              aria-label={ariaLabel}
              onClick={(event) => event.stopPropagation()}
              style={{ left: position.left, top: position.top }}
            >
              {actions.map((action) => (
                <button
                  role="menuitem"
                  className={`block w-full rounded-lg px-3 py-2 text-start transition-colors focus:outline-none ${
                    action.destructive
                      ? 'text-[#9F2F2D] hover:bg-[#FDEBEC] focus:bg-[#FDEBEC]'
                      : 'text-[#333333] hover:bg-accent/10 focus:bg-accent/10'
                  }`}
                  key={action.label}
                  onClick={() => handleSelect(action)}
                  type="button"
                >
                  {action.label}
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}
