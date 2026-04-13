param(
    [string]$BackendUrl = "https://backend-blond-seven-35.vercel.app",
    [string]$FrontendUrl = "https://frontend-six-weld-37.vercel.app",
    [string]$OpenClawApiKey = "",
    [string]$SupabaseAccessToken = "",
    [int]$TelegramId = 841875314
)

$ErrorActionPreference = "Stop"

function Invoke-Status {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Method = "GET",
        [hashtable]$Headers = @{},
        [string]$Body = "",
        [int]$ExpectedStatus
    )

    try {
        if ($Body -ne "") {
            $resp = Invoke-WebRequest -UseBasicParsing -Uri $Url -Method $Method -Headers $Headers -Body $Body -ContentType "application/json" -TimeoutSec 20
        } else {
            $resp = Invoke-WebRequest -UseBasicParsing -Uri $Url -Method $Method -Headers $Headers -TimeoutSec 20
        }
        $actual = [int]$resp.StatusCode
    } catch {
        if ($_.Exception.Response) {
            $actual = [int]$_.Exception.Response.StatusCode
        } else {
            throw $_
        }
    }

    if ($actual -eq $ExpectedStatus) {
        Write-Output ("[PASS] {0}: expected {1}, got {2}" -f $Name, $ExpectedStatus, $actual)
    } else {
        Write-Output ("[FAIL] {0}: expected {1}, got {2}" -f $Name, $ExpectedStatus, $actual)
    }
}

Write-Output "== Core public checks =="
Invoke-Status -Name "Backend health" -Url "$BackendUrl/health" -ExpectedStatus 200
Invoke-Status -Name "Frontend login" -Url "$FrontendUrl/login" -ExpectedStatus 200
Invoke-Status -Name "Frontend proxy health" -Url "$FrontendUrl/api/backend/health" -ExpectedStatus 200

Write-Output "== Auth guard checks =="
Invoke-Status -Name "Cron guard" -Url "$BackendUrl/cron/morning-briefing" -Method "POST" -ExpectedStatus 401
Invoke-Status -Name "Message guard" -Url "$BackendUrl/api/message" -Method "POST" -Body '{"telegram_id":841875314,"text":"/stats"}' -ExpectedStatus 401
Invoke-Status -Name "Profile link guard" -Url "$BackendUrl/api/profile/link-telegram" -Method "POST" -Body '{"telegram_id":841875314}' -ExpectedStatus 401

if ($OpenClawApiKey -ne "") {
    Write-Output "== Optional authenticated checks (OpenClaw) =="
    $headers = @{ "X-API-Key" = $OpenClawApiKey }
    Invoke-Status -Name "Message with X-API-Key" -Url "$BackendUrl/api/message" -Method "POST" -Headers $headers -Body "{\"telegram_id\":$TelegramId,\"text\":\"/stats\"}" -ExpectedStatus 200
}

if ($SupabaseAccessToken -ne "") {
    Write-Output "== Optional authenticated checks (Supabase user) =="
    $headers = @{ "Authorization" = "Bearer $SupabaseAccessToken" }
    # Can return 200 when linked/updated, or 409 when telegram id belongs to another profile.
    try {
        $resp = Invoke-WebRequest -UseBasicParsing -Uri "$BackendUrl/api/profile/link-telegram" -Method "POST" -Headers $headers -Body "{\"telegram_id\":$TelegramId}" -ContentType "application/json" -TimeoutSec 20
        $code = [int]$resp.StatusCode
    } catch {
        if ($_.Exception.Response) {
            $code = [int]$_.Exception.Response.StatusCode
        } else {
            throw $_
        }
    }

    if ($code -in @(200, 409)) {
        Write-Output ("[PASS] Profile link with Bearer: expected 200/409, got {0}" -f $code)
    } else {
        Write-Output ("[FAIL] Profile link with Bearer: expected 200/409, got {0}" -f $code)
    }
}
