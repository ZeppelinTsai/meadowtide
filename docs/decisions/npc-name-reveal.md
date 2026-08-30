# NPC 名稱揭露系統

src/npc-name-reveal.ts 是 NPC 名稱、名稱揭露階段與顯示名稱的單一資料源。
對話框、關係頁、好感提示、名冊與日後新增的角色資訊 UI 都必須呼叫
getNpcDisplayName(npcId)，不得直接顯示 npc.name、職業名稱或真名。

狀態使用 nameRevealStage 語意：

- 一般居民：Stage 0「???」，Stage 1 正式姓名。
- 山神／海神：Stage 0「???」，Stage 1 身分稱號，Stage 2 真名。
- 神明的 Stage 2 只能由指定結婚劇情明確呼叫，不得由好感度、星數、戀愛或求婚條件自動推進。

劇情只能在角色親口說完介紹台詞後呼叫
setNpcNameStage(npcId, stage)。舊式連續對話可在該行使用
revealNameAfter；正式 story step 使用 setNpcNameStage，並放在揭露台詞的下一步。
因此揭露台詞本身仍顯示舊階段，下一句才顯示新名稱。

存檔 v10 的 npcNameRevealStages 保存所有階段。讀取舊存檔時，序章完成會安全遷移
村長與船長，木匠／廚師則依各自任務是否已開始判斷；缺漏或未知 ID 一律回退為
「???」，不允許空白。開新遊戲必須呼叫 resetNpcNameRevealState()。

修改此系統後必須執行：

    npm run test:story
    npm run story-audit
    npm run build