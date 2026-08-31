const svg = (body: string) =>
  `<svg viewBox="0 0 48 48" aria-hidden="true" focusable="false">${body}</svg>`;

const sun = `
  <g stroke="#e69a18" stroke-width="3" stroke-linecap="round">
    <path d="M24 4v6M24 38v6M4 24h6M38 24h6M9.9 9.9l4.2 4.2M33.9 33.9l4.2 4.2M38.1 9.9l-4.2 4.2M14.1 33.9l-4.2 4.2"/>
  </g><circle cx="24" cy="24" r="10" fill="#ffc83d" stroke="#e69a18" stroke-width="2"/>`;
const cloud = `<path d="M12 32h24a7 7 0 0 0 0-14 12 12 0 0 0-22-2A8 8 0 0 0 12 32Z" fill="#b9c7d0" stroke="#657783" stroke-width="2"/>`;
const rain = `<g stroke="#3c91d1" stroke-width="3" stroke-linecap="round"><path d="M16 35l-2 5M25 35l-2 5M34 35l-2 5"/></g>`;
const snow = `<g stroke="#63aee2" stroke-width="2.5" stroke-linecap="round"><path d="M24 10v28M12 17l24 14M36 17 12 31"/><path d="m24 10-3 4m3-4 3 4m-15 3 5 .5M12 17l2 4m22-4-5 .5M36 17l-2 4m-10 17-3-4m3 4 3-4"/></g>`;

export function weatherIconSvg(weatherKey: string) {
  switch (weatherKey) {
    case "clear":
      return svg(sun);
    case "cloudy":
      return svg(cloud);
    case "rain":
      return svg(cloud + rain);
    case "typhoon":
      return svg(
        `<path d="M37 16c-8-9-25-4-24 8 1 10 16 13 21 5 4-7-3-14-10-10-5 3-2 10 3 9 3 0 4-4 2-6" fill="none" stroke="#4b8fc0" stroke-width="4" stroke-linecap="round"/>`,
      );
    case "storm":
      return svg(
        cloud +
          `<path d="m27 30-7 10h6l-3 6 11-13h-7Z" fill="#f2b72b" stroke="#b47a00" stroke-width="1.5"/>`,
      );
    case "snow":
      return svg(snow);
    case "blizzard":
      return svg(
        cloud + `<g transform="translate(0 9) scale(.72)">${snow}</g>`,
      );
    case "meteor-shower":
      return svg(`
    <g fill="#ffd45e">
      <!-- 尾巴再往右上微調 -->
      <path
        d="M41.5 6 L27.5 29 L20.5 22 Z"
        fill="#ffd45e"
        stroke="#b47a00"
        stroke-width="1.5"
        stroke-linejoin="round"
      />

      <!-- 主星：再往右上微調 (X+1.5, Y-1.5) -->
      <path
        d="
          M23 12.7
          L28.4 23.8
          L40.6 25.6
          L31.7 34.2
          L33.8 46.4
          L23 40.8
          L12.2 46.4
          L14.3 34.2
          L5.4 25.6
          L17.6 23.8
          Z
        "
        fill="#ffd45e"
        stroke="#b47a00"
        stroke-width="1.5"
        stroke-linejoin="round"
      />
    </g>
  `);

    case "meteor-peak":
      return svg(`
    <g fill="#ffd45e" stroke="#b47a00" stroke-linejoin="round">

      <!-- 左上小流星（上流星再往左 2px） -->
      <g>
        <!-- 尾巴 -->
        <path
          d="M24 -1 L13.5 15.5 L10.5 12.5 Z"
          fill="#ffd45e"
          stroke="#b47a00"
          stroke-width="1.2"
        />

        <!-- 星星 -->
        <path
          d="
            M11.5 10
            L13.6 14.3
            L18.4 15
            L14.9 18.4
            L15.8 23.1
            L11.5 20.9
            L7.2 23.1
            L8.1 18.4
            L4.6 15
            L9.4 14.3
            Z
          "
          stroke-width="1.2"
        />
      </g>

      <!-- 中央主流星（維持不動） -->
      <g>
        <!-- 粗、長尾巴 -->
        <path
          d="M41.5 6 L27.5 29 L20.5 22 Z"
          fill="#ffd45e"
          stroke="#b47a00"
          stroke-width="1.5"
          stroke-linejoin="round"
        />

        <!-- 最大主星 -->
        <path
          d="
            M23 12.7
            L28.4 23.8
            L40.6 25.6
            L31.7 34.2
            L33.8 46.4
            L23 40.8
            L12.2 46.4
            L14.3 34.2
            L5.4 25.6
            L17.6 23.8
            Z
          "
          fill="#ffd45e"
          stroke="#b47a00"
          stroke-width="1.5"
          stroke-linejoin="round"
        />
      </g>

      <!-- 右下小流星（下流星再往下 2px） -->
      <g>
        <!-- 尾巴 -->
        <path
          d="M51 20 L41.5 35.5 L38.5 32.5 Z"
          fill="#ffd45e"
          stroke="#b47a00"
          stroke-width="1.2"
        />

        <!-- 星星 -->
        <path
          d="
            M39.5 29
            L41.6 33.3
            L46.4 34
            L42.9 37.4
            L43.8 42.1
            L39.5 39.9
            L35.2 42.1
            L36.1 37.4
            L32.6 34
            L37.4 33.3
            Z
          "
          stroke-width="1.2"
        />
      </g>

    </g>
      `);
    default:
      return svg(
        `<circle cx="24" cy="24" r="10" fill="#d8c38f"/><path d="M24 17v9" stroke="#493025" stroke-width="3"/><circle cx="24" cy="32" r="2" fill="#493025"/>`,
      );
  }
}
