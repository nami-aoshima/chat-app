package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
)

// リクエスト用構造体
type DeleteRoomRequest struct {
	RoomID int `json:"room_id"`
}

// チャットルーム削除ハンドラー
func DeleteRoomHandler(w http.ResponseWriter, r *http.Request) {
	// JWTからユーザーID取得
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

	// リクエストボディをパース
	var req DeleteRoomRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// ルームの作成者を確認
	var creatorID int
	err = db.QueryRow("SELECT created_by FROM chat_rooms WHERE id = $1", req.RoomID).Scan(&creatorID)
	if err != nil {
		http.Error(w, "Room not found or DB error", http.StatusNotFound)
		return
	}
	if creatorID != userID {
		http.Error(w, "You are not the creator of this room", http.StatusForbidden)
		return
	}

	// ルーム削除（関連テーブルにON DELETE CASCADE前提）
	_, err = db.Exec("DELETE FROM chat_rooms WHERE id = $1", req.RoomID)
	if err != nil {
		http.Error(w, "Failed to delete room", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("Room deleted successfully"))
}
