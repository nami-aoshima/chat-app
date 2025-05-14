package handler

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
)

type StartChatRequest struct {
	ReceiverID int `json:"receiver_id"` // 🔥 ← frontend からの body に合わせる
}

type StartChatResponse struct {
	RoomID int `json:"room_id"`
}

func StartChatHandler(w http.ResponseWriter, r *http.Request) {
	userIDStr, err := GetUserIDFromToken(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	user1ID, err := strconv.Atoi(userIDStr)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	var req StartChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid input", http.StatusBadRequest)
		return
	}

	user2ID := req.ReceiverID

	// 🔍 同じ2人のルームがあるかチェック（順不同対応）
	query := `
		SELECT cr.id
		FROM chat_rooms cr
		JOIN room_members rm1 ON cr.id = rm1.room_id
		JOIN room_members rm2 ON cr.id = rm2.room_id
		WHERE cr.is_group = false
		AND rm1.user_id IN ($1, $2)
		AND rm2.user_id IN ($1, $2)
		GROUP BY cr.id
		HAVING COUNT(DISTINCT rm1.user_id) = 2
		LIMIT 1;
	`

	var roomID int
	err = db.QueryRow(query, user1ID, user2ID).Scan(&roomID)

	if err == sql.ErrNoRows {
		// ✅ なければ作成
		tx, err := db.Begin()
		if err != nil {
			http.Error(w, "Failed to start transaction", http.StatusInternalServerError)
			return
		}

		err = tx.QueryRow(
			`INSERT INTO chat_rooms (room_name, is_group) VALUES ($1, false) RETURNING id`,
			fmt.Sprintf("Chat %d-%d", user1ID, user2ID),
		).Scan(&roomID)

		if err != nil {
			tx.Rollback()
			http.Error(w, "Failed to create room", http.StatusInternalServerError)
			return
		}

		_, err = tx.Exec(
			`INSERT INTO room_members (room_id, user_id) VALUES ($1, $2), ($1, $3)`,
			roomID, user1ID, user2ID,
		)

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

	// 🎉 レスポンス
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(StartChatResponse{RoomID: roomID})
}
