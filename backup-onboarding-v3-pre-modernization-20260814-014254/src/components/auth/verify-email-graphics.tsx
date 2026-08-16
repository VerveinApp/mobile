import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

export function BackArrowGraphic({ size = 27 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 27 27">
      <Path
        d="M15.4089 10.0089L8.26335 17.1544L15.4089 24.3L13.5 26.2089L5.4 18.1089V16.2L13.5 8.1L15.4089 10.0089Z"
        fill="white"
      />
    </Svg>
  );
}

export function ReloadIconGraphic({ width = 17.9991, height = 18.0034, color = '#29563A' }: { width?: number; height?: number; color?: string }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 17.9991 18.0034">
      <Path
        d="M16.9321 10.0436C16.7433 11.4835 16.166 12.8449 15.2622 13.9817C14.3585 15.1186 13.1623 15.9879 11.802 16.4966C10.4418 17.0053 8.96866 17.1341 7.54074 16.8691C6.11282 16.6042 4.78395 15.9556 3.69664 14.9929C2.60933 14.0301 1.8046 12.7896 1.36876 11.4042C0.932916 10.0189 0.882404 8.54102 1.22264 7.12916C1.56287 5.71729 2.28102 4.42467 3.30006 3.38993C4.3191 2.35518 5.60059 1.61736 7.00709 1.25557C10.9061 0.255571 14.9421 2.26257 16.4321 6.00257"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M16.9991 1.00257V6.00257H11.9991"
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function PencilIconGraphic({ size = 24, color = '#29563A' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M14.06 9L15 9.94L5.92 19H5V18.08L14.06 9ZM17.66 3C17.41 3 17.15 3.1 16.96 3.29L15.13 5.12L18.88 8.87L20.71 7.04C21.1 6.65 21.1 6 20.71 5.63L18.37 3.29C18.17 3.09 17.92 3 17.66 3ZM14.06 6.19L3 17.25V21H6.75L17.81 9.94L14.06 6.19Z"
        fill={color}
      />
    </Svg>
  );
}

export function ChevronForwardGraphic({ size = 24, color = '#E0E0E0' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M14.175 11.575L10.275 7.675C10.0917 7.49167 10 7.25833 10 6.975C10 6.69167 10.0917 6.45833 10.275 6.275C10.4583 6.09167 10.6917 6 10.975 6C11.2583 6 11.4917 6.09167 11.675 6.275L16.275 10.875C16.375 10.975 16.446 11.0833 16.488 11.2C16.53 11.3167 16.5507 11.4417 16.55 11.575C16.5493 11.7083 16.5287 11.8333 16.488 11.95C16.4473 12.0667 16.3763 12.175 16.275 12.275L11.675 16.875C11.4917 17.0583 11.2583 17.15 10.975 17.15C10.6917 17.15 10.4583 17.0583 10.275 16.875C10.0917 16.6917 10 16.4583 10 16.175C10 15.8917 10.0917 15.6583 10.275 15.475L14.175 11.575Z"
        fill={color}
      />
    </Svg>
  );
}

/** Card panel behind the OTP boxes and Continue button — Rectangle 21 */
export function VerifyCardGraphic({ width = 326, height = 340 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Rect
        x={0.1}
        y={0.1}
        width={width - 0.2}
        height={height - 0.2}
        rx={10}
        opacity={0.79}
        fill="#0C0C0C"
        stroke="#838383"
        strokeWidth={0.2}
      />
    </Svg>
  );
}

/** Resend / change-email card background — Rectangle 22 */
export function ResendCardGraphic({ width = 285, height = 70 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 285 70">
      <Path
        d="M6 0.125H279C282.245 0.125004 284.875 2.75533 284.875 6V64C284.875 67.2447 282.245 69.875 279 69.875H6C2.75533 69.875 0.125 67.2447 0.125 64V6L0.132812 5.69727C0.290371 2.59329 2.85686 0.125 6 0.125Z"
        fill="#0C0C0C"
        stroke="#BDBDBD"
        strokeWidth={0.25}
      />
    </Svg>
  );
}
