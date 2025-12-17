import React, { type ReactNode } from 'react';

export interface DeviceConfig {
  name: string;
  width: number;
  height: number;
  type: DeviceType;
}

export type DeviceType = 'desktop' | 'tablet' | 'mobile';

export const DEVICE_PRESETS: Record<DeviceType, DeviceConfig> = {
  desktop: {
    name: 'Desktop',
    width: 1920,
    height: 1080,
    type: 'desktop',
  },
  tablet: {
    name: 'Tablet',
    width: 768,
    height: 1024,
    type: 'tablet',
  },
  mobile: {
    name: 'Mobile',
    width: 375,
    height: 667,
    type: 'mobile',
  },
};

interface DeviceFrameProps {
  device: DeviceConfig;
  x: number;
  y: number;
  children: ReactNode;
  onMouseLeave?: () => void;
}

export default function DeviceFrame({ device, x, y, children, onMouseLeave }: DeviceFrameProps) {
  return (
    <div
      onMouseLeave={onMouseLeave}
      style={{
        position: 'absolute',
        left: `${x}px`,
        top: `${y}px`,
        width: `${device.width}px`,
        height: `${device.height}px`,
        border: '2px solid rgba(0, 0, 0, 0.2)',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        background: '#ffffff',
      }}
    >
      {/* Device label */}
      <div
        style={{
          position: 'absolute',
          top: '-24px',
          left: 0,
          fontSize: '12px',
          color: '#666',
          fontWeight: 500,
        }}
      >
        {device.name} ({device.width}×{device.height})
      </div>
      {children}
    </div>
  );
}
