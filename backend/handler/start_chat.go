package handler

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
)

// フロントエンドは receiver_id だけ送ってくる
type StartChatRequest struct {
	ReceiverID int `json:"receiver_id"`
}

type StartChatResponse struct {
	RoomID int `json:"room_id"`
}

func StartChatHandler(w http.ResponseWriter, r *http.Request) {
	// JWT からログインユーザーIDを取得
	userIDStr, err := GetUserIDFromToken(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// リクエストボディから相手のIDを取得
	var req StartChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid input", http.StatusBadRequest)
		return
	}
	receiverID := req.ReceiverID

	// すでに同じ2人のチャットがあるかチェック
	query := `
	SELECT rm1.room_id
	FROM room_members rm1
	JOIN room_members rm2 ON rm1.room_id = rm2.room_id
	JOIN chat_rooms cr ON cr.id = rm1.room_id
	WHERE rm1.user_id = $1 AND rm2.user_id = $2 AND cr.is_group = false
	GROUP BY rm1.room_id
	HAVING COUNT(*) = 2
	LIMIT 1;
	`

	var roomID int
	err = db.QueryRow(query, userID, receiverID).Scan(&roomID)

	if err == sql.ErrNoRows {
		// 存在しない → 新規作成
		tx, err := db.Begin()
		if err != nil {
			http.Error(w, "Failed to start transaction", http.StatusInternalServerError)
			return
		}

		// ルーム作成
		err = tx.QueryRow(`INSERT INTO chat_rooms (room_name, is_group) VALUES ($1, false) RETURNING id`,
			fmt.Sprintf("Chat %d-%d", userID, receiverID)).Scan(&roomID)
		if err != nil {
			tx.Rollback()
			http.Error(w, "Failed to create chat room", http.StatusInternalServerError)
			return
		}

		// メンバー登録
		_, err = tx.Exec(`INSERT INTO room_members (room_id, user_id) VALUES ($1, $2), ($1, $3)`, roomID, userID, receiverID)
		if err != nil {
			tx.Rollback()
			http.Error(w, "Failed to add members", http.StatusInternalServerError)
			return
		}

		tx.Commit()
	} else if err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	// 成功レスポンス
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(StartChatResponse{RoomID: roomID})
}
