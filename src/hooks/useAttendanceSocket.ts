import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';

export const useAttendanceSocket = () => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase.channel('crm_updates');

    channel
      .on('broadcast', { event: 'crm_event' }, (payload) => {
        try {
          const { event, data } = payload.payload;
          if (event === 'attendance:marked' || event === 'attendance:bulk_marked') {
            queryClient.invalidateQueries({ queryKey: ['attendance'] });
            
            if (event === 'attendance:marked') {
              toast.info(`Attendance update received for employee ${data.employeeId}`);
            } else {
              toast.info('Bulk attendance update received');
            }
          }
        } catch (err) {
          console.error('[Realtime] Error parsing message:', err);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] Connected to attendance updates');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
};
