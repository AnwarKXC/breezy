'use client'

interface BookingToolbarProps {
 title: string
 subtitle: string
}

export function BookingToolbar({ title, subtitle }: BookingToolbarProps) {
 return (
 <header className="mb-6"> <h1 className="text-2xl font-semibold tracking-tight text-[#1A1A1A]"> {title}
 </h1> <p className="mt-1 text-sm font-medium text-[#787774]"> {subtitle}
 </p> </header> )
}
