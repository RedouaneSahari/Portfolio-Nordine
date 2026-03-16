param(
  [string]$Email = "redouane.sahari@gmail.com",
  [string]$FromName = "Portfolio Nordine"
)

$securePass = Read-Host "Mot de passe d'application Gmail (16 caracteres)" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePass)
try {
  $plainPass = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
}

if ([string]::IsNullOrWhiteSpace($plainPass)) {
  Write-Error "SMTP_PASS vide. Arret."
  exit 1
}

$env:CONTACT_TO = $Email
$env:CONTACT_FROM = "$FromName <$Email>"
$env:SMTP_HOST = "smtp.gmail.com"
$env:SMTP_PORT = "587"
$env:SMTP_USER = $Email
$env:SMTP_PASS = $plainPass
$env:SMTP_SECURE = "false"

docker compose up -d --build web
docker compose logs --tail=40 web

Remove-Item Env:SMTP_PASS -ErrorAction SilentlyContinue
Write-Output "SMTP_PASS nettoye de la session shell."
