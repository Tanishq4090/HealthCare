import axios from 'axios';
import { supabase } from '../supabase';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const attendanceApi = axios.create({
  baseURL: `${API_URL}/attendance`,
});

// Automatically inject JWT for IDOR enforcement
attendanceApi.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

export const markAttendance = async (data: {
  employeeId: string;
  date: string;
  status: string;
  note?: string;
  markedBy: string;
  hoursWorked?: number;
  checkInTime?: string | null;
  checkOutTime?: string | null;
}) => {
  const response = await attendanceApi.post('/mark', data);
  return response.data;
};

export const bulkMarkAttendance = async (data: {
  employeeIds: string[];
  date: string;
  status: string;
  markedBy: string;
  hoursWorked?: number;
}) => {
  const response = await attendanceApi.post('/bulk-mark', data);
  return response.data;
};

export const getAttendanceSummary = async (params: {
  employeeId: string;
  month?: string;
  year?: string;
}) => {
  const response = await attendanceApi.get('/summary', { params });
  return response.data;
};

export const getMonthlyReport = async (params: {
  month?: string;
  year?: string;
}) => {
  const response = await attendanceApi.get('/monthly-report', { params });
  return response.data;
};

export const deleteAttendance = async (params: {
  employeeId: string;
  date: string;
}) => {
  const response = await attendanceApi.delete('/mark', { params });
  return response.data;
};

export const bulkSaveAttendance = async (data: {
  date: string;
  records: Array<{ 
    workerId: string; 
    status: string; 
    hoursWorked: number;
    checkInTime?: string | null;
    checkOutTime?: string | null;
  }>;
  markedBy?: string;
}) => {
  const response = await attendanceApi.post('/bulk-save', data);
  return response.data;
};

export default {
  markAttendance,
  bulkMarkAttendance,
  getAttendanceSummary,
  getMonthlyReport,
  deleteAttendance,
  bulkSaveAttendance,
};
