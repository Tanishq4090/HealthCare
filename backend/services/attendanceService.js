import { supabase } from "./supabase.js";

/**
 * Attendance Service Layer
 * Encapsulates all database interactions for attendance records.
 */

export const getRecordByDate = async (workerId, date) => {
  const { data, error } = await supabase
    .from('attendance')
    .select('id')
    .eq('worker_id', workerId)
    .eq('duty_date', date)
    .maybeSingle();
  if (error) throw error;
  return data;
};

export const upsertAttendance = async (payload, existingId = null) => {
  if (existingId) {
    const { data, error } = await supabase
      .from('attendance')
      .update(payload)
      .eq('id', existingId)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('attendance')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
};

export const deleteAttendance = async (workerId, date) => {
  const { error } = await supabase
    .from('attendance')
    .delete()
    .eq('worker_id', workerId)
    .eq('duty_date', date);
  if (error) throw error;
};

export const getAttendanceForWorker = async (workerId) => {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('worker_id', workerId);
  if (error) throw error;
  return data;
};

export const getAllAttendance = async () => {
  const { data, error } = await supabase.from('attendance').select('*');
  if (error) throw error;
  return data;
};
