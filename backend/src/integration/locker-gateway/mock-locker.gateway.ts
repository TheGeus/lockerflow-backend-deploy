import { Injectable } from '@nestjs/common';
import {
  GatewayCompartmentState,
  GatewayConfirmationResult,
  GatewayResult,
  LockerGateway,
} from './locker-gateway.interface';

@Injectable()
export class MockLockerGateway implements LockerGateway {
  async authorizeOpen(lockerId: bigint | number, compartmentId: bigint | number, reason: string): Promise<GatewayResult> {
    return {
      ok: true,
      mode: 'MOCK',
      externalReference: `mock-open-${lockerId}-${compartmentId}-${reason}`,
    };
  }

  async getCompartmentState(lockerId: bigint | number, compartmentId: bigint | number): Promise<GatewayCompartmentState> {
    return {
      mode: 'MOCK',
      lockerId,
      compartmentId,
      state: 'CLOSED',
    };
  }

  async confirmDeposit(): Promise<GatewayConfirmationResult> {
    return {
      ok: true,
      mode: 'MOCK',
      confirmed: true,
    };
  }

  async confirmRetrieval(): Promise<GatewayConfirmationResult> {
    return {
      ok: true,
      mode: 'MOCK',
      confirmed: true,
    };
  }
}
