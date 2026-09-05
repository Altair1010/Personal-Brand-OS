import type { WorkerRegistration } from "../contracts/control-plane";

export interface ExternalActor {
  readonly provider: string;
  readonly subject: string;
}

export type WorkerTenantScope =
  | { readonly type: "WORKSPACE"; readonly id: string }
  | { readonly type: "BRAND"; readonly id: string };

export interface RegisteredWorker {
  readonly id: string;
  readonly status: "ACTIVE" | "DISABLED" | "REVOKED";
  readonly capabilities: readonly string[];
  readonly lastSeenAt: Date;
}

export interface WorkerRegistryPort {
  register(registration: WorkerRegistration, seenAt?: Date): Promise<RegisteredWorker>;
  get(workerId: string): Promise<RegisteredWorker | null>;
  heartbeat(workerId: string): Promise<void>;
  updateCapabilities(workerId: string, capabilities: readonly string[]): Promise<void>;
  isAuthorized(workerId: string, scope: WorkerTenantScope): Promise<boolean>;
  grantWorkspace(actor: ExternalActor, workerId: string, workspaceId: string, correlationId: string): Promise<void>;
  revokeWorkspace(actor: ExternalActor, workerId: string, workspaceId: string, correlationId: string): Promise<void>;
  grantBrand(actor: ExternalActor, workerId: string, brandId: string, correlationId: string): Promise<void>;
  revokeBrand(actor: ExternalActor, workerId: string, brandId: string, correlationId: string): Promise<void>;
}
