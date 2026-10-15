// @ts-expect-error - AttendanceCheckIn is a JSX component
import AttendanceCheckIn from './App';

export function AttendancePunch(props: Record<string, unknown>) {
  return <AttendanceCheckIn initialTab="punch" {...props} />;
}

export default AttendancePunch;
