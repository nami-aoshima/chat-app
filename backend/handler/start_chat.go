package handler

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
)

// リクエスト用の構造体
type StartChatRequest struct {
	User1ID int `json:"user1_id"`
	User2ID int `json:"user2_id"`
}

// レスポンス用の構造体
type StartChatResponse struct {
	RoomID int `json:"room_id"`
}

func StartChatHandler(w http.ResponseWriter, r *http.Request) {
	var req StartChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid input", http.StatusBadRequest)
		return
	}

	// すでに2人だけのチャットルームが存在するかチェック
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
	err := db.QueryRow(query, req.User1ID, req.User2ID).Scan(&roomID)

	if err == sql.ErrNoRows {
		// ルームが存在しない → 新しく作成
		tx, err := db.Begin()
		if err != nil {
			http.Error(w, "Failed to start transaction", http.StatusInternalServerError)
			return
		}

		// chat_rooms に新規追加
		err = tx.QueryRow(`INSERT INTO chat_rooms (room_name, is_group) VALUES ($1, false) RETURNING id`, fmt.Sprintf("Chat %d-%d", req.User1ID, req.User2ID)).Scan(&roomID)
		if err != nil {
			tx.Rollback()
			http.Error(w, "Failed to create chat room", http.StatusInternalServerError)
			return
		}

		// room_members に2人を追加
		_, err = tx.Exec(`INSERT INTO room_members (room_id, user_id) VALUES ($1, $2), ($1, $3)`, roomID, req.User1ID, req.User2ID)
		if err != nil {
			tx.Rollback()
			http.Error(w, "Failed to add members", http.StatusInternalServerError)
			return
		}

		tx.Commit()
	} else if err != nil {
		http.Error(w, "DB error (maybe user doesn't exist)", http.StatusInternalServerError)
		return
	}

	// 成功レスポンス
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(StartChatResponse{RoomID: roomID})
}
