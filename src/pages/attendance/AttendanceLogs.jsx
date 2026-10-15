import React from 'react';
import AttendanceCheckIn from './App';

export function AttendanceLogs(props) {
  return <AttendanceCheckIn initialTab="history" {...props} />;
}

export default AttendanceLogs;
