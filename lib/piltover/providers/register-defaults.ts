import { registerProviderConnectionAdapter } from "./connection-service";
import { metaProviderAdapter } from "./adapters/meta";
import { linkedinProviderAdapter } from "./adapters/linkedin";
import { googleSearchConsoleAdapter } from "./adapters/google-search-console";

let registered = false;
export function ensureDefaultProviderAdapters() {
  if (registered) return;
  registerProviderConnectionAdapter(metaProviderAdapter);
  registerProviderConnectionAdapter(linkedinProviderAdapter);
  registerProviderConnectionAdapter(googleSearchConsoleAdapter);
  registered = true;
}
