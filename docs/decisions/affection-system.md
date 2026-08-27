# 好感度系統

好感度的唯一資料與判定來源是 `src/affection.ts`。每位角色各自保存點數、
每日首次對話日期、已完成事件、已解鎖階段、目前鎖定階段，以及已播放完整
提示的階段。每 100 點為一星，友情線最高 8 星。

2、4、6 星分別在 200、400、600 點鎖定。鎖定期間仍累積正向好感，但上限
是門檻加 50 點；顯示星數不得超過鎖定星數。`completePersonalEvent()` 只接受
目前鎖定階段，先解除鎖定並記錄唯一 event id，再加入 30 點，因此暫存點數
與事件獎勵都會保留。同一 event id 不可重複領取。

所有固定增減值集中在 `AFFECTION_REWARDS`。玩法端優先呼叫
`awardNpcAffectionReward()`；尚未有正式送禮或慶典玩法時，不要自行複製數字。
每日閒聊由 `src/input-save.ts` 在整段對話結束後呼叫
`completeNpcDailyConversation()`。完整鎖定提示、簡短 Toast 與事件音效集中在
`src/affection-ui.ts`。

存檔版本為 5，欄位 `relationships` 保存上述逐角色狀態；舊存檔的
`npcMemory` 會遷移成初始點數。驗證命令：

```bash
npm run test:affection
npm run build
```

專用測試必須涵蓋 200→250、400→450、600→650，以及各階段解除鎖定後
保留暫存值並完整加入事件 +30。
