Add-Type -AssemblyName System.Drawing
$iconRoot = Join-Path $PSScriptRoot '../assets'
New-Item -ItemType Directory -Force -Path $iconRoot | Out-Null
$iconImages = @()
foreach ($iconSize in @(16, 32, 48, 256)) {
  $iconBitmap = [System.Drawing.Bitmap]::new($iconSize, $iconSize)
  $iconGraphics = [System.Drawing.Graphics]::FromImage($iconBitmap)
  $iconGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $iconGraphics.ScaleTransform($iconSize / 256.0, $iconSize / 256.0)
  $iconGraphics.Clear([System.Drawing.Color]::Transparent)
  $iconBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#49dfb1'))
  $iconGraphics.FillEllipse($iconBrush, 9, 9, 238, 238)
  $boltBrush = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#102a21'))
  $boltPoints = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new(145, 42), [System.Drawing.PointF]::new(62, 140),
    [System.Drawing.PointF]::new(115, 140), [System.Drawing.PointF]::new(100, 214),
    [System.Drawing.PointF]::new(194, 108), [System.Drawing.PointF]::new(140, 108)
  )
  $iconGraphics.FillPolygon($boltBrush, $boltPoints)
  $iconStream = [System.IO.MemoryStream]::new()
  $iconBitmap.Save($iconStream, [System.Drawing.Imaging.ImageFormat]::Png)
  $iconImages += ,($iconStream.ToArray())
  $iconStream.Dispose(); $iconGraphics.Dispose(); $iconBitmap.Dispose(); $iconBrush.Dispose(); $boltBrush.Dispose()
}
$iconFile = [System.IO.File]::Create((Join-Path $iconRoot 'icon.ico'))
$iconWriter = [System.IO.BinaryWriter]::new($iconFile)
$iconWriter.Write([UInt16]0); $iconWriter.Write([UInt16]1); $iconWriter.Write([UInt16]4)
$iconOffset = 6 + 4 * 16
$iconIndex = 0
foreach ($iconSize in @(16, 32, 48, 256)) {
  $iconDimension = if ($iconSize -eq 256) { 0 } else { $iconSize }
  $iconWriter.Write([Byte]$iconDimension); $iconWriter.Write([Byte]$iconDimension)
  $iconWriter.Write([Byte]0); $iconWriter.Write([Byte]0)
  $iconWriter.Write([UInt16]1); $iconWriter.Write([UInt16]32)
  $iconWriter.Write([UInt32]$iconImages[$iconIndex].Length); $iconWriter.Write([UInt32]$iconOffset)
  $iconOffset += $iconImages[$iconIndex].Length; $iconIndex++
}
foreach ($iconImage in $iconImages) { $iconWriter.Write([Byte[]]$iconImage) }
$iconWriter.Dispose(); $iconFile.Dispose()
