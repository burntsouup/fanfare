Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$res  = Join-Path $root '..\resources'
$bld  = Join-Path $root '..\build'
New-Item -ItemType Directory -Force -Path $res | Out-Null
New-Item -ItemType Directory -Force -Path $bld | Out-Null

# Burst geometry (shared by color + template variants)
$RAYS         = 12
$INNER_RATIO  = 0.16
$OUTER_RATIO  = 0.32
$STROKE_RATIO = 0.045
$DOT_RATIO    = 0.09

function Draw-BurstRays([System.Drawing.Graphics]$g, [System.Drawing.Pen]$pen, [System.Drawing.Brush]$dotBrush, [int]$size) {
    $cx = $size / 2.0
    $cy = $size / 2.0
    $inner = $size * $INNER_RATIO
    $outer = $size * $OUTER_RATIO
    for ($i = 0; $i -lt $RAYS; $i++) {
        $angle = ($i / $RAYS) * 2 * [Math]::PI
        $x1 = $cx + [Math]::Cos($angle) * $inner
        $y1 = $cy + [Math]::Sin($angle) * $inner
        $x2 = $cx + [Math]::Cos($angle) * $outer
        $y2 = $cy + [Math]::Sin($angle) * $outer
        $g.DrawLine($pen, [single]$x1, [single]$y1, [single]$x2, [single]$y2)
    }
    $dot = $size * $DOT_RATIO
    $g.FillEllipse($dotBrush, [single]($cx - $dot), [single]($cy - $dot), [single]($dot * 2), [single]($dot * 2))
}

# Color burst: pink-purple gradient disc with white rays + dot
function New-ColorPng([int]$size, [string]$path) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)

    $rect = New-Object System.Drawing.Rectangle 1, 1, ($size - 2), ($size - 2)
    $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect,
        [System.Drawing.Color]::FromArgb(255, 255, 95, 168),
        [System.Drawing.Color]::FromArgb(255, 124, 92, 255),
        135.0)
    $g.FillEllipse($bg, $rect)
    $bg.Dispose()

    $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(245, 255, 255, 255))
    $pen = New-Object System.Drawing.Pen($white, [single]($size * $STROKE_RATIO))
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    Draw-BurstRays $g $pen $white $size

    $pen.Dispose()
    $white.Dispose()
    $g.Dispose()
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

# Template burst: solid black disc with rays + dot cut out (transparent)
# macOS auto-tints template images for menu bar.
function New-TemplatePng([int]$size, [string]$path) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)

    $black = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 0, 0, 0))
    $pad = [int]($size * 0.05)
    $g.FillEllipse($black, $pad, $pad, $size - 2 * $pad, $size - 2 * $pad)

    $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $clear = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(0, 0, 0, 0))
    $cutPen = New-Object System.Drawing.Pen($clear, [single]($size * $STROKE_RATIO))
    $cutPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $cutPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    Draw-BurstRays $g $cutPen $clear $size

    $cutPen.Dispose()
    $clear.Dispose()
    $black.Dispose()
    $g.Dispose()
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

# Tray icons (small)
New-ColorPng    32 (Join-Path $res 'tray-icon.png')
New-TemplatePng 22 (Join-Path $res 'tray-iconTemplate.png')
New-TemplatePng 44 (Join-Path $res 'tray-iconTemplate@2x.png')

# Runtime window/taskbar icon (256x256) and packaging master (512x512).
# electron-builder uses build/icon.png to generate .ico for Win and .icns for macOS.
New-ColorPng 256 (Join-Path $res 'app-icon.png')
New-ColorPng 512 (Join-Path $bld 'icon.png')

Get-ChildItem $res, $bld | Select-Object Directory, Name, Length
