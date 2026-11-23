// Backend REST API do testowania Load Balancera.
// Zamiast prawdziwych obliczeń serwer czeka x / PERFORMANCE milisekund.
//
// Konfiguracja (zmienne środowiskowe):
//   PORT         port nasłuchiwania            (domyślnie 9001)
//   SERVER_ID    identyfikator zwracany w JSON (domyślnie "server-<port>")
//   PERFORMANCE  współczynnik wydajności w > 0 (domyślnie 1)
//                w = 2 -> serwer 2x szybszy (czeka x/2), w = 0.5 -> 2x wolniejszy (czeka x/0.5)

const PORT = Number(process.env.PORT ?? 9001);
const SERVER_ID = process.env.SERVER_ID ?? `server-${PORT}`;

function parsePerformance(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : null;
}

// Jedyna zmienna konfiguracyjna: współczynnik wydajności symulowanego serwera.
let performance_ = parsePerformance(process.env.PERFORMANCE ?? 1);
if (performance_ === null) {
  console.error("PERFORMANCE musi być liczbą > 0");
  process.exit(1);
}

let active = 0; // liczba zapytań aktualnie "przetwarzanych" (czekających)

const json = (body: unknown, status = 200) => Response.json(body, { status });

async function runTask(x: unknown): Promise<Response> {
  const taskMs = typeof x === "string" && x.trim() !== "" ? Number(x) : x;
  if (typeof taskMs !== "number" || !Number.isFinite(taskMs) || taskMs < 0) {
    return json({ error: "x musi być liczbą >= 0 (czas zadania w ms)" }, 400);
  }

  const w = performance_!; // wartość w chwili przyjęcia zapytania
  const waitMs = taskMs / w;

  active++;
  const start = performance.now();
  try {
    if (waitMs > 0) await Bun.sleep(waitMs);
  } finally {
    active--;
  }
  const actualMs = performance.now() - start;

  return json({
    server_id: SERVER_ID,
    task_ms: taskMs,
    performance: w,
    actual_ms: Number(actualMs.toFixed(3)),
  });
}

const server = Bun.serve({
  port: PORT,
  idleTimeout: 120, // sekundy; domyślne 10 s zrywałoby połączenia przy długich zadaniach

  routes: {
    "/task": {
      // POST /task  z treścią {"x": 100}
      POST: async (req) => {
        let body: any;
        try {
          body = await req.json();
        } catch {
          return json({ error: 'treść musi być JSON-em, np. {"x": 100}' }, 400);
        }
        return runTask(body?.x);
      },
      // GET /task?x=100  (wygodne do ręcznych testów)
      GET: (req) => runTask(new URL(req.url).searchParams.get("x")),
    },

    "/health": () =>
      json({ status: "ok", server_id: SERVER_ID, performance: performance_, active }),

    // Odczyt / zmiana współczynnika wydajności w trakcie działania.
    "/config": {
      GET: () => json({ server_id: SERVER_ID, performance: performance_ }),
      PUT: async (req) => {
        let body: any;
        try {
          body = await req.json();
        } catch {
          return json({ error: 'treść musi być JSON-em, np. {"performance": 2}' }, 400);
        }
        const w = parsePerformance(body?.performance);
        if (w === null) return json({ error: "performance musi być liczbą > 0" }, 400);
        performance_ = w;
        return json({ server_id: SERVER_ID, performance: performance_ });
      },
    },
  },

  fetch: () => json({ error: "not found" }, 404),
});

console.log(`[${SERVER_ID}] nasłuchuje na ${server.url} (performance=${performance_})`);
