import { gameSettings, toggleMasterMuted, updateSettings } from "./settings";
import { showUiToast } from "./ui-toast";

const RESOLUTIONS = ["1280x720", "1600x900", "1920x1080"];

function makeVolumeRow(
  label: string,
  key: "masterVolume" | "musicVolume" | "sfxVolume",
) {
  const row = document.createElement("label");
  row.className = "systemSettingRow";
  const name = document.createElement("span");
  name.textContent = label;
  const value = document.createElement("output");
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

function makeButton(text: string, onClick: (button: HTMLButtonElement) => void) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "titleMenuBtn";
  button.textContent = text;
  button.addEventListener("click", () => onClick(button));
  return button;
}

export function mountSystemSettings(container: HTMLElement) {
  container.replaceChildren();
  const fullscreen = makeButton("全螢幕：關", async (button) => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      button.textContent =
        "全螢幕：" + (document.fullscreenElement ? "開" : "關");
      showUiToast(
        "顯示設定",
        document.fullscreenElement ? "已開啟全螢幕" : "已離開全螢幕",
      );
    } catch {
      showUiToast("顯示設定", "目前環境無法切換全螢幕");
    }
  });
  fullscreen.textContent =
    "全螢幕：" + (document.fullscreenElement ? "開" : "關");

  const resolution = document.createElement("label");
  resolution.className = "systemSettingRow systemSettingSelect";
  const resolutionName = document.createElement("span");
  resolutionName.textContent = "視窗解析度";
  const select = document.createElement("select");
  select.setAttribute("aria-label", "視窗解析度");
  RESOLUTIONS.forEach((size) => {
    const option = document.createElement("option");
    option.value = size;
    option.textContent = size.replace("x", " × ");
    option.selected = size === gameSettings.windowResolution;
    select.append(option);
  });
  select.addEventListener("change", () => {
    const [width, height] = select.value.split("x").map(Number);
    updateSettings({ windowResolution: select.value });
    if (document.fullscreenElement) {
      showUiToast("顯示設定", "全螢幕時不調整視窗解析度");
      return;
    }
    window.resizeTo(width, height);
    showUiToast("顯示設定", "視窗解析度 " + width + " × " + height);
  });
  resolution.append(resolutionName, select);

  const mute = makeButton("", (button) => {
    const muted = toggleMasterMuted();
    button.textContent = "全部靜音：" + (muted ? "開" : "關");
    showUiToast("音量設定", muted ? "已全部靜音" : "已恢復音量");
  });
  mute.textContent = "全部靜音：" + (gameSettings.muted ? "開" : "關");

  container.append(
    fullscreen,
    resolution,
    makeVolumeRow("總音量", "masterVolume"),
    makeVolumeRow("音樂音量", "musicVolume"),
    makeVolumeRow("音效音量", "sfxVolume"),
    mute,
  );
  return container.querySelector<HTMLElement>("button, input, select");
}
