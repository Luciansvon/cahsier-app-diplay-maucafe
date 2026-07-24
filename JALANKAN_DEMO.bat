@echo off
title Demo Sistem Antrean Maucafe
cls
echo ========================================================
echo       MEMULAI DEMO SISTEM ANTREAN KOPI MAUCAFE
echo ========================================================
echo.
echo Menyalakan aplikasi server lokal...
echo Silakan tunggu beberapa detik sampai server siap.
echo.
echo Jika sudah siap, buka alamat berikut di browser:
echo  - Layar Display TV  : http://localhost:3000/display
echo  - HP Kasir (Admin)  : http://localhost:3000/admin
echo  - HP Pemilik (Owner): http://localhost:3000/owner
echo.
echo Tekan Ctrl+C atau tutup jendela ini untuk menghentikan demo.
echo ========================================================
echo.

npm start
pause
