import React from 'react';
import { Text as RNText } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  Filter,
  FeGaussianBlur,
  G,
  LinearGradient,
  Mask,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

/** Radial glow behind the header — Ellipse 13 (blurred circle, linear gradient) */
export function GlowGraphic({ size = 542 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 542 542">
      <Defs>
        <LinearGradient id="glowGrad" x1="271" y1="100" x2="271" y2="442" gradientUnits="userSpaceOnUse">
          <Stop offset="0.625" stopColor="#08120B" />
          <Stop offset="1" stopColor="#357849" />
        </LinearGradient>
        <Filter id="glowBlur" x="0" y="0" width="542" height="542" filterUnits="userSpaceOnUse">
          <FeGaussianBlur stdDeviation="50" />
        </Filter>
      </Defs>
      <Circle cx={271} cy={271} r={171} fill="url(#glowGrad)" opacity={0.72} filter="url(#glowBlur)" />
    </Svg>
  );
}

/** Status bar time — "9:41" */
export function StatusTimeGraphic({ width = 54, height = 21 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 54 21">
      <Path
        d="M16.8672 16.0889C19.5552 16.0889 21.1519 13.9868 21.1519 10.4272C21.1519 9.08691 20.8955 7.95898 20.4048 7.0874C19.6943 5.73242 18.4712 5 16.9258 5C14.626 5 13 6.54541 13 8.71338C13 10.7495 14.4648 12.229 16.479 12.229C17.7168 12.229 18.7202 11.6504 19.2183 10.647H19.2402C19.2402 10.647 19.2695 10.647 19.2769 10.647C19.2915 10.647 19.3428 10.647 19.3428 10.647C19.3428 13.064 18.4272 14.5068 16.8818 14.5068C15.9736 14.5068 15.2705 14.0088 15.0288 13.2104H13.1465C13.4614 14.9463 14.9336 16.0889 16.8672 16.0889ZM16.9331 10.7275C15.7173 10.7275 14.853 9.86328 14.853 8.65479C14.853 7.47559 15.7612 6.57471 16.9404 6.57471C18.1196 6.57471 19.0278 7.49023 19.0278 8.68408C19.0278 9.86328 18.1416 10.7275 16.9331 10.7275Z"
        fill="white"
      />
      <Path
        d="M24.243 15.9863C24.9388 15.9863 25.4148 15.4883 25.4148 14.8291C25.4148 14.1626 24.9388 13.6719 24.243 13.6719C23.5545 13.6719 23.0711 14.1626 23.0711 14.8291C23.0711 15.4883 23.5545 15.9863 24.243 15.9863ZM24.243 10.4932C24.9388 10.4932 25.4148 10.0024 25.4148 9.34326C25.4148 8.67676 24.9388 8.18604 24.243 8.18604C23.5545 8.18604 23.0711 8.67676 23.0711 9.34326C23.0711 10.0024 23.5545 10.4932 24.243 10.4932Z"
        fill="white"
      />
      <Path
        d="M32.2706 15.8325H34.0797V13.8623H35.5079V12.2656H34.0797V5.26367H31.4137C29.546 8.07617 28.0592 10.4272 27.107 12.1777V13.8623H32.2706V15.8325ZM28.8575 12.1997C30.088 10.0317 31.1866 8.2959 32.1974 6.80176H32.2999V12.3096H28.8575V12.1997Z"
        fill="white"
      />
      <Path
        d="M39.5365 15.8325H41.4262V5.26367H39.5438L36.7826 7.19727V9.01367L39.412 7.16797H39.5365V15.8325Z"
        fill="white"
      />
    </Svg>
  );
}

