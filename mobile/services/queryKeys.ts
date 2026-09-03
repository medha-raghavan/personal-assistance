import { QueryClient } from '@tanstack/react-query';

export function invalidateDashboard(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['dashboard-overview'] });
  queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
}
