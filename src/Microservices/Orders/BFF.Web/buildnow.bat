@echo off
cd /d "%~dp0"
set NODE_EXTRA_CA_CERTS=%~dp0certs\extra-ca-bundle.pem
echo NODE_EXTRA_CA_CERTS set to: %NODE_EXTRA_CA_CERTS%

pnpm run start:dev