import { useState, useEffect } from 'react';

interface DeviceDetection {
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isTouchDevice: boolean;
}

// Optimized device detection (inspired by ismobilejs but more modern)
const detectDevice = (): DeviceDetection => {
  if (typeof window === 'undefined') {
    return { isMobile: false, isTablet: false, isDesktop: true, isTouchDevice: false };
  }

  const ua = navigator.userAgent;
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // Mobile detection (phones)
  const mobileRegex = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i;
  const isMobile = mobileRegex.test(ua);

  // Tablet detection
  const tabletRegex = /iPad|Android(?!.*Mobile)|Tablet|PlayBook|Kindle|Silk/i;
  const isIPadPro = /Macintosh/i.test(ua) && isTouchDevice; // iOS 13+ iPad Pro detection
  const isTablet = tabletRegex.test(ua) || isIPadPro;

  const isDesktop = !isMobile && !isTablet;

  return {
    isMobile: isMobile && !isTablet, // Exclude tablets from mobile
    isTablet,
    isDesktop,
    isTouchDevice,
  };
};

export const useIsMobile = (): DeviceDetection => {
  const [device, setDevice] = useState<DeviceDetection>(detectDevice);

  useEffect(() => {
    // Update on mount (handles SSR)
    setDevice(detectDevice());

    // Only listen to orientation change for mobile devices
    // No need to listen to resize (unlike viewport-based detection)
    const handleOrientationChange = () => {
      setTimeout(() => setDevice(detectDevice()), 100);
    };

    if (device.isMobile || device.isTablet) {
      window.addEventListener('orientationchange', handleOrientationChange);
      return () => window.removeEventListener('orientationchange', handleOrientationChange);
    }
  }, []);

  return device;
};
