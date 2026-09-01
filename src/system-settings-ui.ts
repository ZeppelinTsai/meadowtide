import { gameSettings, toggleMasterMuted, updateSettings } from "./settings";
import { showUiToast } from "./ui-toast";
import { getLocale, setLocale, translateText } from "./i18n";

const RESOLUTIONS = ["1280x720", "1600x900", "1920x1080"];

function makeGroup(title: string) {
  const group = document.createElement("div");
  group.className = "systemSettingGroup";
  const heading = document.createElement("h3");
  heading.className = "systemSettingGroupTitle";
  heading.textContent = translateText(title);
  group.append(heading);
  return group;
}

function makeVolumeRow(
  label: string,
  key: "masterVolume" | "musicVolume" | "sfxVolume",
) {
  const row = document.createElement("div");
  row.className = "systemSettingRow";
  const name = document.createElement("span");
  name.className = "systemSettingLabel";
  name.textContent = label;
  const value = document.createElement("output");
  value.className = "systemSettingValue";
  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = "0";
  slider.max = "100";
  slider.step = "10";
  slider.value = String(Math.round(gameSettings[key] * 100));
  value.textContent = slider.value + "%";
  slider.setAttribute("aria-label", label);
  slider.addEventListener("input", () => {
    updateSettings({ [key]: Number(slider.value) / 100 });
    value.textContent = slider.value + "%";
    showUiToast("系統設定", label + " " + slider.value + "%");
  });
  row.append(name, slider, value);
  return row;
}

type CycleOption<T extends string> = { value: T; label: string };

/**
 * 語言／控制器配置／視窗解析度共用的「‹ 目前值 ›」控制項——取代原本的
 * 原生 <select>。原生下拉選單手把幾乎按不動：A 鍵打開的是作業系統層級
 * 的選單彈窗，搖桿合成的鍵盤事件完全進不去那個彈窗。改成單一可
 * focus 的元素後，方向鍵／搖桿左右直接切換選項（跟音量滑桿的左右鍵
 * 行為一致，見 gamepad-input.ts 的 data-cycle-control 特判），滑鼠點
 * 左半邊／右半邊也能切換，不需要另外打開任何彈出選單。
 */
function makeCycleRow<T extends string>(
  label: string,
  options: CycleOption<T>[],
  current: T,
  onChange: (value: T, label: string) => void,
) {
  const row = document.createElement("div");
  row.className = "systemSettingRow systemSettingCycle";
  const name = document.createElement("span");
  name.className = "systemSettingLabel";
  name.textContent = label;

  const control = document.createElement("div");
  control.className = "systemSettingCycleControl";
  control.tabIndex = 0;
  control.dataset.cycleControl = "true";

  const prevArrow = document.createElement("span");
  prevArrow.className = "systemSettingCycleArrow";
  prevArrow.textContent = "‹";
  prevArrow.setAttribute("aria-hidden", "true");

  const valueText = document.createElement("span");
  valueText.className = "systemSettingCycleValue";

  const nextArrow = document.createElement("span");
  nextArrow.className = "systemSettingCycleArrow";
  nextArrow.textContent = "›";
  nextArrow.setAttribute("aria-hidden", "true");

  control.append(prevArrow, valueText, nextArrow);

  let index = Math.max(
    0,
    options.findIndex((option) => option.value === current),
  );

  const render = () => {
    const option = options[index];
    valueText.textContent = option.label;
    control.setAttribute("aria-label", `${label}：${option.label}`);
  };
  render();

  const step = (delta: number) => {
    index = (index + delta + options.length) % options.length;
    render();
    onChange(options[index].value, options[index].label);
  };

  control.addEventListener("click", (event) => {
    const rect = control.getBoundingClientRect();
    const leftHalf = event.clientX - rect.left < rect.width / 2;
    step(leftHalf ? -1 : 1);
  });
  control.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      step(-1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      step(1);
    }
  });
  control.addEventListener("cycle-step", ((event: CustomEvent<number>) => {
    step(event.detail);
  }) as EventListener);

  row.append(name, control);
  return row;
}

/** 全螢幕／全部靜音共用的開關列——原本是一整顆寫著「全螢幕：關」的大
 * 按鈕，改成跟其他設定列一致的「標籤 + 開關」排版，視覺上不再是一顆
 * 突兀的滿版按鈕。互動上仍是單一 button，A 鍵／Enter／滑鼠點擊都直接
 * 觸發，跟原本行為相同。 */
