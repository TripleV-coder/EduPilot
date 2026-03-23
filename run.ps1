# EduPilot - Script de Lancement Windows (PowerShell)
# Lance toute l'application (Next.js + Socket.IO) en une seule commande

# Couleurs
$Host.UI.RawUI.ForegroundColor = "White"

function Show-Logo {
    Write-Host "╔════════════════════════════════════════════════════════════╗" -ForegroundColor Magenta
    Write-Host "║                                                            ║" -ForegroundColor Magenta
    Write-Host "║   ███████╗██████╗ ██╗   ██╗██████╗ ██╗██╗      ██████╗████████╗" -ForegroundColor Magenta
    Write-Host "║   ██╔════╝██╔══██╗██║   ██║██╔══██╗██║██║     ██╔═══██╗╚══██╔══╝" -ForegroundColor Magenta
    Write-Host "║   █████╗  ██║  ██║██║   ██║██████╔╝██║██║     ██║   ██║   ██║" -ForegroundColor Magenta
    Write-Host "║   ██╔══╝  ██║  ██║██║   ██║██╔═══╝ ██║██║     ██║   ██║   ██║" -ForegroundColor Magenta
    Write-Host "║   ███████╗██████╔╝╚██████╔╝██║     ██║███████╗╚██████╔╝   ██║" -ForegroundColor Magenta
    Write-Host "║   ╚══════╝╚═════╝  ╚═════╝ ╚═╝     ╚═╝╚══════╝ ╚═════╝    ╚═╝" -ForegroundColor Magenta
    Write-Host "║                                                            ║" -ForegroundColor Magenta
    Write-Host "║              L'avenir de l'éducation numérique            ║" -ForegroundColor Magenta
    Write-Host "║                                                            ║" -ForegroundColor Magenta
    Write-Host "╚════════════════════════════════════════════════════════════╝" -ForegroundColor Magenta
    Write-Host ""
}

function Check-Node {
    Write-Host "🔍 Vérification de Node.js..." -ForegroundColor Cyan

    if (Get-Command node -ErrorAction SilentlyContinue) {
        $nodeVersion = node -v
        Write-Host "✅ Node.js détecté: $nodeVersion" -ForegroundColor Green
        return $true
    } else {
        Write-Host "❌ Node.js n'est pas installé!" -ForegroundColor Red
        Write-Host "📥 Installez Node.js depuis https://nodejs.org" -ForegroundColor Yellow
        return $false
    }
}

function Check-Npm {
    if (Get-Command npm -ErrorAction SilentlyContinue) {
        $npmVersion = npm -v
        Write-Host "✅ npm détecté: v$npmVersion" -ForegroundColor Green
        return $true
    } else {
        Write-Host "❌ npm n'est pas installé!" -ForegroundColor Red
        return $false
    }
}

function Check-Env {
    if (Test-Path .env) {
        Write-Host "✅ Fichier .env trouvé" -ForegroundColor Green
        return $true
    } else {
        Write-Host "⚠️  Fichier .env non trouvé" -ForegroundColor Yellow
        if (Test-Path .env.example) {
            Write-Host "📝 Copie de .env.example vers .env..." -ForegroundColor Blue
            Copy-Item .env.example .env
            Write-Host "✅ Fichier .env créé" -ForegroundColor Green
            Write-Host "⚠️  Veuillez configurer vos variables d'environnement dans .env" -ForegroundColor Yellow
            return $true
        } else {
            Write-Host "❌ .env.example non trouvé!" -ForegroundColor Red
            return $false
        }
    }
}

function Install-Dependencies {
    if (Test-Path node_modules) {
        Write-Host "✅ Dépendances déjà installées" -ForegroundColor Green
    } else {
        Write-Host "📦 Installation des dépendances..." -ForegroundColor Blue
        npm install
        Write-Host "✅ Dépendances installées" -ForegroundColor Green
    }
}

function Setup-Prisma {
    Write-Host "🔧 Configuration de Prisma..." -ForegroundColor Blue
    npx prisma generate
    Write-Host "✅ Prisma configuré" -ForegroundColor Green
}

