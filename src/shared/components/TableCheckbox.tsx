"use client";

import type { SyntheticEvent } from "react";

interface TableCheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}

export function TableCheckbox({
  checked,
  indeterminate = false,
  label,
  onChange,
}: TableCheckboxProps) {
  const isActive = checked || indeterminate;

  const stopRowEvents = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  return (
    <button
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={label}
      className="group inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded-md"
      data-ignore-row-click
      onClick={(event) => {
        event.stopPropagation();
        onChange(!checked);
      }}
      onPointerDown={stopRowEvents}
      onTouchEnd={stopRowEvents}
      onPointerUp={stopRowEvents}
      onMouseDown={stopRowEvents}
      onMouseUp={stopRowEvents}
      onKeyDown={(event) => {
        if (event.key !== " " && event.key !== "Enter") return;
        event.preventDefault();
        event.stopPropagation();
        onChange(!checked);
      }}
      onKeyUp={stopRowEvents}
      role="checkbox"
      type="button"
    >
      <span
        className={`grid h-4 w-4 place-items-center rounded-[5px] border  transition-all duration-200 ease-out group-hover:scale-105 group-focus-visible:ring-2 group-focus-visible:ring-gray-900/15 ${
          isActive
            ? "border-[#1A1A1A] bg-[#1A1A1A] text-white shadow-gray-900/20"
            : "border-[#D4D4D4] bg-white text-transparent group-hover:border-gray-500 group-hover:bg-[#F9F9F8]"
        }`}
      >
        {indeterminate ? (
          <span className="h-0.5 w-2 rounded-full bg-current transition-all duration-200 ease-out" />
        ) : (
          <svg
            viewBox="0 0 12 12"
            aria-hidden="true"
            className={`h-3 w-3 transition-all duration-200 ease-out ${
              checked ? "scale-100 opacity-100" : "scale-50 opacity-0"
            }`}
          >
            <path
              d="M3.2 6.2 5.1 8 8.9 4"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.8"
            />
          </svg>
        )}
      </span>
    </button>
  );
}
