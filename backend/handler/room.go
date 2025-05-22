package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"
)

type RoomDisplay struct {
	RoomID          int       `json:"room_id"`
	DisplayName     string    `json:"display_name"`
	IsGroup         bool      `json:"is_group"`
	CreatedAt       string    `json:"created_at"`
	LastMessageTime time.Time `json:"last_message_time"`
}

type RoomMember struct {
	UserID   int    `json:"user_id"`
	Username string `json:"username"`
}

type CreateGroupRequest struct {
	GroupName string `json:"group_name"` // ← ここが正しい
	MemberIDs []int  `json:"member_ids"`
}

// ルーム一覧取得
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
		-- 1対1チャット
SELECT
  cr.id,
  u.username AS display_name,
  cr.is_group,
  cr.created_at,
  COALESCE(MAX(m.created_at), cr.created_at) AS last_message_time
FROM room_members rm1
JOIN chat_rooms cr ON cr.id = rm1.room_id
JOIN room_members rm2 ON rm2.room_id = cr.id AND rm2.user_id != rm1.user_id
JOIN users u ON u.id = rm2.user_id
LEFT JOIN messages m ON cr.id = m.room_id
WHERE rm1.user_id = $1 AND cr.is_group = false
GROUP BY cr.id, u.username, cr.is_group, cr.created_at

UNION

-- グループチャット（メンバー数つき表示名）
SELECT
  cr.id,
  cr.room_name || ' (' || COALESCE(member_counts.count, 1) || ')' AS display_name,
  cr.is_group,
  cr.created_at,
  COALESCE(MAX(m.created_at), cr.created_at) AS last_message_time
FROM room_members rm
JOIN chat_rooms cr ON cr.id = rm.room_id
LEFT JOIN messages m ON cr.id = m.room_id
LEFT JOIN (
  SELECT room_id, COUNT(*) AS count
  FROM room_members
  GROUP BY room_id
) AS member_counts ON cr.id = member_counts.room_id
WHERE rm.user_id = $1 AND cr.is_group = true
GROUP BY cr.id, cr.room_name, cr.is_group, cr.created_at, member_counts.count

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

// ルームのメンバー一覧
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

// グループ作成
func CreateGroupHandler(w http.ResponseWriter, r *http.Request) {
	userIDStr, err := GetUserIDFromToken(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	userID, _ := strconv.Atoi(userIDStr)

	var req CreateGroupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	query := `INSERT INTO chat_rooms (room_name, is_group, created_at) VALUES ($1, true, NOW()) RETURNING id`
	var roomID int
	if err := db.QueryRow(query, req.GroupName).Scan(&roomID); err != nil {
		http.Error(w, "Failed to create room", http.StatusInternalServerError)
		return
	}

	memberIDs := append(req.MemberIDs, userID)
	for _, memberID := range memberIDs {
		_, err := db.Exec("INSERT INTO room_members (room_id, user_id) VALUES ($1, $2)", roomID, memberID)
		if err != nil {
			http.Error(w, "Failed to add members", http.StatusInternalServerError)
			return
		}
	}

	// ✅ 成功レスポンスに display_name を含める（group名）
	res := map[string]interface{}{
		"message":      "グループ作成完了",
		"room_id":      roomID,
		"display_name": req.GroupName,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}
