param(
  [string]$TargetDir = "src"
)

$TargetDir = Join-Path -Path (Get-Location) -ChildPath $TargetDir

$replacements = @(
  @('rounded-[34px]', 'rounded-xl'),
  @('rounded-[26px]', 'rounded-xl'),
  @('rounded-[24px]', 'rounded-xl'),
  @('rounded-2xl', 'rounded-xl'),
  @('shadow-[0_10px_24px_rgba(0,0,0,0.05)]', ''),
  @('shadow-[0_18px_34px_rgba(0,0,0,0.08)]', ''),
  @('shadow-[0_2px_12px_rgba(0,0,0,0.06)]', ''),
  @('shadow-[0_4px_24px_rgba(0,0,0,0.12)]', ''),
  @('shadow-[0_18px_40px_rgba(0,0,0,0.12)]', ''),
  @('shadow-[0_24px_60px_rgba(10,10,10,0.08)]', ''),
  @('shadow-[0_10px_24px_rgba(80, 58, 38, 0.06)]', ''),
  @('shadow-[0_18px_45px_rgba(80, 58, 38, 0.08)]', ''),
  @('shadow-card', ''),
  @('shadow-soft', ''),
  @('shadow-sm', ''),
  @('shadow-md', ''),
  @('shadow-lg', ''),
  @('shadow-xl', ''),
  @('transition-shadow duration-200', 'transition duration-200'),
  @('hover:shadow-[0_18px_34px_rgba(0,0,0,0.08)]', ''),
  @('hover:shadow-[0_18px_34px_rgba(80, 58, 38, 0.08)]', ''),
  @('text-gray-950', 'text-[#1A1A1A]'),
  @('text-gray-900', 'text-[#1A1A1A]'),
  @('text-gray-800', 'text-[#333333]'),
  @('text-gray-700', 'text-[#333333]'),
  @('text-gray-600', 'text-[#555555]'),
  @('text-gray-500', 'text-[#787774]'),
  @('text-gray-400', 'text-[#787774]'),
  @('text-gray-300', 'text-[#BBBBBB]'),
  @('text-gray-200', 'text-[#D4D4D4]'),
  @('text-red-600', 'text-[#9F2F2D]'),
  @('text-red-500', 'text-[#9F2F2D]'),
  @('text-red-700', 'text-[#9F2F2D]'),
  @('text-red-400', 'text-[#9F2F2D]'),
  @('text-green-500', 'text-[#346538]'),
  @('text-emerald-600', 'text-[#346538]'),
  @('text-emerald-700', 'text-[#346538]'),
  @('text-amber-700', 'text-[#956400]'),
  @('text-sky-700', 'text-[#1F6C9F]'),
  @('text-blue-600', 'text-[#1A1A1A]'),
  @('bg-gray-100', 'bg-[#F5F5F5]'),
  @('bg-gray-200', 'bg-[#EAEAEA]'),
  @('bg-gray-50', 'bg-[#F9F9F8]'),
  @('bg-gray-900', 'bg-[#1A1A1A]'),
  @('bg-gray-300', 'bg-[#D4D4D4]'),
  @('bg-red-50', 'bg-[#FDEBEC]'),
  @('bg-red-100', 'bg-[#FDEBEC]'),
  @('bg-emerald-50', 'bg-[#EDF3EC]'),
  @('bg-amber-50', 'bg-[#FBF3DB]'),
  @('bg-sky-50', 'bg-[#E1F3FE]'),
  @('border-gray-100', 'border-[#EAEAEA]'),
  @('border-gray-200', 'border-[#EAEAEA]'),
  @('border-gray-300', 'border-[#D4D4D4]'),
  @('border-gray-950', 'border-[#1A1A1A]'),
  @('border-emerald-100', 'border-[#EDF3EC]'),
  @('border-amber-100', 'border-[#FBF3DB]'),
  @('border-red-100', 'border-[#FDEBEC]'),
  @('border-sky-100', 'border-[#E1F3FE]'),
  @('bg-accent', 'bg-[#1A1A1A]'),
  @('bg-accent-hover', 'bg-[#333333]'),
  @('text-ink', 'text-[#1A1A1A]'),
  @('text-ink-muted', 'text-[#787774]'),
  @('border-line', 'border-[#EAEAEA]'),
  @('bg-surface-muted', 'bg-[#F9F9F8]'),
  @('hover:bg-accent', 'hover:bg-[#333333]'),
  @('hover:bg-accent-hover', 'hover:bg-[#333333]'),
  @('hover:bg-gray-50/80', 'hover:bg-[#F9F9F8]'),
  @('hover:bg-gray-50', 'hover:bg-[#F9F9F8]'),
  @('hover:bg-gray-200', 'hover:bg-[#EAEAEA]'),
  @('hover:bg-gray-100', 'hover:bg-[#EAEAEA]'),
  @('hover:text-gray-600', 'hover:text-[#555555]'),
  @('hover:text-gray-900', 'hover:text-[#1A1A1A]'),
  @('hover:border-gray-950', 'hover:border-[#1A1A1A]'),
  @('bg-[#1A1A1A]-hover', 'bg-[#333333]'),
  @('hover:bg-[#1A1A1A]-hover', 'hover:bg-[#333333]'),
  @('border-t-indigo-500', 'border-t-[#333333]'),
  @('border-t-emerald-500', 'border-t-[#333333]'),
  @('border-t-amber-500', 'border-t-[#333333]'),
  @('border-t-violet-500', 'border-t-[#333333]'),
  @('border-t-rose-500', 'border-t-[#333333]'),
  @('border-t-cyan-500', 'border-t-[#333333]'),
  @('border-t-[3px] ', ''),
  @('text-gray-50', 'text-[#F9F9F8]')
)

$files = Get-ChildItem -Path $TargetDir -Recurse -Include "*.tsx","*.ts" | Where-Object { $_.FullName -notmatch '\\node_modules\\' }
$totalFiles = $files.Count
$modifiedCount = 0

foreach ($file in $files) {
  try {
    $originalContent = [System.IO.File]::ReadAllText($file.FullName)
    $content = $originalContent
    
    foreach ($replacement in $replacements) {
      $content = $content.Replace($replacement[0], $replacement[1])
    }
    
    if ($content -ne $originalContent) {
      [System.IO.File]::WriteAllText($file.FullName, $content, [System.Text.Encoding]::UTF8)
      $modifiedCount++
    }
  } catch {
    Write-Output "Error: $($file.Name): $_"
  }
}

Write-Output "Done. Modified $modifiedCount of $totalFiles files."
