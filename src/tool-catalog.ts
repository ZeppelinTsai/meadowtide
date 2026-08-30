export type ToolId =
  | "wateringCan"
  | "hoe"
  | "sickle"
  | "dualAxe"
  | "fishingRod"
  | "brush"
  | "milker"
  | "shears";

export const TOOL_DEFINITIONS: readonly {
  id: ToolId;
  label: string;
  description: string;
}[] = [
  { id: "wateringCan", label: "澆水壺", description: "替農地澆水的工具。目前尚未開放澆水功能。" },
  { id: "hoe", label: "鋤頭", description: "翻整土地、準備耕作的農具。" },
  { id: "sickle", label: "鐮刀", description: "割除牧草，整理牧場上的草地。" },
  { id: "dualAxe", label: "斧頭", description: "砍取木材，也能敲碎地表石材與礦石。" },
  { id: "fishingRod", label: "釣竿", description: "在湖邊或海邊垂釣時使用。" },
  { id: "brush", label: "刷子", description: "替牛羊梳理毛髮，讓牠們保持整潔。" },
  { id: "milker", label: "擠奶器", description: "從已餵飽並恢復產奶的牛取得牛奶。" },
  { id: "shears", label: "剪刀", description: "剪取羊毛；羊需要三個成功餵食日才能再次剪毛。" },
];
