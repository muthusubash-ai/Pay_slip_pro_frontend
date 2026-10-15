import React from 'react';
import AttendanceCheckIn from './App';

export function AttendancePunch(props) {
  return <AttendanceCheckIn initialTab="punch" {...props} />;
}

export default AttendancePunch;