/** Status bar right side — signal, wifi, battery */
export function StatusRightGraphic({ width = 66.6614, height = 11.336 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 66.6614 11.336">
      <G opacity={0.4}>
        <Path
          opacity={0.35}
          d="M45.0003 0.502686H61.6664C62.863 0.502686 63.8333 1.47306 63.8333 2.66968V8.66968C63.8332 9.86615 62.8629 10.8357 61.6664 10.8357H45.0003C43.8038 10.8357 42.8335 9.86615 42.8333 8.66968V2.66968C42.8333 1.47306 43.8037 0.502686 45.0003 0.502686Z"
          fill="white"
          stroke="white"
        />
        <Path
          opacity={0.4}
          d="M65.3333 3.66935V7.66935C66.1381 7.33058 66.6614 6.54249 66.6614 5.66935C66.6614 4.79622 66.1381 4.00813 65.3333 3.66935"
          fill="white"
        />
        <Path
          d="M44.3333 3.33602C44.3333 2.59964 44.9303 2.00269 45.6667 2.00269H61C61.7364 2.00269 62.3333 2.59964 62.3333 3.33602V8.00268C62.3333 8.73906 61.7364 9.33602 61 9.33602H45.6667C44.9303 9.33602 44.3333 8.73907 44.3333 8.00269V3.33602Z"
          fill="white"
        />
      </G>
      <Path
        d="M27.4538 8.40057C28.7294 7.32168 30.5982 7.32168 31.8738 8.40057C31.9378 8.45859 31.9745 8.54074 31.9763 8.62713C31.978 8.71359 31.9443 8.79702 31.8825 8.8576L29.8855 10.8732C29.827 10.9324 29.747 10.966 29.6638 10.966C29.5805 10.966 29.5007 10.9324 29.4421 10.8732L27.4441 8.8576C27.3825 8.797 27.3486 8.71351 27.3503 8.62713C27.3521 8.54068 27.3897 8.45855 27.4538 8.40057ZM24.7888 5.71111C27.5369 3.15507 31.7926 3.15512 34.5407 5.71111C34.6027 5.77097 34.6384 5.85351 34.6394 5.93963C34.6403 6.02581 34.6063 6.10892 34.5456 6.1701L33.3913 7.33709C33.2724 7.45619 33.0798 7.45884 32.9577 7.34295C32.0553 6.52576 30.8812 6.07337 29.6638 6.07342C28.4471 6.07392 27.2737 6.52628 26.3718 7.34295C26.2497 7.45877 26.0571 7.45617 25.9382 7.33709L24.7839 6.1701C24.7232 6.10903 24.6893 6.02572 24.6902 5.93963C24.6911 5.8535 24.7268 5.77095 24.7888 5.71111ZM22.1238 3.02947C26.3389 -1.0097 32.9889 -1.00995 37.2038 3.02947C37.2647 3.08942 37.299 3.17156 37.2995 3.25701C37.3 3.34257 37.2661 3.42481 37.2058 3.48553L36.0495 4.65252C35.9304 4.77199 35.7378 4.77324 35.6169 4.65545C34.011 3.12872 31.8796 2.27764 29.6638 2.27752C27.4477 2.27751 25.3158 3.12856 23.7097 4.65545C23.5889 4.77344 23.3961 4.77222 23.2771 4.65252L22.1208 3.48553C22.0606 3.42476 22.0265 3.34259 22.0271 3.25701C22.0277 3.1715 22.0627 3.08939 22.1238 3.02947Z"
        fill="white"
      />
      <Path
        d="M2 7.00293C2.55228 7.00293 3 7.45064 3 8.00293V10.0029C2.99982 10.5551 2.55218 11.0029 2 11.0029H1C0.447824 11.0029 0.000175969 10.5551 0 10.0029V8.00293C0 7.45064 0.447715 7.00293 1 7.00293H2ZM6.66699 5.00293C7.21913 5.00311 7.66699 5.45075 7.66699 6.00293V10.0029C7.66682 10.555 7.21902 11.0028 6.66699 11.0029H5.66699C5.11482 11.0029 4.66717 10.5551 4.66699 10.0029V6.00293C4.66699 5.45064 5.11471 5.00293 5.66699 5.00293H6.66699ZM11.333 2.66895C11.8852 2.66895 12.3328 3.11681 12.333 3.66895V10.0029C12.3328 10.5551 11.8852 11.0029 11.333 11.0029H10.333C9.78098 11.0028 9.33318 10.555 9.33301 10.0029V3.66895C9.33318 3.11692 9.78098 2.66912 10.333 2.66895H11.333ZM16 0.335938C16.5523 0.335938 17 0.783653 17 1.33594V10.0029C16.9998 10.5551 16.5522 11.0029 16 11.0029H15C14.4478 11.0029 14.0002 10.5551 14 10.0029V1.33594C14 0.783653 14.4477 0.335938 15 0.335938H16Z"
        fill="white"
      />
    </Svg>
  );
}

