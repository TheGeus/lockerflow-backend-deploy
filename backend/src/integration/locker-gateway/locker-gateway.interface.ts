export type GatewayMode = 'MOCK' | 'API' | 'SENSOR';

export interface GatewayResult {
  ok: boolean;
  mode: GatewayMode;
  externalReference?: string;
  errorMessage?: string;
}

export interface GatewayCompartmentState {
  mode: GatewayMode;
  lockerId: bigint | number;
  compartmentId: bigint | number;
  state: 'UNKNOWN' | 'OPEN' | 'CLOSED' | 'OCCUPIED' | 'EMPTY';
}

export interface GatewayConfirmationResult {
  ok: boolean;
  mode: GatewayMode;
  confirmed: boolean;
  errorMessage?: string;
}

export interface LockerGateway {
  authorizeOpen(lockerId: bigint | number, compartmentId: bigint | number, reason: string): Promise<GatewayResult>;
  getCompartmentState(lockerId: bigint | number, compartmentId: bigint | number): Promise<GatewayCompartmentState>;
  confirmDeposit(lockerId: bigint | number, compartmentId: bigint | number): Promise<GatewayConfirmationResult>;
  confirmRetrieval(lockerId: bigint | number, compartmentId: bigint | number): Promise<GatewayConfirmationResult>;
}
