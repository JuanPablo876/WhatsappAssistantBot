@echo off
title Cloudflare Tunnel - AssistantBot (port 3005)
echo ============================================
echo  Cloudflare Tunnel - WhatsApp Assistant Bot
echo  assistant.iatransmisor.com -> localhost:3005
echo ============================================
echo.
echo Starting tunnel...
echo Press Ctrl+C to stop.
echo.
cloudflared tunnel run --config "%USERPROFILE%\.cloudflared\config.yml" eceee8d2-2f4c-4ecf-99d1-0e745e4f40d8
pause
