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

# Color app mark: party popper with confetti on a pink-violet rounded square.
# Drawn in unit coordinates ([0,1] x [0,1]) and scaled to any size.
function Hex([int]$a, [string]$hex) {
    [System.Drawing.Color]::FromArgb($a, [Convert]::ToInt32($hex.Substring(1,2),16), [Convert]::ToInt32($hex.Substring(3,2),16), [Convert]::ToInt32($hex.Substring(5,2),16))
}
function Pt([double]$x, [double]$y) { New-Object System.Drawing.PointF ([single]$x), ([single]$y) }

function Draw-Piece($g, [double]$x, [double]$y, [double]$w, [double]$h, [double]$rot, $brush) {
    $st = $g.Save()
    $g.TranslateTransform([single]$x, [single]$y)
    $g.RotateTransform([single]$rot)
    $g.FillRectangle($brush, [single](-$w/2), [single](-$h/2), [single]$w, [single]$h)
    $g.Restore($st)
}

function Draw-Sparkle($g, [double]$cx, [double]$cy, [double]$R, $brush) {
    $inr = $R * 0.24
    $pts = @()
    for ($i = 0; $i -lt 8; $i++) {
        $a = $i * [Math]::PI / 4 - [Math]::PI / 2
        $rad = if ($i % 2 -eq 0) { $R } else { $inr }
        $pts += (Pt ($cx + [Math]::Cos($a) * $rad) ($cy + [Math]::Sin($a) * $rad))
    }
    $g.FillPolygon($brush, [System.Drawing.PointF[]]$pts)
}