function makeToggleRow(
  label: string,
  getOn: () => boolean,
  onToggle: () => void | Promise<void>,
) {
  const row = document.createElement("div");
  row.className = "systemSettingRow systemSettingToggle";
  const name = document.createElement("span");
  name.className = "systemSettingLabel";
  name.textContent = label;

  const switchBtn = document.createElement("button");
  switchBtn.type = "button";
  switchBtn.className = "systemSettingSwitch";
  const knob = document.createElement("span");
  knob.className = "systemSettingSwitchKnob";
  switchBtn.append(knob);

  const stateText = document.createElement("span");
  stateText.className = "systemSettingSwitchState";

  const sync = () => {
    const on = getOn();
    switchBtn.classList.toggle("is-on", on);
    switchBtn.setAttribute("aria-pressed", String(on));
    const stateWord = translateText(on ? "開" : "關");
    stateText.textContent = stateWord;
    switchBtn.setAttribute("aria-label", `${label}：${stateWord}`);
  };

  switchBtn.addEventListener("click", async () => {
    await onToggle();
    sync();
  });
  sync();

  row.append(name, switchBtn, stateText);
  return row;
}

export function mountSystemSettings(container: HTMLElement) {
  container.replaceChildren();

  const generalGroup = makeGroup("一般");
  const language = makeCycleRow<"zh" | "ja" | "en">(
    translateText("語言"),
    [
      { value: "zh", label: "繁體中文" },
      { value: "ja", label: "日本語" },
      { value: "en", label: "English" },
    ],
    getLocale(),
    (locale) => {
      updateSettings({ locale });
      setLocale(locale);
      mountSystemSettings(container);
      container.querySelector<HTMLElement>("[data-cycle-control]")?.focus();
      showUiToast("系統設定", "語言已切換");
    },
  );
  generalGroup.append(language);

  const displayGroup = makeGroup("顯示");
  const fullscreenToggle = makeToggleRow(
    translateText("全螢幕"),
    () => !!document.fullscreenElement,
    async () => {
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else await document.documentElement.requestFullscreen();
        showUiToast(
          "顯示設定",
          document.fullscreenElement ? "已開啟全螢幕" : "已離開全螢幕",
        );
      } catch {
        showUiToast("顯示設定", "目前環境無法切換全螢幕");
      }
    },
  );
  const resolution = makeCycleRow(
    translateText("視窗解析度"),
    RESOLUTIONS.map((size) => ({ value: size, label: size.replace("x", " × ") })),
    gameSettings.windowResolution,
    (windowResolution) => {
      if (document.fullscreenElement) {
        showUiToast("顯示設定", "全螢幕時不調整視窗解析度");
        return;
      }
      const [width, height] = windowResolution.split("x").map(Number);
      updateSettings({ windowResolution });
      window.resizeTo(width, height);
      showUiToast(
        "顯示設定",
        translateText("視窗解析度") + " " + width + " × " + height,
      );
    },
  );
  displayGroup.append(fullscreenToggle, resolution);

  const controlGroup = makeGroup("操作");
  const controller = makeCycleRow<"auto" | "nintendo" | "xbox">(
    "Controller layout",
    [
      { value: "auto", label: "Auto" },
      { value: "nintendo", label: "Nintendo" },
      { value: "xbox", label: "Xbox" },
    ],
    gameSettings.controllerLayout,
    (controllerLayout, label) => {
      updateSettings({ controllerLayout });
      dispatchEvent(new CustomEvent("controller-layout-changed"));
      showUiToast("Controller", label);
    },
  );
  controlGroup.append(controller);

  const audioGroup = makeGroup("音量");
  const muteToggle = makeToggleRow(
    translateText("全部靜音"),
    () => gameSettings.muted,
    () => {
      const muted = toggleMasterMuted();
      showUiToast("音量設定", muted ? "已全部靜音" : "已恢復音量");
    },
  );
  audioGroup.append(
    makeVolumeRow(translateText("總音量"), "masterVolume"),
    makeVolumeRow(translateText("音樂音量"), "musicVolume"),
    makeVolumeRow(translateText("音效音量"), "sfxVolume"),
    muteToggle,
  );

  container.append(generalGroup, displayGroup, controlGroup, audioGroup);
  return container.querySelector<HTMLElement>("button, input, [data-cycle-control]");
}
