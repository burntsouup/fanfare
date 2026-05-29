Add-Type -AssemblyName System.Drawing

# Generates three icon design options at 256px for visual comparison.
# Outputs to resources/icon-options/{spark,confetti,monogram}.png

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$out  = Join-Path $root '..\resources\icon-options'
New-Item -ItemType Directory -Force -Path $out | Out-Null

function New-GradientCircle([int]$size, [System.Drawing.Graphics]$g) {
    $rect = New-Object System.Drawing.Rectangle 1, 1, ($size - 2), ($size - 2)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect,
        [System.Drawing.Color]::FromArgb(255, 255, 95, 168),
        [System.Drawing.Color]::FromArgb(255, 124, 92, 255),
        135.0)
    $g.FillEllipse($brush, $rect)
    $brush.Dispose()
}

function Save-Bitmap([System.Drawing.Bitmap]$bmp, [string]$path) {
    $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
}

# Option A: Sparkle / 4-point star on gradient
function New-SparkIcon([int]$size, [string]$path) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)
    New-GradientCircle $size $g

    $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(245, 255, 255, 255))
    $cx = $size / 2.0
    $cy = $size / 2.0
    # Big sparkle (4-point star) made of two crossed thin rhombuses.
    $half = $size * 0.34
    $thick = $size * 0.07
    $pts1 = @(
        (New-Object System.Drawing.PointF($cx, ($cy - $half))),
        (New-Object System.Drawing.PointF(($cx + $thick), $cy)),
        (New-Object System.Drawing.PointF($cx, ($cy + $half))),
        (New-Object System.Drawing.PointF(($cx - $thick), $cy))
    )
    $pts2 = @(
        (New-Object System.Drawing.PointF(($cx - $half), $cy)),
        (New-Object System.Drawing.PointF($cx, ($cy - $thick))),
        (New-Object System.Drawing.PointF(($cx + $half), $cy)),
        (New-Object System.Drawing.PointF($cx, ($cy + $thick)))
    )
    $g.FillPolygon($white, $pts1)
    $g.FillPolygon($white, $pts2)

    # Two small accent sparkles
    $small = $size * 0.10
    $tiny  = $size * 0.022
    $sx = $cx + $size * 0.22
    $sy = $cy - $size * 0.22
    $g.FillPolygon($white, @(
        (New-Object System.Drawing.PointF($sx, ($sy - $small))),
        (New-Object System.Drawing.PointF(($sx + $tiny), $sy)),
        (New-Object System.Drawing.PointF($sx, ($sy + $small))),
        (New-Object System.Drawing.PointF(($sx - $tiny), $sy))
    ))
    $g.FillPolygon($white, @(
        (New-Object System.Drawing.PointF(($sx - $small), $sy)),
        (New-Object System.Drawing.PointF($sx, ($sy - $tiny))),
        (New-Object System.Drawing.PointF(($sx + $small), $sy)),
        (New-Object System.Drawing.PointF($sx, ($sy + $tiny)))
    ))
    $sx2 = $cx - $size * 0.24
    $sy2 = $cy + $size * 0.20
    $small2 = $size * 0.075
    $g.FillPolygon($white, @(
        (New-Object System.Drawing.PointF($sx2, ($sy2 - $small2))),
        (New-Object System.Drawing.PointF(($sx2 + $tiny), $sy2)),
        (New-Object System.Drawing.PointF($sx2, ($sy2 + $small2))),
        (New-Object System.Drawing.PointF(($sx2 - $tiny), $sy2))
    ))
    $g.FillPolygon($white, @(
        (New-Object System.Drawing.PointF(($sx2 - $small2), $sy2)),
        (New-Object System.Drawing.PointF($sx2, ($sy2 - $tiny))),
        (New-Object System.Drawing.PointF(($sx2 + $small2), $sy2)),
        (New-Object System.Drawing.PointF($sx2, ($sy2 + $tiny)))
    ))

    $white.Dispose()
    $g.Dispose()
    Save-Bitmap $bmp $path
}

