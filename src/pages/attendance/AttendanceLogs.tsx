// @ts-expect-error - AttendanceCheckIn is a JSX component
import AttendanceCheckIn from './App';

export function AttendanceLogs(props: Record<string, unknown>) {
  return <AttendanceCheckIn initialTab="history" {...props} />;
}

export default AttendanceLogs;