/** Logo swoosh — Vector 10 (main white stroke of the V mark) */
export function LogoMarkAccentGraphic({
  width = 28.6525,
  height = 36.106,
  color = 'white',
}: {
  width?: number;
  height?: number;
  color?: string;
}) {
  return (
    <Svg width={width} height={height} viewBox="0 0 28.6525 36.106">
      <Path
        d="M7.02844 0.0696135H0.0106345C7.02571 1.154 11.9137 10.9451 20.612 35.9292L28.5905 20.3297L21.7433 26.4141C16.1804 13.2576 13.0845 5.52209 7.02844 0.0696135Z"
        fill={color}
        stroke={color}
        strokeWidth={0.139227}
      />
    </Svg>
  );
}

/** Logo checkmark — Group 1 (ellipse + strokes + green base). The green
 * base triangle stays the brand color regardless of theme; `color` only
 * affects the surrounding white-in-dark-mode strokes/fills. */
export function LogoMarkGraphic({
  width = 21.8156,
  height = 30.6813,
  color = 'white',
}: {
  width?: number;
  height?: number;
  color?: string;
}) {
  return (
    <Svg width={width} height={height} viewBox="0 0 21.8156 30.6813">
      <Ellipse cx={14.8248} cy={2.65387} rx={2.4412} ry={2.65387} fill={color} />
      <Path
        d="M16.5515 11.6511H12.1455L15.8966 6.92595L21.0767 4.27208H21.553L16.5515 11.6511Z"
        fill={color}
        stroke={color === 'white' ? 'black' : color}
        strokeWidth={0.278454}
      />
      <Path
        d="M6.19126 11.6511L0.118037 16.1821L6.19126 6.47285H14.0507L10.3592 11.6511H6.19126Z"
        fill={color}
        stroke={color}
        strokeWidth={0.278454}
      />
      <Path
        d="M3.69055 30.6813L15.4797 13.7224H7.69239L4.88028 18.2534H8.55765L3.69055 30.6813Z"
        fill="#2F6647"
      />
    </Svg>
  );
}

// Geist Medium's cap-height (the visible ink height of a capital letter,
// as opposed to the font's full line-height box) as a fraction of its
// font-size — derived from the brand lockup's own Figma numbers: the small
// lockup specs a 169.047px font-size, and this ratio reproduces this
// component's previous cap-height-cropped default (21.8) almost exactly,
// confirming Geist Medium's real metrics rather than a guess.
const WORDMARK_CAP_HEIGHT_RATIO = 0.73;

/**
 * "erveIn" wordmark — real text (paired with LogoMarkGraphic/
 * LogoMarkAccentGraphic, which together read as the "V"), per the brand
 * lockup's Figma spec: font-family Geist, weight 500 (Medium). Previously
 * shipped as flattened SVG path data (Figma vectorizes text on export by
 * default), which silently downgraded the lockup's capital "I" to
 * lowercase — Bezier curves can't be "capitalized" the way real text can,
 * unlike a font glyph. `height` targets the letterforms' own cap-height,
 * not the font's full line-height box, matching how this was previously
 * measured — see WORDMARK_CAP_HEIGHT_RATIO above. Bottom-aligned with the
 * icon mark rather than vertically centered — see the `brandWordmark`
 * position (top ≈ 19, not centered) wherever this is used.
 */
export function WordmarkTextGraphic({
  height = 21.8,
  color = 'white',
}: {
  height?: number;
  color?: string;
}) {
  const fontSize = height / WORDMARK_CAP_HEIGHT_RATIO;
  return (
    <RNText
      style={{
        fontFamily: 'Geist-Medium',
        fontSize,
        lineHeight: fontSize,
        color,
        includeFontPadding: false,
      }}
      numberOfLines={1}
      // Tight cap, not the looser body-text tiers used elsewhere — this is
      // a brand lockup with a hand-tuned negative-margin overlap against
      // the icon mark (see brandWordmark's marginLeft: -15.42 wherever this
      // is used), not prose that can just reflow if it grows.
      maxFontSizeMultiplier={1.1}
    >
      erveIn
    </RNText>
  );
}

