import type { AdminCustomerListRow } from "@/lib/admin/customers-types";

export type OperatorOverviewResponse = {
  stats: {
    totalBusinesses: number;
    activeBusinesses: number;
    businessesWithConversations: number;
  };
  recentSignups: AdminCustomerListRow[];
};
