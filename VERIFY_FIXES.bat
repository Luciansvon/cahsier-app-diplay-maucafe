@echo off
setlocal
node --check src\server.js || exit /b 1
node --check src\franchise.js || exit /b 1
node --check src\queue.js || exit /b 1
node --check src\media.js || exit /b 1
call npm test || exit /b 1
call npm run build || exit /b 1
echo.
echo Semua test dan build lulus.
