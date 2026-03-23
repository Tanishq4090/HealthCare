import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { markAttendance, bulkMarkAttendance, getAttendanceSummary, getMonthlyReport, deleteAttendance, bulkSaveAttendance } from '../lib/api/attendance';
import { toast } from 'sonner';

export const useAttendanceSummary = (employeeId: string, month?: string, year?: string) => {
  return useQuery({
    queryKey: ['attendance', 'summary', employeeId, month, year],
    queryFn: () => getAttendanceSummary({ employeeId, month, year }),
    enabled: !!employeeId,
  });
};

export const useMonthlyReport = (month?: string, year?: string) => {
  return useQuery({
    queryKey: ['attendance', 'monthlyReport', month, year],
    queryFn: () => getMonthlyReport({ month, year }),
  });
};

export const useMarkAttendance = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAttendance,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast.success(`Attendance marked as ${data.data.status}`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to mark attendance');
    },
  });
};

export const useBulkMarkAttendance = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: bulkMarkAttendance,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast.success(`Bulk marked ${data.count} employees`);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to bulk mark attendance');
    },
  });
};

export const useDeleteAttendance = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAttendance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast.success('Attendance cleared');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to clear attendance');
    },
  });
};

export const useBulkSaveAttendance = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: bulkSaveAttendance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      toast.success('All changes saved successfully');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to save attendance changes');
    },
  });
};
