@echo off

:: Change to the directory where this script resides
cd /d "%~dp0"

:: Print information
echo Starting Timetable System (client + server)...

:: Use npm to launch both the client and the server in development mode
:: The project defines a `dev` script that runs `concurrently` for the two workspaces
npm run dev

:: If you prefer to start the production build (after `npm run build`), use:
:: npm start
