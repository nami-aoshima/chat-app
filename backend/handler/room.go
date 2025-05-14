package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
)

type RoomInfo struct {
	RoomID    int    `json:"room_id"`
	RoomName  string `json:"room_name"`
	IsGroup   bool   `json:"is_group"`
	CreatedAt string `json:"created_at"`
}

type RoomMember struct {
	UserID   int    `json:"user_id"`
	Username string `json:"username"`
}

// 自分が所属するルーム一覧を取得
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

	query := `
        SELECT cr.id, cr.room_name, cr.is_group, cr.created_at
        FROM chat_rooms cr
        JOIN room_members rm ON cr.id = rm.room_id
        WHERE rm.user_id = $1
        ORDER BY cr.created_at DESC;
    `

	rows, err := db.Query(query, userID)
	if err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var rooms []RoomInfo
	for rows.Next() {
		var room RoomInfo
		if err := rows.Scan(&room.RoomID, &room.RoomName, &room.IsGroup, &room.CreatedAt); err != nil {
			http.Error(w, "Scan error", http.StatusInternalServerError)
			return
		}
		rooms = append(rooms, room)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(rooms)
}

// ルームに所属しているユーザーを取得
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