export function MailIconGraphic({ width = 14, height = 11.1111 }: { width?: number; height?: number }) {
  return (
    <Svg width={width} height={height} viewBox="0 0 14 11.1111">
      <Path
        d="M1.22222 1.22222L5.63356 4.55311L5.635 4.55456C6.12467 4.9135 6.3695 5.09333 6.63817 5.16267C6.87548 5.22407 7.12452 5.22407 7.36183 5.16267C7.6305 5.09333 7.87606 4.9135 8.36717 4.55311C8.36717 4.55311 11.1961 2.38211 12.7778 1.22222M0.5 8.3V2.81111C0.5 2.00222 0.5 1.59778 0.657445 1.28867C0.796112 1.01639 1.01639 0.796112 1.28867 0.657445C1.59778 0.5 2.00222 0.5 2.81111 0.5H11.1889C11.9978 0.5 12.4022 0.5 12.7106 0.657445C12.9829 0.796112 13.2039 1.01639 13.3426 1.28867C13.5 1.59706 13.5 2.0015 13.5 2.80894V8.30289C13.5 9.11033 13.5 9.51334 13.3426 9.82245C13.2039 10.0943 12.9827 10.3153 12.7106 10.4537C12.4022 10.6111 11.9985 10.6111 11.1911 10.6111H2.80894C2.0015 10.6111 1.59706 10.6111 1.28867 10.4537C1.01689 10.3152 0.795927 10.0942 0.657445 9.82245C0.5 9.51334 0.5 9.10889 0.5 8.3Z"
        fill="none"
        stroke="#D9D9D9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ArrowUpIconGraphic({ size = 24, color = '#ffffff' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 5V19M6 11L12 5L18 11"
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function AppleIconGraphic({
  width = 15.1671,
  height = 18.0023,
  color = 'white',
}: {
  width?: number;
  height?: number;
  color?: string;
}) {
  return (
    <Svg width={width} height={height} viewBox="0 0 15.1671 18.0023">
      <Path
        d="M12.6371 17.28C11.6571 18.23 10.5871 18.08 9.55708 17.63C8.46708 17.17 7.46708 17.15 6.31708 17.63C4.87708 18.25 4.11708 18.07 3.25708 17.28C-1.62292 12.25 -0.902922 4.59 4.63708 4.31C5.98708 4.38 6.92708 5.05 7.71708 5.11C8.89708 4.87 10.0271 4.18 11.2871 4.27C12.7971 4.39 13.9371 4.99 14.6871 6.07C11.5671 7.94 12.3071 12.05 15.1671 13.2C14.5971 14.7 13.8571 16.19 12.6271 17.29L12.6371 17.28ZM7.61708 4.25C7.46708 2.02 9.27708 0.18 11.3571 0C11.6471 2.58 9.01708 4.5 7.61708 4.25Z"
        fill={color}
      />
    </Svg>
  );
}

/** Google "G" mark — clip path (letterform) masking the colorful blurred blobs, as authored in Figma. */
export function GoogleIconGraphic({ size = 16 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      <Defs>
        <Mask id="googleMask" maskUnits="userSpaceOnUse" x="0" y="0" width="16" height="16">
          <Path
            d="M15.8459 6.51573H8.17021V9.59148H12.5807C12.5098 10.0268 12.3506 10.455 12.1175 10.8454C11.8503 11.2928 11.5201 11.6334 11.1817 11.8927C10.1677 12.6697 8.98576 12.8285 8.16484 12.8285C6.09108 12.8285 4.31927 11.4882 3.63329 9.667C3.60563 9.60087 3.58728 9.5326 3.56488 9.46514C3.40971 8.99261 3.33058 8.49813 3.33049 8.00042C3.33049 7.4694 3.42016 6.96111 3.58368 6.48102C4.22868 4.58756 6.0405 3.17337 8.16633 3.17337C8.5939 3.17337 9.00565 3.22425 9.39613 3.32578C10.1096 3.51091 10.7661 3.8719 11.3065 4.37621L13.6404 2.09049C12.2207 0.788767 10.3701 0 8.16244 0C6.3976 0 4.76822 0.549846 3.43297 1.47923C2.35016 2.23282 1.46209 3.24192 0.862699 4.41379C0.305265 5.50042 0 6.70458 0 7.99927C0 9.29403 0.30578 10.5107 0.863214 11.5872V11.5945C1.45203 12.7374 2.31313 13.7215 3.35964 14.4717C4.27395 15.127 5.91333 15.9999 8.16244 15.9999C9.45586 15.9999 10.6022 15.7667 11.6132 15.3297C12.3425 15.0144 12.9886 14.6032 13.5737 14.0747C14.3467 13.3764 14.9521 12.5126 15.3653 11.5189C15.7785 10.5252 15.9995 9.40137 15.9995 8.18305C15.9995 7.61565 15.9425 7.03939 15.8459 6.51573Z"
            fill="white"
          />
        </Mask>
        <RadialGradient id="gPaint0" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="matrix(-0.332462 -7.96789 11.9537 -0.478143 7.79128 16.2933)">
          <Stop offset="0.142" stopColor="#1ABD4D" />
          <Stop offset="0.248" stopColor="#6EC30D" />
          <Stop offset="0.312" stopColor="#8AC502" />
          <Stop offset="0.366" stopColor="#A2C600" />
          <Stop offset="0.446" stopColor="#C8C903" />
          <Stop offset="0.54" stopColor="#EBCB03" />
          <Stop offset="0.616" stopColor="#F7CD07" />
          <Stop offset="0.699" stopColor="#FDCD04" />
          <Stop offset="0.771" stopColor="#FDCE05" />
          <Stop offset="0.861" stopColor="#FFCE0A" />
        </RadialGradient>
        <RadialGradient id="gPaint1" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(15.247 6.98414) scale(5.64621 7.13939)">
          <Stop offset="0.408" stopColor="#FB4E5A" />
          <Stop offset="1" stopColor="#FF4540" />
        </RadialGradient>
        <RadialGradient id="gPaint2" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="matrix(-7.91081 4.28991 5.94565 10.5106 12.1635 1.61716)">
          <Stop offset="0.231" stopColor="#FF4541" />
          <Stop offset="0.312" stopColor="#FF4540" />
          <Stop offset="0.458" stopColor="#FF4640" />
          <Stop offset="0.54" stopColor="#FF473F" />
          <Stop offset="0.699" stopColor="#FF5138" />
          <Stop offset="0.771" stopColor="#FF5B33" />
          <Stop offset="0.861" stopColor="#FF6C29" />
          <Stop offset="1" stopColor="#FF8C18" />
        </RadialGradient>
        <RadialGradient id="gPaint3" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="matrix(-14.3465 -18.3364 -6.91289 5.185 10.0584 17.788)">
          <Stop offset="0.132" stopColor="#0CBA65" />
          <Stop offset="0.21" stopColor="#0BB86D" />
          <Stop offset="0.297" stopColor="#09B479" />
          <Stop offset="0.396" stopColor="#08AD93" />
          <Stop offset="0.477" stopColor="#0AA6A9" />
          <Stop offset="0.568" stopColor="#0D9CC6" />
          <Stop offset="0.667" stopColor="#1893DD" />
          <Stop offset="0.769" stopColor="#258BF1" />
          <Stop offset="0.859" stopColor="#3086FF" />
        </RadialGradient>
        <RadialGradient id="gPaint4" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="matrix(-1.01528 8.56807 12.0997 1.37446 9.23988 4.16179)">
          <Stop offset="0.366" stopColor="#FF4E3A" />
          <Stop offset="0.458" stopColor="#FF8A1B" />
          <Stop offset="0.54" stopColor="#FFA312" />
          <Stop offset="0.616" stopColor="#FFB60C" />
          <Stop offset="0.771" stopColor="#FFCD0A" />
          <Stop offset="0.861" stopColor="#FECF0A" />
          <Stop offset="0.915" stopColor="#FECF08" />
          <Stop offset="1" stopColor="#FDCD01" />
        </RadialGradient>
        <RadialGradient id="gPaint5" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="matrix(-2.93461 3.17778 -9.15442 -8.10426 7.81227 4.07282)">
          <Stop offset="0.316" stopColor="#FF4C3C" />
          <Stop offset="0.604" stopColor="#FF692C" />
          <Stop offset="0.727" stopColor="#FF7825" />
          <Stop offset="0.885" stopColor="#FF8D1B" />
          <Stop offset="1" stopColor="#FF9F13" />
        </RadialGradient>
        <RadialGradient id="gPaint6" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="matrix(-7.91081 -4.28991 5.94565 -10.5106 12.1635 19.8206)">
          <Stop offset="0.231" stopColor="#0FBC5F" />
          <Stop offset="0.312" stopColor="#0FBC5F" />
          <Stop offset="0.366" stopColor="#0FBC5E" />
          <Stop offset="0.458" stopColor="#0FBC5D" />
          <Stop offset="0.54" stopColor="#12BC58" />
          <Stop offset="0.699" stopColor="#28BF3C" />
          <Stop offset="0.771" stopColor="#38C02B" />
          <Stop offset="0.861" stopColor="#52C218" />
          <Stop offset="0.915" stopColor="#67C30F" />
          <Stop offset="1" stopColor="#86C504" />
        </RadialGradient>
        <LinearGradient id="gPaint7" x1="8.94742" y1="17.0796" x2="10.9345" y2="17.0796" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor="#0FBC5C" />
          <Stop offset="1" stopColor="#0CBA65" />
        </LinearGradient>
      </Defs>
      <G mask="url(#googleMask)">
        <G transform="translate(-1.6266, -2.6202)">
          <Path d="M1.65305 10.7726C1.66151 12.0469 2.02462 13.3617 2.57422 14.4231V14.4305C2.97139 15.2013 3.51414 15.8101 4.13227 16.4134L7.86604 15.051C7.1596 14.6922 7.05181 14.4723 6.54547 14.0711C6.02799 13.5492 5.64231 12.9502 5.40214 12.2478H5.39242L5.40214 12.2405C5.24411 11.7767 5.22856 11.2843 5.22267 10.7726H1.65305Z" fill="url(#gPaint0)" />
          <Path d="M9.94094 2.66088C9.57195 3.95742 9.71301 5.21764 9.94094 5.95092C10.3671 5.95127 10.7777 6.00203 11.1669 6.10327C11.8804 6.28832 12.5369 6.64932 13.0773 7.1537L15.4709 4.80961C14.0529 3.50939 12.3464 2.66289 9.94094 2.66088Z" fill="url(#gPaint1)" />
          <Path d="M9.93294 2.65063C8.12284 2.65063 6.45162 3.21458 5.08213 4.16779C4.57522 4.52044 4.10879 4.92872 3.69143 5.38513C3.58261 6.40643 4.50629 7.66158 6.33554 7.65117C7.22305 6.61882 8.53573 5.9508 9.99667 5.9508L10.0007 5.95092L9.941 2.65086L9.93294 2.65063Z" fill="url(#gPaint2)" />
          <Path d="M15.9075 11.1422L14.2918 12.2522C14.2209 12.6874 14.0616 13.1157 13.8285 13.5061C13.5613 13.9535 13.2312 14.2941 12.8927 14.5535C11.8809 15.3287 10.702 15.4884 9.88133 15.489C9.03303 16.9339 8.88432 17.6575 9.94094 18.8236C11.2485 18.8227 12.4076 18.5866 13.43 18.1446C14.1691 17.8251 14.8239 17.4084 15.4168 16.8728C16.2002 16.1651 16.8138 15.2898 17.2326 14.2827C17.6513 13.2756 17.8753 12.1368 17.8753 10.9021L15.9075 11.1422Z" fill="url(#gPaint3)" />
          <Path d="M9.82166 9.11796V12.4274H17.5951C17.6635 11.9742 17.8896 11.3877 17.8896 10.9021C17.8896 10.3347 17.8326 9.64167 17.736 9.11796H9.82166Z" fill="#3086FF" />
          <Path d="M3.72858 5.26835C3.24882 5.79321 2.83902 6.3807 2.51409 7.01602C1.95666 8.10265 1.65139 9.42365 1.65139 10.7183C1.65139 10.7366 1.65288 10.7544 1.65305 10.7727C1.89996 11.246 5.06327 11.1554 5.22273 10.7727C5.2225 10.7548 5.2205 10.7374 5.2205 10.7195C5.2205 10.1885 5.31024 9.79708 5.4737 9.31699C5.67546 8.72478 5.9913 8.17949 6.39521 7.70964C6.48677 7.59275 6.731 7.34145 6.80221 7.19071C6.82936 7.13332 6.75295 7.10109 6.74866 7.08089C6.74392 7.05827 6.64144 7.07645 6.61852 7.05959C6.54564 7.00612 6.40133 6.9782 6.31365 6.9534C6.12635 6.90039 5.81594 6.78343 5.64351 6.66216C5.09848 6.27894 4.24801 5.82113 3.72858 5.26835Z" fill="url(#gPaint4)" />
          <Path d="M5.65522 7.08313C6.91904 7.8487 7.28249 6.69669 8.12278 6.33621L6.6611 3.30501C6.12784 3.52914 5.61937 3.80894 5.14403 4.13982C4.44011 4.62975 3.81849 5.22765 3.30501 5.90798L5.65522 7.08313Z" fill="url(#gPaint5)" />
          <Path d="M6.16962 14.8168C4.47308 15.4293 4.20748 15.4513 4.05134 16.5027C4.35069 16.7949 4.67152 17.064 5.01109 17.3076C5.92534 17.9629 7.684 18.8358 9.93317 18.8358L9.941 18.8356V15.4306L9.93563 15.4307C9.09339 15.4307 8.42033 15.2095 7.7303 14.8248C7.56015 14.73 7.25145 14.9847 7.09456 14.8708C6.87817 14.7137 6.35726 15.0061 6.16962 14.8168Z" fill="url(#gPaint6)" />
          <Path opacity={0.5} d="M8.94742 15.3234V18.7766C9.26211 18.8135 9.58961 18.8358 9.93317 18.8358C10.2776 18.8358 10.6107 18.8181 10.9345 18.7856V15.3467C10.6045 15.4027 10.2703 15.4308 9.93563 15.4307C9.59658 15.4307 9.26691 15.3913 8.94742 15.3234Z" fill="url(#gPaint7)" />
        </G>
      </G>
    </Svg>
  );
}

/** The translucent card panel behind the form, including the pre-baked Apple/Google button outlines. */
export function CardFrameGraphic({
  width = 326.4,
  height = 322.4,
  showButtonSlots = true,
  fill = '#0C0C0C',
  stroke = '#838383',
}: {
  width?: number;
  height?: number;
  /** Set false when each button renders its own pill (e.g. so it can animate independently). */
  showButtonSlots?: boolean;
  fill?: string;
  stroke?: string;
}) {
  return (
    <Svg width={width} height={height} viewBox="0 0 326.4 322.4">
      <Rect x={0.1} y={0.1} width={326.2} height={322.2} rx={10.1} opacity={0.79} fill={fill} stroke={stroke} strokeWidth={0.2} />
      {showButtonSlots ? (
        <>
          <Path
            d="M25.2 212.325H298.2C301.445 212.325 304.075 214.955 304.075 218.2V241.2C304.075 244.445 301.445 247.075 298.2 247.075H25.2C21.9553 247.075 19.325 244.445 19.325 241.2V218.2L19.3328 217.897C19.4904 214.793 22.0569 212.325 25.2 212.325Z"
            fill="black"
            stroke="#BDBDBD"
            strokeWidth={0.25}
          />
          <Path
            d="M25.2 261.325H298.2C301.445 261.325 304.075 263.955 304.075 267.2V290.2C304.075 293.445 301.445 296.075 298.2 296.075H25.2C21.9553 296.075 19.325 293.445 19.325 290.2V267.2L19.3328 266.897C19.4904 263.793 22.0569 261.325 25.2 261.325Z"
            fill="black"
            stroke="#BDBDBD"
            strokeWidth={0.25}
          />
        </>
      ) : null}
    </Svg>
  );
}

/** Email input field background — Rectangle 22 */
export function InputFieldGraphic({
  width = 285,
  height = 35,
  fill = '#0C0C0C',
  stroke = '#BDBDBD',
  strokeWidth = 0.25,
}: {
  width?: number;
  height?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}) {
  return (
    <Svg width={width} height={height} viewBox="0 0 285 35">
      <Path
        d="M6 0.125H279C282.245 0.125004 284.875 2.75533 284.875 6V29C284.875 32.2447 282.245 34.875 279 34.875H6C2.75533 34.875 0.125 32.2447 0.125 29V6L0.132812 5.69727C0.290371 2.59329 2.85686 0.125 6 0.125Z"
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    </Svg>
  );
}
