import { v4 as uuidv4 } from 'uuid';
import { cosmosDbClient } from '../api/cosmosdb';
import type { AuditLog, AuditAction, Golfer, PaginatedResponse } from '../types';
import type { GetAuditLogsParams } from '../api/interfaces';

interface PerformedBy {
  id: string;
  email: string;
  name: string;
}

export const auditService = {
  /**
   * Log an admin credit action.
   */
  async logAdminCredit(
    performedBy: PerformedBy,
    golfer: Golfer,
    amount: number,
    transactionId: string,
    newBalance: number
  ): Promise<AuditLog> {
    return this.log('ADMIN_CREDIT', performedBy, {
      type: 'golfer',
      id: golfer.id,
      name: `${golfer.firstName} ${golfer.lastName}`,
      email: golfer.email,
    }, {
      amount,
      transactionId,
      newBalance,
      golflinkNo: golfer.golflinkNo,
    });
  },

  /**
   * Log an admin debit action.
   */
  async logAdminDebit(
    performedBy: PerformedBy,
    golfer: Golfer,
    amount: number,
    transactionId: string,
    newBalance: number
  ): Promise<AuditLog> {
    return this.log('ADMIN_DEBIT', performedBy, {
      type: 'golfer',
      id: golfer.id,
      name: `${golfer.firstName} ${golfer.lastName}`,
      email: golfer.email,
    }, {
      amount,
      transactionId,
      newBalance,
      golflinkNo: golfer.golflinkNo,
    });
  },

  /**
   * Generic log function for any audit action.
   */
  async log(
    action: AuditAction,
    performedBy: PerformedBy,
    target: AuditLog['target'],
    details: Record<string, unknown>
  ): Promise<AuditLog> {
    const auditLog: AuditLog = {
      id: uuidv4(),
      type: 'auditLog',
      action,
      performedBy,
      target,
      details,
      timestamp: new Date().toISOString(),
    };

    return cosmosDbClient.auditLogs.add(auditLog);
  },

  /**
   * Get all audit logs with optional filtering and pagination.
   */
  async getAll(params?: GetAuditLogsParams): Promise<PaginatedResponse<AuditLog>> {
    return cosmosDbClient.auditLogs.getAll(params);
  },
};
