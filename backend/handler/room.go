package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"
)

// クライアントに返すルーム情報（表示名付き）
type RoomDisplay struct {
	RoomID          int       `json:"room_id"`
	DisplayName     string    `json:"display_name"` // ← グループ名 or 相手の名前
	IsGroup         bool      `json:"is_group"`
	CreatedAt       string    `json:"created_at"`
	LastMessageTime time.Time `json:"last_message_time"` // ← 追加
}

// ルームに所属するユーザー（全表示用）
type RoomMember struct {
	UserID   int    `json:"user_id"`
	Username string `json:"username"`
}

// 自分が所属するルーム一覧（グループ & 1対1混合）
func GetMyRoomsHandler(w http.ResponseWriter, r *http.Request) {
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

	// 1対1・グループ両方の最新メッセージ順で並べる
	query := `
		-- 1対1チャット（相手の名前表示）
		SELECT cr.id, u.username AS display_name, cr.is_group, cr.created_at, COALESCE(MAX(m.created_at), cr.created_at) AS last_message_time
		FROM room_members rm1
		JOIN chat_rooms cr ON cr.id = rm1.room_id
		JOIN room_members rm2 ON rm2.room_id = cr.id AND rm2.user_id != rm1.user_id
		JOIN users u ON u.id = rm2.user_id
		LEFT JOIN messages m ON cr.id = m.room_id
		WHERE rm1.user_id = $1 AND cr.is_group = false
		GROUP BY cr.id, u.username

		UNION

		-- グループチャット（room_name 表示）
		SELECT cr.id, cr.room_name AS display_name, cr.is_group, cr.created_at, COALESCE(MAX(m.created_at), cr.created_at) AS last_message_time
		FROM room_members rm
		JOIN chat_rooms cr ON cr.id = rm.room_id
		LEFT JOIN messages m ON cr.id = m.room_id
		WHERE rm.user_id = $1 AND cr.is_group = true
		GROUP BY cr.id, cr.room_name

		ORDER BY last_message_time DESC;
	`

	rows, err := db.Query(query, userID)
	if err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var rooms []RoomDisplay
	for rows.Next() {
		var room RoomDisplay
		if err := rows.Scan(&room.RoomID, &room.DisplayName, &room.IsGroup, &room.CreatedAt, &room.LastMessageTime); err != nil {
			http.Error(w, "Scan error", http.StatusInternalServerError)
			return
		}
		rooms = append(rooms, room)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(rooms)
}

// ルームに所属しているユーザーを取得（個別用）
func GetRoomMembersHandler(w http.ResponseWriter, r *http.Request) {
	roomID := r.URL.Query().Get("room_id")
	if roomID == "" {
		http.Error(w, "Missing room_id", http.StatusBadRequest)
		return
	}

	query := `
		SELECT u.id, u.username
		FROM users u
		JOIN room_members rm ON u.id = rm.user_id
		WHERE rm.room_id = $1;
	`

	rows, err := db.Query(query, roomID)
	if err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var members []RoomMember
	for rows.Next() {
		var member RoomMember
		if err := rows.Scan(&member.UserID, &member.Username); err != nil {
			http.Error(w, "Scan error", http.StatusInternalServerError)
			return
		}
		members = append(members, member)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(members)
}