# Option B: Confetti pieces scattered on gradient
function New-ConfettiIcon([int]$size, [string]$path) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)
    New-GradientCircle $size $g

    # Confetti palette: warm pastels that pop on the pink/purple bg
    $colors = @(
        [System.Drawing.Color]::FromArgb(255, 255, 230, 120),  # yellow
        [System.Drawing.Color]::FromArgb(255, 120, 230, 200),  # mint
        [System.Drawing.Color]::FromArgb(255, 255, 255, 255),  # white
        [System.Drawing.Color]::FromArgb(255, 255, 180, 100),  # peach
        [System.Drawing.Color]::FromArgb(255, 180, 220, 255)   # sky
    )

    # Deterministic pseudo-random layout so re-generations are stable.
    $rng = New-Object System.Random 42
    $pieces = 16
    for ($i = 0; $i -lt $pieces; $i++) {
        $colorIdx = $rng.Next(0, $colors.Length)
        $brush = New-Object System.Drawing.SolidBrush $colors[$colorIdx]
        $w = $size * (0.06 + ($rng.NextDouble() * 0.04))
        $h = $size * (0.02 + ($rng.NextDouble() * 0.025))
        # Constrain to ~inner 70% of the disc so nothing hits the rim
        $angle = $rng.NextDouble() * 2 * [Math]::PI
        $radius = ($size * 0.32) * [Math]::Sqrt($rng.NextDouble())
        $x = ($size / 2.0) + [Math]::Cos($angle) * $radius - ($w / 2.0)
        $y = ($size / 2.0) + [Math]::Sin($angle) * $radius - ($h / 2.0)
        $rot = ($rng.NextDouble() - 0.5) * 90

        $state = $g.Save()
        $g.TranslateTransform([single]($x + $w / 2), [single]($y + $h / 2))
        $g.RotateTransform([single]$rot)
        $g.FillRectangle($brush, -[single]($w / 2), -[single]($h / 2), [single]$w, [single]$h)
        $g.Restore($state)
        $brush.Dispose()
    }
    $g.Dispose()
    Save-Bitmap $bmp $path
}

# Option C: Bold "P" monogram on gradient
function New-MonogramIcon([int]$size, [string]$path) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
    $g.Clear([System.Drawing.Color]::Transparent)
    New-GradientCircle $size $g

    $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(245, 255, 255, 255))
    $font = New-Object System.Drawing.Font('Segoe UI', ($size * 0.55), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    $sf.LineAlignment = [System.Drawing.StringAlignment]::Center
    # Slight upward nudge so the P sits visually centered (descenderless letters look low otherwise)
    $rect = New-Object System.Drawing.RectangleF 0, ($size * -0.03), $size, $size
    $g.DrawString('P', $font, $white, $rect, $sf)
    $font.Dispose()
    $white.Dispose()
    $g.Dispose()
    Save-Bitmap $bmp $path
}

# Option D: Burst — radiating short lines from a center dot (manga "wow" style)
function New-BurstIcon([int]$size, [string]$path) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)
    New-GradientCircle $size $g

    $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(245, 255, 255, 255))
    $pen = New-Object System.Drawing.Pen($white, [single]($size * 0.045))
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

    $cx = $size / 2.0
    $cy = $size / 2.0
    $inner = $size * 0.16
    $outer = $size * 0.32
    $rays = 12
    for ($i = 0; $i -lt $rays; $i++) {
        $angle = ($i / $rays) * 2 * [Math]::PI
        $x1 = $cx + [Math]::Cos($angle) * $inner
        $y1 = $cy + [Math]::Sin($angle) * $inner
        $x2 = $cx + [Math]::Cos($angle) * $outer
        $y2 = $cy + [Math]::Sin($angle) * $outer
        $g.DrawLine($pen, [single]$x1, [single]$y1, [single]$x2, [single]$y2)
    }

    $dot = $size * 0.09
    $g.FillEllipse($white, [single]($cx - $dot), [single]($cy - $dot), [single]($dot * 2), [single]($dot * 2))

    $pen.Dispose()
    $white.Dispose()
    $g.Dispose()
    Save-Bitmap $bmp $path
}

# Option E: Wave — three concentric arcs (reaction wave / sound)
function New-WaveIcon([int]$size, [string]$path) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)
    New-GradientCircle $size $g

    $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(245, 255, 255, 255))
    $pen = New-Object System.Drawing.Pen($white, [single]($size * 0.05))
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round

    # Three arcs facing right, like sound waves emanating
    $cx = $size * 0.40
    $cy = $size / 2.0
    $radii = @(0.14, 0.24, 0.34)
    foreach ($r in $radii) {
        $rp = $size * $r
        $rect = New-Object System.Drawing.RectangleF ([single]($cx - $rp)), ([single]($cy - $rp)), ([single]($rp * 2)), ([single]($rp * 2))
        $g.DrawArc($pen, $rect, -55, 110)
    }

    # Center dot (origin of the waves)
    $dot = $size * 0.05
    $g.FillEllipse($white, [single]($cx - $dot), [single]($cy - $dot), [single]($dot * 2), [single]($dot * 2))

    $pen.Dispose()
    $white.Dispose()
    $g.Dispose()
    Save-Bitmap $bmp $path
}

