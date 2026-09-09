@echo off
cd /d "%~dp0"
set NODE_EXTRA_CA_CERTS=C:\Dinesh\Career\GitHub\EnterpriseWebPlatform_V2\src\Microservices\Orders\BFF.Web\certs\extra-ca-bundle.pem
echo NODE_EXTRA_CA_CERTS set to: %NODE_EXTRA_CA_CERTS%

pnpm run start:dev