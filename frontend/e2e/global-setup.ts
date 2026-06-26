const BASE_URL = 'http://localhost:3000';

// Routes hit by landing.spec.ts. Next dev compiles a route on first request,
// so without this, several parallel workers all `page.goto('/')` at once
// against a cold server and race a single webpack compile - assertions then
// time out (default 5s) against a still-blank page. Warming routes here,
// serially, before workers start avoids that thundering herd.
const ROUTES_TO_WARM = [
  '/',
  '/forum/421614/0xaa3146fBa89b6e93303c397f76B2cC36545372D0',
  '/overview/421614/0xaa3146fBa89b6e93303c397f76B2cC36545372D0/organisation',
];

async function warmRoute(path: string, retries = 5): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await fetch(`${BASE_URL}${path}`);
      return;
    } catch {
      if (attempt === retries) return;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

export default async function globalSetup() {
  for (const path of ROUTES_TO_WARM) {
    await warmRoute(path);
  }
}
