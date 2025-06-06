# Toggle AI Debug Mode for Pino Logging
# This script helps you easily enable/disable AI debugging logs

param(
    [switch]$On,
    [switch]$Off,
    [switch]$Status
)

$envFile = ".env.local"

function Show-Usage {
    Write-Host ""
    Write-Host "AI Debug Toggle Script" -ForegroundColor Yellow
    Write-Host "======================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Usage:"
    Write-Host "  .\scripts\toggle-ai-debug.ps1 -On      # Enable AI debugging logs"
    Write-Host "  .\scripts\toggle-ai-debug.ps1 -Off     # Disable AI debugging logs"
    Write-Host "  .\scripts\toggle-ai-debug.ps1 -Status  # Check current status"
    Write-Host ""
    Write-Host "When AI debugging is OFF:"
    Write-Host "  - AWS deployment logs show normally"
    Write-Host "  - Terminal output is clean"
    Write-Host "  - AI logs still go to app.log file"
    Write-Host ""
    Write-Host "When AI debugging is ON:"
    Write-Host "  - Pretty formatted AI logs in console"
    Write-Host "  - Emojis and structured logging"
    Write-Host "  - May interfere with other console output"
    Write-Host ""
}

function Get-CurrentStatus {
    if (Test-Path $envFile) {
        $content = Get-Content $envFile
        $aiDebugLine = $content | Where-Object { $_ -like "AI_DEBUG=*" }
        if ($aiDebugLine -and $aiDebugLine -like "*true*") {
            return "ON"
        }
    }
    return "OFF"
}

function Set-AiDebug {
    param([bool]$Enable)
    
    $newLine = "AI_DEBUG=$($Enable.ToString().ToLower())"
    
    if (Test-Path $envFile) {
        $content = Get-Content $envFile
        $updatedContent = @()
        $found = $false
        
        foreach ($line in $content) {
            if ($line -like "AI_DEBUG=*") {
                $updatedContent += $newLine
                $found = $true
            } else {
                $updatedContent += $line
            }
        }
        
        if (-not $found) {
            $updatedContent += $newLine
        }
        
        $updatedContent | Set-Content $envFile
    } else {
        $newLine | Set-Content $envFile
    }
}

# Main script logic
if ($Status) {
    $currentStatus = Get-CurrentStatus
    Write-Host ""
    Write-Host "Current AI Debug Status: " -NoNewline
    if ($currentStatus -eq "ON") {
        Write-Host "ON" -ForegroundColor Green
        Write-Host "  - AI logs will show in console with pretty formatting"
        Write-Host "  - May interfere with AWS deployment logs"
    } else {
        Write-Host "OFF" -ForegroundColor Red
        Write-Host "  - Clean console output for AWS deployments"
        Write-Host "  - AI logs still saved to app.log file"
    }
    Write-Host ""
}
elseif ($On) {
    Set-AiDebug $true
    Write-Host ""
    Write-Host "✅ AI debugging ENABLED" -ForegroundColor Green
    Write-Host "   Pretty AI logs will now show in console"
    Write-Host "   Note: This may interfere with AWS deployment logs"
    Write-Host ""
}
elseif ($Off) {
    Set-AiDebug $false
    Write-Host ""
    Write-Host "✅ AI debugging DISABLED" -ForegroundColor Yellow
    Write-Host "   Console output is now clean for AWS deployments"
    Write-Host "   AI logs still saved to app.log file"
    Write-Host ""
}
else {
    Show-Usage
} 