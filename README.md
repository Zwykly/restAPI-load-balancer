# restAPI-load-balancer

Backend REST API (Bun) do testowania Load Balancera. Zamiast prawdziwych obliczeń
serwer czeka `x / PERFORMANCE` ms, więc na identycznych maszynach można symulować
serwery o różnej wydajności. Współpracuje z aplikacją testową Throughput-meter.

## Uruchomienie

```
bun install
PORT=9001 SERVER_ID=srv1 PERFORMANCE=1 bun run start
```

PowerShell: `$env:PORT=9001; $env:SERVER_ID="srv1"; $env:PERFORMANCE=1; bun run start`

| Zmienna       | Domyślnie     | Znaczenie                                                        |
|---------------|---------------|------------------------------------------------------------------|
| `PORT`        | `9001`        | port nasłuchiwania                                               |
| `SERVER_ID`   | `server-<port>` | identyfikator zwracany w odpowiedzi                            |
| `PERFORMANCE` | `1`           | współczynnik wydajności `w > 0`; `2` = 2x szybszy, `0.5` = 2x wolniejszy |

## Endpointy

- `POST /task` z treścią `{"x": 200}` (lub `GET /task?x=200`) – czeka `x / w` ms i zwraca:
  ```json
  {"server_id": "srv1", "task_ms": 200, "performance": 2, "actual_ms": 100.4}
  ```
  `actual_ms` to faktycznie odczekany czas (mierzony na serwerze). `x < 0` lub nie-liczba → `400`.
- `GET /health` – `{status, server_id, performance, active}` (`active` = liczba zapytań w toku).
- `GET /config` / `PUT /config` z `{"performance": 0.5}` – odczyt / zmiana współczynnika
  wydajności w trakcie działania (bez restartu). Zapytania już przyjęte dokańczają się
  ze starą wartością.

## Zgodność z Throughput-meter

Domyślne ustawienia narzędzia pasują bez zmian: `POST /task`, treść `{"x": {x}}`,
pola odpowiedzi `server_id` i `actual_ms`. Pole „wydajności serwerów” w narzędziu
(np. `1,1,2,0.5`) powinno odpowiadać wartościom `PERFORMANCE` poszczególnych backendów –
teoretyczny dolny limit liczy `suma(x) / suma(w)`, co jest zgodne z `czas = x / w`.
