package handler

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
)

// リクエストの構造体：チャット相手のユーザーIDを受け取る
type StartChatRequest struct {
	ReceiverID int `json:"receiver_id"` // フロントエンドから渡される相手のユーザーID
}

// レスポンスの構造体：作成または取得したルームIDを返す
type StartChatResponse struct {
	RoomID int `json:"room_id"`
}

// StartChatHandler：1対1チャットを開始するAPI
func StartChatHandler(w http.ResponseWriter, r *http.Request) {
	// 🔐 JWTトークンから自分のユーザーIDを取得（ログインチェック）
	userIDStr, err := GetUserIDFromToken(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// 🔢 文字列の userID を整数に変換（DBで使うため）
	user1ID, err := strconv.Atoi(userIDStr)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// 📦 JSONのリクエストボディをパースして相手のIDを取得
	var req StartChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid input", http.StatusBadRequest)
		return
	}
	user2ID := req.ReceiverID

	// 🔍 すでにこの2人のチャットルームが存在するかを確認（順不同に対応）
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
		// ✅ 同じ2人のルームがなければ、新しく作成する
		tx, err := db.Begin() // トランザクション開始
		if err != nil {
			http.Error(w, "Failed to start transaction", http.StatusInternalServerError)
			return
		}

		// 🏠 chat_rooms テーブルに新しいルームを追加（is_group = false は1対1の意味）
		err = tx.QueryRow(
			`INSERT INTO chat_rooms (room_name, is_group) VALUES ($1, false) RETURNING id`,
			fmt.Sprintf("Chat %d-%d", user1ID, user2ID), // 仮のルーム名
		).Scan(&roomID)
		if err != nil {
			tx.Rollback()
			http.Error(w, "Failed to create room", http.StatusInternalServerError)
			return
		}

		// 👥 room_members テーブルに自分と相手を登録（ルームに参加）
		_, err = tx.Exec(
			`INSERT INTO room_members (room_id, user_id) VALUES ($1, $2), ($1, $3)`,
			roomID, user1ID, user2ID,
		)
		if err != nil {
			tx.Rollback()
			http.Error(w, "Failed to add members", http.StatusInternalServerError)
			return
		}

		tx.Commit() // トランザクション完了
	} else if err != nil {
		// その他のDBエラー
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}

	// 🎉 最後にルームIDをJSON形式でクライアントに返す
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(StartChatResponse{RoomID: roomID})
}