# Draws the Fanfare mark into the square [0,$S] x [0,$S].
function Draw-Mark($g, [double]$S, [bool]$plate) {
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.ScaleTransform([single]$S, [single]$S)

    if ($plate) {
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $m = 0.03; $d = 0.44
        $path.AddArc($m, $m, $d, $d, 180, 90)
        $path.AddArc(1 - $m - $d, $m, $d, $d, 270, 90)
        $path.AddArc(1 - $m - $d, 1 - $m - $d, $d, $d, 0, 90)
        $path.AddArc($m, 1 - $m - $d, $d, $d, 90, 90)
        $path.CloseFigure()
        $bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush((Pt 0 0), (Pt 1 1), (Hex 255 '#FF5FA8'), (Hex 255 '#6B4DFF'))
        $g.FillPath($bg, $path)
        $bg.Dispose(); $path.Dispose()
    }

    $A = Pt 0.19 0.83; $B = Pt 0.33 0.42; $Cc = Pt 0.58 0.67; $M = Pt 0.455 0.545
    $gold = New-Object System.Drawing.Drawing2D.LinearGradientBrush($A, $M, (Hex 255 '#FF9F2E'), (Hex 255 '#FFE27A'))
    $goldPen = New-Object System.Drawing.Pen($gold, [single]0.045)
    $goldPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $tri = [System.Drawing.PointF[]]@($A, $B, $Cc)
    $g.FillPolygon($gold, $tri)
    $g.DrawPolygon($goldPen, $tri)

    # Stripes across the cone
    $stripe = New-Object System.Drawing.Pen((Hex 255 '#FF4D94'), [single]0.03)
    $stripe.StartCap = [System.Drawing.Drawing2D.LineCap]::Round; $stripe.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    foreach ($t in 0.38, 0.68) {
        $p1 = Pt ($A.X + ($B.X - $A.X) * $t) ($A.Y + ($B.Y - $A.Y) * $t)
        $p2 = Pt ($A.X + ($Cc.X - $A.X) * $t) ($A.Y + ($Cc.Y - $A.Y) * $t)
        $g.DrawLine($stripe, $p1, $p2)
    }
    # Mouth rim
    $rim = New-Object System.Drawing.Pen((Hex 255 '#FF7A2E'), [single]0.05)
    $rim.StartCap = [System.Drawing.Drawing2D.LineCap]::Round; $rim.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $g.DrawLine($rim, $B, $Cc)

    $white = New-Object System.Drawing.SolidBrush (Hex 255 '#FFFFFF')
    $cyan = New-Object System.Drawing.SolidBrush (Hex 255 '#5CE6F0')
    $yel = New-Object System.Drawing.SolidBrush (Hex 255 '#FFE27A')
    $lime = New-Object System.Drawing.SolidBrush (Hex 255 '#9CF28A')

    # Streamers
    $sw = New-Object System.Drawing.Pen((Hex 255 '#FFFFFF'), [single]0.022)
    $sw.StartCap = [System.Drawing.Drawing2D.LineCap]::Round; $sw.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $sy = New-Object System.Drawing.Pen((Hex 255 '#FFE27A'), [single]0.022)
    $sy.StartCap = [System.Drawing.Drawing2D.LineCap]::Round; $sy.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $g.DrawBezier($sw, (Pt 0.47 0.50), (Pt 0.48 0.30), (Pt 0.66 0.40), (Pt 0.64 0.20))
    $g.DrawBezier($sy, (Pt 0.52 0.56), (Pt 0.72 0.50), (Pt 0.66 0.68), (Pt 0.86 0.60))

    # Confetti
    Draw-Sparkle $g 0.76 0.27 0.115 $white
    Draw-Sparkle $g 0.30 0.20 0.06 $yel
    Draw-Sparkle $g 0.87 0.82 0.05 $white
    $g.FillEllipse($cyan, [single]0.805, [single]0.405, [single]0.07, [single]0.07)
    $g.FillEllipse($yel,  [single]0.50, [single]0.125, [single]0.055, [single]0.055)
    $g.FillEllipse($white,[single]0.715, [single]0.60, [single]0.045, [single]0.045)
    Draw-Piece $g 0.60 0.33 0.075 0.032 35 $cyan
    Draw-Piece $g 0.80 0.57 0.075 0.032 -25 $lime
    Draw-Piece $g 0.40 0.34 0.07 0.03 70 $white
    Draw-Piece $g 0.68 0.15 0.07 0.03 -40 $yel
    Draw-Piece $g 0.90 0.40 0.065 0.028 20 $white
    Draw-Piece $g 0.85 0.17 0.06 0.026 -60 $cyan
}

function New-ColorPng([int]$size, [string]$path) {
    New-ColorTile $size $size $size $path
}

# App mark of $iconSize px, centered on a transparent $width x $height canvas.
function New-ColorTile([int]$width, [int]$height, [int]$iconSize, [string]$path) {
    $bmp = New-Object System.Drawing.Bitmap $width, $height
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.TranslateTransform([single][Math]::Floor(($width - $iconSize) / 2), [single][Math]::Floor(($height - $iconSize) / 2))
    Draw-Mark $g $iconSize $true
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

# Microsoft Store (AppX) visual assets, picked up from build/appx by electron-builder.
# Each logo ships at several scales so Windows can choose a crisp one per DPI.
$appx = Join-Path $bld 'appx'
New-Item -ItemType Directory -Force -Path $appx | Out-Null
Get-ChildItem $appx -Filter *.png | Remove-Item

# name, base width, base height, icon-to-height ratio
$tiles = @(
    @('StoreLogo',         50,  50, 0.96),
    @('Square44x44Logo',   44,  44, 0.96),
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
    $icon = $px
    New-ColorTile $px $px $icon (Join-Path $appx "Square44x44Logo.targetsize-$px.png")
    New-ColorTile $px $px $icon (Join-Path $appx "Square44x44Logo.targetsize-${px}_altform-unplated.png")
    New-ColorTile $px $px $icon (Join-Path $appx "Square44x44Logo.targetsize-${px}_altform-lightunplated.png")
}

Get-ChildItem $res, $bld | Select-Object Directory, Name, Length
