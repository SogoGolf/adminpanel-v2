import { getAuditLogs, createAuditLog } from '../api/mongodb';
import type { AuditLog, AuditAction, Golfer, PaginatedResponse } from '../types';

interface PerformedBy {
  id: string;
  email: string;
  name: string;
}

interface GetAuditLogsParams {
  page?: number;
  pageSize?: number;
  action?: AuditAction;
  fromDate?: string;
  toDate?: string;
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
    const result = await createAuditLog({
      action,
      performedBy: {
        id: performedBy.id,
        email: performedBy.email,
        name: performedBy.name,
      },
      target: target ? {
        type: target.type,
        id: target.id,
        name: target.name,
        email: target.email,
      } : undefined,
      details,
    });

    // Map the MongoDB response to match the expected AuditLog type
    return {
      id: result.id,
      type: 'auditLog',
      action: result.action as AuditAction,
      performedBy: result.performedBy,
      target: result.target,
      details: result.details,
      timestamp: result.timestamp,
    };
  },

  /**
   * Get all audit logs with optional filtering and pagination.
   */
  async getAll(params?: GetAuditLogsParams): Promise<PaginatedResponse<AuditLog>> {
    return getAuditLogs({
      page: params?.page,
      pageSize: params?.pageSize,
      action: params?.action,
      fromDate: params?.fromDate,
      toDate: params?.toDate,
    });
  },
};