function Show-Menu {
    Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  Choisissez un mode de démarrage:" -ForegroundColor Magenta
    Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
    Write-Host "  1) Développement (dev)" -ForegroundColor Green
    Write-Host "  2) Production (prod)" -ForegroundColor Blue
    Write-Host "  3) Production avec PM2 (pm2)" -ForegroundColor Magenta
    Write-Host "  4) Setup complet (installation)" -ForegroundColor Yellow
    Write-Host "  5) Quitter" -ForegroundColor Red
    Write-Host "════════════════════════════════════════" -ForegroundColor Cyan
    $choice = Read-Host "Votre choix"
    return $choice
}

function Start-Application {
    param (
        [string]$Mode
    )

    switch ($Mode) {
        "dev" {
            Write-Host "🚀 Démarrage en mode développement..." -ForegroundColor Cyan
            Write-Host "📡 Next.js + Socket.IO sur http://localhost:3000" -ForegroundColor Blue
            npm run dev
        }
        "prod" {
            Write-Host "🚀 Démarrage en mode production..." -ForegroundColor Cyan

            if (-not (Test-Path .next)) {
                Write-Host "🔨 Build de l'application..." -ForegroundColor Blue
                npm run build
            }

            npm run start
        }
        "pm2" {
            Write-Host "🚀 Démarrage avec PM2..." -ForegroundColor Cyan

            if (-not (Get-Command pm2 -ErrorAction SilentlyContinue)) {
                Write-Host "📦 Installation de PM2..." -ForegroundColor Yellow
                npm install -g pm2
            }

            if (-not (Test-Path .next)) {
                Write-Host "🔨 Build de l'application..." -ForegroundColor Blue
                npm run build
            }

            npm run start:pm2
            Write-Host "✅ Application démarrée avec PM2" -ForegroundColor Green
            Write-Host "📊 Utilisez 'npm run monitor:pm2' pour surveiller" -ForegroundColor Cyan
            Write-Host "📋 Utilisez 'npm run logs:pm2' pour voir les logs" -ForegroundColor Cyan
        }
        "setup" {
            Install-Dependencies
            Setup-Prisma
            Write-Host "🌱 Migration de la base de données..." -ForegroundColor Blue
            npm run db:push
            Write-Host "🌱 Seed des données de référence..." -ForegroundColor Blue
            npm run db:seed:reference
            Write-Host "✅ Setup complet terminé!" -ForegroundColor Green
            Write-Host "💡 Relancez ce script pour démarrer l'application" -ForegroundColor Cyan
        }
        default {
            Write-Host "❌ Mode invalide: $Mode" -ForegroundColor Red
            Write-Host "Modes disponibles: dev, prod, pm2, setup" -ForegroundColor Yellow
            exit 1
        }
    }
}

# Programme principal
Show-Logo

Write-Host "🔍 Vérification de l'environnement...`n" -ForegroundColor Cyan

$nodeOk = Check-Node
$npmOk = Check-Npm
$envOk = Check-Env

if (-not $nodeOk -or -not $npmOk -or -not $envOk) {
    Write-Host "`n❌ Environnement incomplet. Veuillez corriger les erreurs ci-dessus." -ForegroundColor Red
    exit 1
}

Write-Host ""

# Si argument fourni, utiliser directement
if ($args.Count -gt 0) {
    $mode = $args[0]

    if ($mode -in @("dev", "development", "prod", "production", "pm2", "setup")) {
        if ($mode -eq "development") { $mode = "dev" }
        if ($mode -eq "production") { $mode = "prod" }

        if ($mode -ne "setup") {
            Install-Dependencies
            Setup-Prisma
        }

        Start-Application -Mode $mode
    } else {
        Write-Host "❌ Argument invalide: $mode" -ForegroundColor Red
        Write-Host "Usage: .\run.ps1 [dev|prod|pm2|setup]" -ForegroundColor Yellow
        exit 1
    }
} else {
    # Menu interactif
    $choice = Show-Menu

    switch ($choice) {
        "1" {
            Install-Dependencies
            Setup-Prisma
            Start-Application -Mode "dev"
        }
        "2" {
            Install-Dependencies
            Setup-Prisma
            Start-Application -Mode "prod"
        }
        "3" {
            Install-Dependencies
            Setup-Prisma
            Start-Application -Mode "pm2"
        }
        "4" {
            Start-Application -Mode "setup"
        }
        "5" {
            Write-Host "👋 Au revoir!" -ForegroundColor Yellow
            exit 0
        }
        default {
            Write-Host "❌ Choix invalide!" -ForegroundColor Red
            exit 1
        }
    }
}
