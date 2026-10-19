/**
 * Zoom Deep Linking (URI Scheme) & URL Parser Utility
 * Converts standard web Zoom URLs into direct OS/Mobile native app launch protocols (zoomus://)
 */

export interface ParsedZoomMeeting {
  isValid: boolean;
  meetingId: string;
  passcode?: string;
  vanityDomain?: string;
  rawUrl: string;
  deepLink: string;
  browserFallbackUrl: string;
}

/**
 * Extracts meeting ID and passcode from standard Zoom URLs
 * Supports:
 * - https://us02web.zoom.us/j/1234567890?pwd=xxxx
 * - https://zoom.us/j/1234567890
 * - https://myorg.zoom.us/my/vanityname
 * - Raw meeting ID with separate passcode
 */
export function parseZoomUrl(inputUrl: string, studentName?: string): ParsedZoomMeeting {
  const cleanInput = inputUrl.trim();

  // Default invalid result
  const invalidResult: ParsedZoomMeeting = {
    isValid: false,
    meetingId: '',
    rawUrl: cleanInput,
    deepLink: '',
    browserFallbackUrl: cleanInput,
  };

  if (!cleanInput) return invalidResult;

  try {
    let meetingId = '';
    let passcode: string | undefined = undefined;
    let domain = 'zoom.us';

    if (cleanInput.startsWith('http://') || cleanInput.startsWith('https://')) {
      const urlObj = new URL(cleanInput);
      domain = urlObj.hostname;

      // Extract Meeting ID from path: /j/1234567890 or /w/1234567890
      const pathMatch = urlObj.pathname.match(/\/(?:j|w|my)\/(\d+)/i);
      if (pathMatch && pathMatch[1]) {
        meetingId = pathMatch[1];
      }

      // Extract passcode from query parameter 'pwd'
      const pwdParam = urlObj.searchParams.get('pwd');
      if (pwdParam) {
        passcode = pwdParam;
      }
    } else {
      // Direct meeting ID entered (e.g. 812 3456 7890)
      const digitsOnly = cleanInput.replace(/\D/g, '');
      if (digitsOnly.length >= 9 && digitsOnly.length <= 11) {
        meetingId = digitsOnly;
      }
    }

    if (!meetingId) {
      return invalidResult;
    }

    // Build the Zoom Native URI Scheme (zoomus:// protocol)
    // Format: zoomus://zoom.us/join?confno={meetingId}&pwd={passcode}&uname={studentName}
    const params = new URLSearchParams();
    params.set('confno', meetingId);
    if (passcode) {
      params.set('pwd', passcode);
    }
    if (studentName) {
      // Pre-fills student name into Zoom app attendance
      params.set('uname', studentName);
    }

    const deepLink = `zoomus://zoom.us/join?${params.toString()}`;

    // Standard Zoom Web Client URL as fallback
    const browserFallbackUrl = `https://zoom.us/wc/${meetingId}/join${
      passcode ? `?pwd=${encodeURIComponent(passcode)}` : ''
    }`;

    return {
      isValid: true,
      meetingId,
      passcode,
      vanityDomain: domain,
      rawUrl: cleanInput,
      deepLink,
      browserFallbackUrl,
    };
  } catch (err) {
    console.warn('Failed to parse Zoom URL:', err);
    return invalidResult;
  }
}

/**
 * Handles cross-platform launching of Zoom Native App with automatic browser fallback
 */
export function openZoomMeeting(
  parsedMeeting: ParsedZoomMeeting,
  onLaunchAttempt?: (status: 'launching' | 'fallback') => void
): void {
  if (!parsedMeeting.isValid) {
    window.open(parsedMeeting.rawUrl, '_blank', 'noopener,noreferrer');
    return;
  }

  if (onLaunchAttempt) onLaunchAttempt('launching');

  // 1. Direct browser invocation of the OS URI Scheme (zoomus://)
  // This triggers OS window to open native Zoom desktop (Windows/Mac) or mobile app (iOS/Android)
  const startTime = Date.now();
  window.location.href = parsedMeeting.deepLink;

  // 2. Set timeout fallback: if user doesn't have Zoom installed or browser ignores protocol,
  // notify or allow 1-click fallback to browser web client
  setTimeout(() => {
    // If the browser hasn't lost focus after 2200ms, Zoom app may not be installed
    if (Date.now() - startTime < 3000) {
      if (onLaunchAttempt) onLaunchAttempt('fallback');
    }
  }, 2200);
}
