@echo off
echo ==============================================
echo Fixing Windows Firewall for Rescue Mobile App
echo ==============================================
echo.
echo Requesting Administrative Privileges...
net session >nul 2>&1
if %errorLevel% == 0 (
    echo Success: Administrative privileges confirmed.
) else (
    echo Failure: Current permissions inadequate.
    echo Please Right-Click this file and select "Run as administrator".
    pause
    exit /b 1
)

echo.
echo Adding Firewall Rule to allow incoming connections on Port 3001...
netsh advfirewall firewall add rule name="Rescue System Port 3001" dir=in action=allow protocol=TCP localport=3001 >nul 2>&1

echo Adding Firewall Rule to allow Node.js...
netsh advfirewall firewall add rule name="Rescue System Node" dir=in action=allow program="C:\Program Files\nodejs\node.exe" enable=yes >nul 2>&1

echo.
echo ==============================================
echo FIX APPLIED SUCCESSFULLY! 
echo Your mobile device can now connect to the laptop.
echo ==============================================
pause
