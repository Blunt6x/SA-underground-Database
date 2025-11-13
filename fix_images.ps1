# Fix image paths in artists.json by matching to actual files

$imagesDir = "c:\Users\User\Documents\sa-underground-site-with-admin\images"
$artistsJsonPath = "c:\Users\User\Documents\sa-underground-site-with-admin\data\artists.json"

# Get all actual image files
$actualFiles = Get-ChildItem -Path $imagesDir -File | Select-Object -ExpandProperty Name

# Read the artists JSON
$artists = Get-Content -Path $artistsJsonPath -Raw | ConvertFrom-Json

# Create a mapping of basenames (without extensions) to actual filenames
$fileMapping = @{}
foreach ($file in $actualFiles) {
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($file)
    if (-not $fileMapping.ContainsKey($baseName)) {
        $fileMapping[$baseName] = $file
    }
}

# Fix each artist's image path
$fixed = 0
foreach ($artist in $artists) {
    if ($artist.image -and $artist.image -ne "") {
        $imagePath = $artist.image
        $filename = Split-Path -Leaf $imagePath
        $baseName = [System.IO.Path]::GetFileNameWithoutExtension($filename)
        
        # Check if file exists
        $fullPath = Join-Path -Path $imagesDir -ChildPath $filename
        
        if (-not (Test-Path $fullPath)) {
            # Try to find by basename
            if ($fileMapping.ContainsKey($baseName)) {
                $correctFile = $fileMapping[$baseName]
                $artist.image = "images/$correctFile"
                Write-Host "Fixed: $filename -> $correctFile"
                $fixed++
            }
            else {
                Write-Host "WARNING: No matching file found for $filename (basename: $baseName)"
            }
        }
    }
}

# Save the fixed JSON
$jsonContent = $artists | ConvertTo-Json -Depth 10
$jsonContent | Out-File -FilePath $artistsJsonPath -Encoding UTF8

Write-Host "`nFixed $fixed image paths"
