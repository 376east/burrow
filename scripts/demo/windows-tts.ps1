param(
    [Parameter(Mandatory = $true)][string]$RequestPath,
    [string]$OutputPath,
    [switch]$InfoOnly
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
Add-Type -AssemblyName System.Speech
$request = Get-Content -LiteralPath $RequestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$rate = [int]$request.rate
if ($rate -lt -10 -or $rate -gt 10) { throw 'Windows speech rate must be between -10 and 10' }
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    $installed = @($synth.GetInstalledVoices() | Where-Object Enabled | ForEach-Object { $_.VoiceInfo.Name })
    $requested = [string]$request.voice
    if ($installed -contains $requested) {
        $selected = $requested
    } elseif ($requested -eq 'Microsoft Pavel' -and $installed -contains 'Microsoft Irina Desktop') {
        $selected = 'Microsoft Irina Desktop'
    } else {
        throw "Requested Windows voice is unavailable: $requested"
    }
    $synth.SelectVoice($selected)
    $synth.Rate = $rate
    $synth.Volume = 100
    if (-not $InfoOnly) {
        if (-not $OutputPath -or [string]::IsNullOrWhiteSpace([string]$request.text)) { throw 'OutputPath and non-empty text are required' }
        $synth.SetOutputToWaveFile($OutputPath)
        $synth.Speak([string]$request.text)
        $synth.SetOutputToNull()
    }
    @{ engine = 'windows'; voice = $synth.Voice.Name; rate = $synth.Rate } | ConvertTo-Json -Compress
} finally {
    $synth.Dispose()
}
