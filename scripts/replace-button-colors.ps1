# Replace all button gray/black backgrounds with accent green
param([switch]$DryRun)

$ErrorActionPreference = "Stop"
$srcDir = "D:\ai-practise\hotel-system\src"
$utf8 = [System.Text.UTF8Encoding]::new($false)

# ── Step 1: Safe blanket replacements (bg-gray-950, hover:bg-gray-800, hover:bg-gray-900) ──
Write-Host "Step 1: Safe blanket replacements..." -ForegroundColor Cyan

$globalPatterns = @(
    @{old = 'bg-gray-950'; new = 'bg-accent'},
    @{old = 'hover:bg-gray-800'; new = 'hover:bg-accent-hover'},
    @{old = 'hover:bg-gray-900'; new = 'hover:bg-accent-hover'}
)

$allTsFiles = Get-ChildItem "$srcDir" -Recurse -Include "*.tsx","*.ts" -Exclude "*.d.ts","*.test.ts","*.test.tsx","*.spec.ts","*.spec.tsx"
$count = 0
foreach ($file in $allTsFiles) {
    $path = $file.FullName
    $content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
    $original = $content
    foreach ($pat in $globalPatterns) {
        $content = $content -replace [regex]::Escape($pat.old), $pat.new
    }
    if ($content -ne $original) {
        if (-not $DryRun) {
            [System.IO.File]::WriteAllText($path, $content, $utf8)
        }
        $count++
    }
}
Write-Host "  -> $count files modified" -ForegroundColor Green

# ── Step 2: bg-gray-900 → bg-accent (button/selection files only, NOT tooltips) ──
Write-Host "`nStep 2: bg-gray-900 -> bg-accent..." -ForegroundColor Cyan

$bgGray900Files = @(
    "$srcDir\modules\accounting\components\InvoiceWizard.tsx",
    "$srcDir\modules\pricing\components\PriceOverridesSection.tsx",
    "$srcDir\modules\reservations\components\NewContactModal.tsx",
    "$srcDir\modules\reservations\components\NewReservationPage.tsx",
    "$srcDir\modules\rooms\components\RoomDetailPage.tsx",
    "$srcDir\pwa\components\InstallPrompt.tsx",
    "$srcDir\shared\components\Pagination.tsx"
)

$count = 0
foreach ($file in $bgGray900Files) {
    if (-not (Test-Path $file)) { continue }
    $content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
    $original = $content
    $content = $content -replace [regex]::Escape('bg-gray-900'), 'bg-accent'
    if ($content -ne $original) {
        if (-not $DryRun) {
            [System.IO.File]::WriteAllText($file, $content, $utf8)
        }
        $count++
    }
}
Write-Host "  -> $count files modified" -ForegroundColor Green

# ── Step 3: bg-black -> bg-accent for button files (NOT bg-black/xx overlays) ──
Write-Host "`nStep 3: bg-black -> bg-accent..." -ForegroundColor Cyan

$bgBlackButtonFiles = @(
    "$srcDir\app\[locale]\(auth)\login\page.tsx",
    "$srcDir\app\offline\retry-button.tsx",
    "$srcDir\modules\accounting\components\DefaultPricingTab.tsx",
    "$srcDir\modules\accounting\components\ExpenseFormModal.tsx",
    "$srcDir\modules\accounting\components\InvoicePaymentsModal.tsx",
    "$srcDir\modules\contacts\components\ContactForm.tsx",
    "$srcDir\modules\contacts\components\PriceOverridesSection.tsx",
    "$srcDir\modules\pricing\components\PricingTab.tsx",
    "$srcDir\modules\rooms\components\RoomManagement.tsx",
    "$srcDir\modules\rooms\components\RoomsTab.tsx",
    "$srcDir\modules\room-types\components\RoomTypesTab.tsx",
    "$srcDir\modules\users\components\UserForm.tsx",
    "$srcDir\pwa\components\InstallPrompt.tsx",
    "$srcDir\shared\components\Pagination.tsx"
)

$count = 0
foreach ($file in $bgBlackButtonFiles) {
    if (-not (Test-Path $file)) { continue }
    $content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
    $original = $content
    $content = $content -replace 'bg-black(?!\/)', 'bg-accent'
    if ($content -ne $original) {
        if (-not $DryRun) {
            [System.IO.File]::WriteAllText($file, $content, $utf8)
        }
        $count++
    }
}
Write-Host "  -> $count files modified" -ForegroundColor Green

# ── Step 4: Specific hex color replacements ──
Write-Host "`nStep 4: Hex color -> bg-accent..." -ForegroundColor Cyan

$count = 0

$file = "$srcDir\modules\rooms\components\RoomDetailPage.tsx"
if (Test-Path $file) {
    $content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
    $original = $content
    $content = $content -replace [regex]::Escape('bg-[#111111]'), 'bg-accent'
    $content = $content -replace [regex]::Escape('hover:bg-[#333333]'), 'hover:bg-accent-hover'
    if ($content -ne $original) {
        if (-not $DryRun) {
            [System.IO.File]::WriteAllText($file, $content, $utf8)
        }
        $count++
    }
}

$file = "$srcDir\components\layout\NotificationsMenu.tsx"
if (Test-Path $file) {
    $content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
    $original = $content
    $content = $content -replace [regex]::Escape('bg-[#101a24]'), 'bg-accent'
    $content = $content -replace [regex]::Escape('hover:bg-[#101a24]'), 'hover:bg-accent-hover'
    if ($content -ne $original) {
        if (-not $DryRun) {
            [System.IO.File]::WriteAllText($file, $content, $utf8)
        }
        $count++
    }
}

$file = "$srcDir\i18n\components\LanguageSwitcher.tsx"
if (Test-Path $file) {
    $content = [System.IO.File]::ReadAllText($file, [System.Text.Encoding]::UTF8)
    $original = $content
    $content = $content -replace [regex]::Escape('bg-[#101a24]'), 'bg-accent'
    if ($content -ne $original) {
        if (-not $DryRun) {
            [System.IO.File]::WriteAllText($file, $content, $utf8)
        }
        $count++
    }
}

Write-Host "  -> $count files modified" -ForegroundColor Green

Write-Host "`nDONE" -ForegroundColor Green
