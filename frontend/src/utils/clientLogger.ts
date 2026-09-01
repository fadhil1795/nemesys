import { BACKEND_URL } from '../App';

export const logClient = async (level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG', message: string, url?: string) => {
  try {
    await fetch(`${BACKEND_URL}/api/client-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level,
        message,
        url: url || window.location.href,
      }),
    });
  } catch (e) {
    console.error('Failed to log client error to backend', e);
  }
};

export const initGlobalErrorLogging = () => {
  window.addEventListener('error', (event) => {
    logClient('ERROR', `Uncaught Error: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`, event.filename);
  });

  window.addEventListener('unhandledrejection', (event) => {
    logClient('ERROR', `Unhandled Promise Rejection: ${event.reason}`, window.location.href);
  });
};
