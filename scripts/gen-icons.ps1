Add-Type -AssemblyName System.Drawing

# Regenerates every icon from the artwork in build/source:
#   icon-master-2048.png  full-color app icon (rounded tile with party popper)
#   icon-simple-1024.png  same icon with fewer details, used at <= 48 px
#   glyph-1024.png        solid popper silhouette, used for the macOS menu bar
# Outputs: resources/ (tray + window icons), build/icon.png (packager master),
# build/appx/ (Microsoft Store tiles).

Add-Type -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
public static class AlphaBounds {
    // Bounding box of pixels with alpha > threshold.
    public static Rectangle Find(Bitmap bmp, int threshold) {
        var data = bmp.LockBits(new Rectangle(0, 0, bmp.Width, bmp.Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        int w = bmp.Width, h = bmp.Height;
        byte[] buf = new byte[Math.Abs(data.Stride) * h];
        Marshal.Copy(data.Scan0, buf, 0, buf.Length);
        bmp.UnlockBits(data);
        int minX = w, minY = h, maxX = -1, maxY = -1;
        for (int y = 0; y < h; y++) {
            int row = y * data.Stride;
            for (int x = 0; x < w; x++) {
                if (buf[row + x * 4 + 3] > threshold) {
                    if (x < minX) minX = x; if (x > maxX) maxX = x;
                    if (y < minY) minY = y; if (y > maxY) maxY = y;
                }
            }
        }
        return new Rectangle(minX, minY, maxX - minX + 1, maxY - minY + 1);
    }
}
'@ -ReferencedAssemblies System.Drawing

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$res  = Join-Path $root '..\resources'
$bld  = Join-Path $root '..\build'
$src  = Join-Path $bld 'source'
New-Item -ItemType Directory -Force -Path $res | Out-Null
New-Item -ItemType Directory -Force -Path $bld | Out-Null

# Loads a PNG and crops it to its visible pixels (square for the color art).
function Import-Art([string]$path, [bool]$square) {
    $raw = [System.Drawing.Bitmap]::FromFile($path)
    $rect = [AlphaBounds]::Find($raw, 8)
    if ($square) {
        $side = [Math]::Max($rect.Width, $rect.Height)
        $rect = New-Object System.Drawing.Rectangle ([int]($rect.X - ($side - $rect.Width) / 2)), ([int]($rect.Y - ($side - $rect.Height) / 2)), $side, $side
    }
    $art = New-Object System.Drawing.Bitmap $rect.Width, $rect.Height, ([System.Drawing.Imaging.PixelFormat]::Format32bppPArgb)
    $g = [System.Drawing.Graphics]::FromImage($art)
    $g.DrawImage($raw, (New-Object System.Drawing.Rectangle 0, 0, $rect.Width, $rect.Height), $rect, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()
    $raw.Dispose()
    return $art
}

$master = Import-Art (Join-Path $src 'icon-master-2048.png') $true
$simple = Import-Art (Join-Path $src 'icon-simple-1024.png') $true
$glyph  = Import-Art (Join-Path $src 'glyph-1024.png') $false

# Draws $art scaled to fit $fitW x $fitH, centered on a transparent $width x $height canvas.
function New-ArtCanvas($art, [int]$width, [int]$height, [int]$fitW, [int]$fitH) {
    $bmp = New-Object System.Drawing.Bitmap $width, $height, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $scale = [Math]::Min($fitW / $art.Width, $fitH / $art.Height)
    $w = [Math]::Max(1, [int][Math]::Round($art.Width * $scale))
    $h = [Math]::Max(1, [int][Math]::Round($art.Height * $scale))
    $x = [int][Math]::Floor(($width - $w) / 2)
    $y = [int][Math]::Floor(($height - $h) / 2)
    $attr = New-Object System.Drawing.Imaging.ImageAttributes
    $attr.SetWrapMode([System.Drawing.Drawing2D.WrapMode]::TileFlipXY)
    $g.DrawImage($art, (New-Object System.Drawing.Rectangle $x, $y, $w, $h), 0, 0, $art.Width, $art.Height, [System.Drawing.GraphicsUnit]::Pixel, $attr)
    $attr.Dispose()
    $g.Dispose()
    return $bmp
}

function Save-Png($bmp, [string]$path) {
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

# Color app icon of $iconSize px, centered on a transparent $width x $height canvas.
# Small sizes use the simplified artwork so they stay readable.
function New-ColorTile([int]$width, [int]$height, [int]$iconSize, [string]$path) {
    $art = if ($iconSize -le 48) { $simple } else { $master }
    Save-Png (New-ArtCanvas $art $width $height $iconSize $iconSize) $path
}

function New-ColorPng([int]$size, [string]$path) {
    New-ColorTile $size $size $size $path
}

# macOS menu-bar template: solid black silhouette, which macOS tints automatically.
function New-TemplatePng([int]$size, [string]$path) {
    $pad = [int][Math]::Round($size * 0.06)
    $bmp = New-ArtCanvas $glyph $size $size ($size - 2 * $pad) ($size - 2 * $pad)
    for ($y = 0; $y -lt $size; $y++) {
        for ($x = 0; $x -lt $size; $x++) {
            $a = $bmp.GetPixel($x, $y).A
            $bmp.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($a, 0, 0, 0))
        }
    }
    Save-Png $bmp $path
}

# Tray icons (small)
New-ColorPng    32 (Join-Path $res 'tray-icon.png')
New-TemplatePng 22 (Join-Path $res 'tray-iconTemplate.png')
New-TemplatePng 44 (Join-Path $res 'tray-iconTemplate@2x.png')

# Runtime window/taskbar icon (256x256) and packaging master (1024x1024).
# electron-builder uses build/icon.png to generate .ico for Win and .icns for macOS.
New-ColorPng 256 (Join-Path $res 'app-icon.png')
New-ColorPng 1024 (Join-Path $bld 'icon.png')

# Microsoft Store (AppX) visual assets, picked up from build/appx by electron-builder.
# Each logo ships at several scales so Windows can choose a crisp one per DPI.
$appx = Join-Path $bld 'appx'
New-Item -ItemType Directory -Force -Path $appx | Out-Null
Get-ChildItem $appx -Filter *.png | Remove-Item

# name, base width, base height, icon-to-height ratio
$tiles = @(
    @('StoreLogo',         50,  50, 1.0),
    @('Square44x44Logo',   44,  44, 1.0),
    @('SmallTile',         71,  71, 0.85),
    @('Square150x150Logo', 150, 150, 0.80),
    @('Wide310x150Logo',   310, 150, 0.80),
    @('LargeTile',         310, 310, 0.70)
)
foreach ($t in $tiles) {
    foreach ($scale in 100, 125, 150, 200, 400) {
        $w = [int][Math]::Round($t[1] * $scale / 100)
        $h = [int][Math]::Round($t[2] * $scale / 100)
        $icon = [int][Math]::Round($h * $t[3])
        New-ColorTile $w $h $icon (Join-Path $appx "$($t[0]).scale-$scale.png")
    }
}
# Taskbar / Start / title-bar icons: exact pixel sizes, with and without a tile plate.
foreach ($px in 16, 20, 24, 30, 32, 36, 40, 48, 60, 64, 72, 80, 96, 256) {
    New-ColorTile $px $px $px (Join-Path $appx "Square44x44Logo.targetsize-$px.png")
    New-ColorTile $px $px $px (Join-Path $appx "Square44x44Logo.targetsize-${px}_altform-unplated.png")
    New-ColorTile $px $px $px (Join-Path $appx "Square44x44Logo.targetsize-${px}_altform-lightunplated.png")
}

$master.Dispose(); $simple.Dispose(); $glyph.Dispose()
Get-ChildItem $res, $bld | Select-Object Directory, Name, Length
