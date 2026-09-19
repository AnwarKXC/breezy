'use client'
import Image from 'next/image'
import { useRef, useState } from 'react'
import { uploadLogo, deleteLogo } from '../services/logoUploadService'

interface LogoUploadProps {
  value: string | undefined
  label: string
  onChange: (value: string) => void
}

export function LogoUpload({ value, label, onChange }: LogoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const url = await uploadLogo(file)
      onChange(url)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      setUploadError(message)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleRemove = async () => {
    if (value) await deleteLogo(value).catch(() => {})
    onChange('')
  }

  return (
    <div className="sm:col-span-2">
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#EAEAEA] px-4 py-3 transition-colors hover:border-[#D4D4D4]">
        {uploading ? (
          <span className="text-sm text-[#787774]">Uploading...</span>
        ) : value ? (
          <>
            <Image unoptimized src={value} alt="" width={40} height={40} className="h-10 w-10 rounded-lg object-cover" />
            <span className="text-sm text-[#333333]">{label}</span>
            <button type="button" onClick={handleRemove} className="ml-auto text-xs text-[#9F2F2D] hover:text-[#9F2F2D]">Remove</button>
          </>
        ) : (
          <>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#F5F5F5] text-xs text-[#787774]">+</div>
            <span className="text-sm text-[#787774]">{label}</span>
          </>
        )}
        <input ref={inputRef} type="file" accept="image/*" className="hidden" disabled={uploading} onChange={handleFile} />
      </label>
      {uploadError ? <p className="mt-1 text-xs text-[#9F2F2D]">{uploadError}</p> : null}
    </div>
  )
}
