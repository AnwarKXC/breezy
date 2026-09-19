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

    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('resize', closeMenu)
    window.addEventListener('scroll', closeMenu, true)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
    }
  }, [closeMenu, open, updatePosition])

  if (!actions.length) return null

  return (
    <div className="flex justify-end">
      <button
        ref={buttonRef}
        aria-controls={dropdownId}
        aria-expanded={open}
        aria-label={ariaLabel}
        className="grid h-8 w-8 place-items-center rounded-lg text-lg leading-none text-[#787774] transition-colors hover:bg-[#F5F5F5] hover:text-[#1A1A1A]"
        onClick={toggleMenu}
        type="button"
      >
        ...
      </button>

      {open && position
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[120] w-44 overflow-hidden rounded-xl border border-[#EAEAEA] bg-white p-1.5 text-sm shadow-[0_18px_40px_rgba(16,26,36,0.14)]"
              id={dropdownId}
              onClick={(event) => event.stopPropagation()}
              style={{ left: position.left, top: position.top }}
            >
              {actions.map((action) => (
                <button
                  className={`block w-full rounded-lg px-3 py-2 text-start transition-colors ${
                    action.destructive
                      ? 'text-[#9F2F2D] hover:bg-[#FDEBEC]'
                      : 'text-[#333333] hover:bg-[#F5F5F5]'
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