# Option F: Bubble — rounded square with a sparkle inside (departs from circle silhouette)
function New-BubbleIcon([int]$size, [string]$path) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)

    # Rounded square gradient — modern app-icon silhouette
    $radius = $size * 0.22
    $rect = New-Object System.Drawing.Rectangle 1, 1, ($size - 2), ($size - 2)
    $path2 = New-Object System.Drawing.Drawing2D.GraphicsPath
    $d = $radius * 2
    $path2.AddArc(1, 1, $d, $d, 180, 90)
    $path2.AddArc($size - 1 - $d, 1, $d, $d, 270, 90)
    $path2.AddArc($size - 1 - $d, $size - 1 - $d, $d, $d, 0, 90)
    $path2.AddArc(1, $size - 1 - $d, $d, $d, 90, 90)
    $path2.CloseFigure()
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
        $rect,
        [System.Drawing.Color]::FromArgb(255, 255, 95, 168),
        [System.Drawing.Color]::FromArgb(255, 124, 92, 255),
        135.0)
    $g.FillPath($brush, $path2)

    # Single bold 4-point sparkle in the center
    $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(245, 255, 255, 255))
    $cx = $size / 2.0
    $cy = $size / 2.0
    $half = $size * 0.32
    $thick = $size * 0.08
    $g.FillPolygon($white, @(
        (New-Object System.Drawing.PointF($cx, ($cy - $half))),
        (New-Object System.Drawing.PointF(($cx + $thick), $cy)),
        (New-Object System.Drawing.PointF($cx, ($cy + $half))),
        (New-Object System.Drawing.PointF(($cx - $thick), $cy))
    ))
    $g.FillPolygon($white, @(
        (New-Object System.Drawing.PointF(($cx - $half), $cy)),
        (New-Object System.Drawing.PointF($cx, ($cy - $thick))),
        (New-Object System.Drawing.PointF(($cx + $half), $cy)),
        (New-Object System.Drawing.PointF($cx, ($cy + $thick)))
    ))

    $brush.Dispose()
    $path2.Dispose()
    $white.Dispose()
    $g.Dispose()
    Save-Bitmap $bmp $path
}

# Option G: Hands — two simple stylized clapping hand shapes
function New-HandsIcon([int]$size, [string]$path) {
    $bmp = New-Object System.Drawing.Bitmap $size, $size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $g.Clear([System.Drawing.Color]::Transparent)
    New-GradientCircle $size $g

    $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(245, 255, 255, 255))

    # Hand = rounded rectangle (palm) angled inward. Two of them touching at top-center.
    $hw = $size * 0.22
    $hh = $size * 0.42
    $gap = $size * 0.02

    # Left hand
    $state = $g.Save()
    $g.TranslateTransform([single]($size * 0.5 - $gap), [single]($size * 0.5))
    $g.RotateTransform(-18)
    $g.FillEllipse($white, [single](-$hw - 2), [single](-$hh / 2), [single]($hw * 2), [single]$hh)
    $g.Restore($state)

    # Right hand
    $state = $g.Save()
    $g.TranslateTransform([single]($size * 0.5 + $gap), [single]($size * 0.5))
    $g.RotateTransform(18)
    $g.FillEllipse($white, [single]2, [single](-$hh / 2), [single]($hw * 2), [single]$hh)
    $g.Restore($state)

    # Tiny sparkle dots radiating upward for "applause"
    $dot = $size * 0.025
    $sparks = @(
        @(0.30, 0.18), @(0.70, 0.18), @(0.50, 0.10)
    )
    foreach ($s in $sparks) {
        $x = $size * $s[0] - $dot
        $y = $size * $s[1] - $dot
        $g.FillEllipse($white, [single]$x, [single]$y, [single]($dot * 2), [single]($dot * 2))
    }

    $white.Dispose()
    $g.Dispose()
    Save-Bitmap $bmp $path
}

$size = 256
New-SparkIcon    $size (Join-Path $out 'spark.png')
New-ConfettiIcon $size (Join-Path $out 'confetti.png')
New-MonogramIcon $size (Join-Path $out 'monogram.png')
New-BurstIcon    $size (Join-Path $out 'burst.png')
New-WaveIcon     $size (Join-Path $out 'wave.png')
New-BubbleIcon   $size (Join-Path $out 'bubble.png')
New-HandsIcon    $size (Join-Path $out 'hands.png')

Get-ChildItem $out | Select-Object Name, Length
