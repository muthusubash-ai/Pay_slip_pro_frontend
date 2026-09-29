import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';

interface ServerTimeState {
  currentTime: Date;
  greeting: string;
  formattedDate: string;
  formattedTime: string;
  timeZone: string;
}

export function useServerTime(): ServerTimeState {
  // Monotonic synchronization state
  const timeOffsetRef = useRef<number>(0);
  const isSynchronizedRef = useRef<boolean>(false);

  const getRealDate = useCallback((): Date => {
    // Current timestamp calculated using server offset
    return new Date(Date.now() + timeOffsetRef.current);
  }, []);

  const [currentDate, setCurrentDate] = useState<Date>(() => getRealDate());

  // Detect user's local timezone (e.g. 'Asia/Kolkata', 'America/New_York', 'Asia/Dubai', 'Europe/London')
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  // Synchronize with server time
  const syncWithServer = useCallback(async () => {
    try {
      const sendTime = Date.now();
      const response = await api.get<{ timestamp_ms: number; server_time_utc: string }>('/system/time');
      const receiveTime = Date.now();
      const roundTripLatency = Math.floor((receiveTime - sendTime) / 2);
      const serverTimestamp = response.data.timestamp_ms + roundTripLatency;
      
      // Calculate difference between true server time and local device clock
      timeOffsetRef.current = serverTimestamp - receiveTime;
      isSynchronizedRef.current = true;
      setCurrentDate(new Date(Date.now() + timeOffsetRef.current));
    } catch {
      // Fallback to local clock if offline or request fails
      if (!isSynchronizedRef.current) {
        timeOffsetRef.current = 0;
      }
    }
  }, []);

  useEffect(() => {
    // Initial sync
    syncWithServer();

    // Re-sync every 5 minutes to prevent clock drift
    const syncInterval = setInterval(syncWithServer, 5 * 60 * 1000);

    // Update ticking clock every second
    const tickInterval = setInterval(() => {
      setCurrentDate(new Date(Date.now() + timeOffsetRef.current));
    }, 1000);

    return () => {
      clearInterval(syncInterval);
      clearInterval(tickInterval);
    };
  }, [syncWithServer]);

  // Compute hour in the user's detected timezone for accurate greeting
  const localHourStr = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone,
  }).format(currentDate);
  const localHour = parseInt(localHourStr, 10) % 24;

  let greeting = 'Good evening';
  if (localHour >= 5 && localHour < 12) {
    greeting = 'Good morning';
  } else if (localHour >= 12 && localHour < 17) {
    greeting = 'Good afternoon';
  } else if (localHour >= 17 && localHour < 21) {
    greeting = 'Good evening';
  } else {
    greeting = 'Good night';
  }

  // Format date and time in the detected timezone
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone,
  }).format(currentDate);

  const formattedTime = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone,
  }).format(currentDate);

  return {
    currentTime: currentDate,
    greeting,
    formattedDate,
    formattedTime,
    timeZone,
  };
}
