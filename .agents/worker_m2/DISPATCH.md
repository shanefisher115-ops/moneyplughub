## 2026-08-26T13:18:03Z
You are Worker M2 for Creator Money OS (Voice Engine, WebSocket & Audio Pipeline Hardening).

Tasks:
1. In src/backend/server.ts, mount the /ws/voice WebSocket server (ws.WebSocketServer).
2. Implement WebSocket frame signaling protocols for /ws/voice: session_init, audio_chunk, interrupt, ping/pong with heartbeat and reconnection support.
3. Support audio interruption: on interrupt frame, invalidate generation token and cancel active streaming synthesis.
4. In src/frontend/voice/VoiceEngineKernel.ts and FloatingMoneyOSWindow.tsx, ensure streaming fetch requests attach AbortController and abort on user barge-in / generation token change.
5. Harmonize /api/tts/speak and /api/voice/tts endpoints.
6. Verify all test suites.
7. Write handoff.md and notify parent.
