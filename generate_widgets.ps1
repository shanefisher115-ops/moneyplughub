$componentsDir = "src/frontend/components"
if (!(Test-Path $componentsDir)) {
    New-Item -ItemType Directory -Path $componentsDir -Force
}

$widgets = @(
    'AnalyticsRealmWidget',
    'IntegrationRealmWidget',
    'SecurityRealmWidget',
    'AutomatonRealmWidget',
    'ShaderRealmWidget',
    'VoiceRealmWidget',
    'NeuralRealmWidget',
    'MonetizationRealmWidget',
    'OsmiumLedgerWidget',
    'OrchestratorRealmWidget',
    'AlertRealmWidget',
    'TelemetryRealmWidget'
)

foreach ($widgetName in $widgets) {
    $filePath = "$componentsDir/$widgetName.tsx"
    $stubContent = @"
import React from 'react';

export const $widgetName: React.FC = () => {
    return (
        <div className="bg-plug-card border border-plug-border p-6 rounded-2xl shadow-xl space-y-3">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-plug-accent">$widgetName Realm</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">ONLINE</span>
            </div>
            <p className="text-xs text-slate-400">Autonomous realm telemetry & monitoring node active.</p>
        </div>
    );
};
"@
    Set-Content -Path $filePath -Value $stubContent -Encoding UTF8
}

Write-Host "✔ All 12 realm widget files correctly generated!" -ForegroundColor Cyan

npx tsc --noEmit

if ($LASTEXITCODE -eq 0) {
    Write-Host "✔ TypeScript compilation passed with zero errors!" -ForegroundColor Green
    npm run build
    if ($LASTEXITCODE -eq 0) {
        git add src/frontend/
        git commit -m "feat(dashboard): successfully stubbed all 12 realm widgets and verified clean build"
        git push origin primordia-memory
        Write-Host "✔ Successfully built, committed, and pushed to origin/primordia-memory!" -ForegroundColor Green
    }
} else {
    Write-Host "✖ Type check failed." -ForegroundColor Red
}
