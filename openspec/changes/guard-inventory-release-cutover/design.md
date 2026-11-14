## Context

Cloud Run 切換流量時，已受理的舊請求仍可完成。

## Decisions

V31 在同一筆交易中鎖定庫存、安裝觸發器並建立基準。正式後端在 Spring JDBC 交易開始時設定交易範圍的能力標記。舊版的庫存寫入若排在 V31 後面會被拒絕並回滾。未發布的 V31 可與保護一起更新。

Cloud Build 將提交 SHA 傳給後端，由既有 Actuator info 提供。前後端皆有改動時，Firebase 工作流程確認相同 SHA 後才發布。
