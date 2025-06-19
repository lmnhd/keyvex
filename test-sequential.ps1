# Test Sequential Flow with PowerShell
Write-Host "🎯 TESTING RESTORED SEQUENTIAL FLOW" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green

$testPayload = @{
    userInput = @{
        description = "A simple trip planning tool that calculates budget based on destination and duration"
        targetAudience = "travelers"
        industry = "travel"
        toolType = "calculator"
    }
    selectedModel = "claude-3-7-sonnet-20250219"
    testingOptions = @{
        skipFunctionPlanner = $false
        isSequentialMode = $true
    }
} | ConvertTo-Json -Depth 10

try {
    Write-Host "📤 Triggering orchestration with sequential mode..." -ForegroundColor Yellow
    
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/ai/product-tool-creation-v2/orchestrate/start" `
                                 -Method POST `
                                 -ContentType "application/json" `
                                 -Body $testPayload

    Write-Host "📥 Orchestration Response:" -ForegroundColor Cyan
    Write-Host "Success: $($response.success)" -ForegroundColor Green
    Write-Host "JobId: $($response.jobId)" -ForegroundColor Blue
    Write-Host "Message: $($response.message)" -ForegroundColor White

    if ($response.success) {
        Write-Host "✅ Sequential flow test initiated successfully!" -ForegroundColor Green
        Write-Host "🔍 Monitor app.log for sequential agent execution..." -ForegroundColor Yellow
        Write-Host "📊 Expected flow: Function Planner → State Designer → JSX Layout → Tailwind Styling → Component Assembler" -ForegroundColor Magenta
        
        # Wait a moment then check the log
        Start-Sleep -Seconds 3
        Write-Host "`n📋 Latest log entries:" -ForegroundColor Cyan
        Get-Content "app.log" | Select-Object -Last 10
    } else {
        Write-Host "❌ Sequential flow test failed: $($response.error)" -ForegroundColor Red
    }

} catch {
    Write-Host "❌ Test execution failed: $($_.Exception.Message)" -ForegroundColor Red
} 