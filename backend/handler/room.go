package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"
)

// 📦 ルーム表示用の構造体（クライアントに返す用）
// グループチャットならルーム名、1対1チャットなら相手のユーザー名を表示名にする
type RoomDisplay struct {
	RoomID          int       `json:"room_id"`           // ルームのID
	DisplayName     string    `json:"display_name"`      // 相手の名前 or グループ名
	IsGroup         bool      `json:"is_group"`          // グループかどうか
	CreatedAt       string    `json:"created_at"`        // ルーム作成日時
	LastMessageTime time.Time `json:"last_message_time"` // 最後のメッセージが送られた時間
}

// 👥 ルームメンバーの情報（ユーザー一覧用）
type RoomMember struct {
	UserID   int    `json:"user_id"`
	Username string `json:"username"`
}

// 🔄 自分が所属するルームの一覧を取得するハンドラー
// 1対1とグループチャット両方対応、表示名や最新メッセージ時間も含めて返す
func GetMyRoomsHandler(w http.ResponseWriter, r *http.Request) {
	// 🔐 JWTトークンからユーザーIDを取得（未ログインなら401）
	userIDStr, err := GetUserIDFromToken(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// 🔢 string → int に変換
	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// 📄 SQLで1対1チャットとグループチャットをまとめて取得（UNION）
	// display_name は相手のユーザー名 or グループ名に置き換える
	query := `
		-- 1対1チャット（相手の名前を表示）
		SELECT cr.id, u.username AS display_name, cr.is_group, cr.created_at, COALESCE(MAX(m.created_at), cr.created_at) AS last_message_time
		FROM room_members rm1
		JOIN chat_rooms cr ON cr.id = rm1.room_id
		JOIN room_members rm2 ON rm2.room_id = cr.id AND rm2.user_id != rm1.user_id
		JOIN users u ON u.id = rm2.user_id
		LEFT JOIN messages m ON cr.id = m.room_id
		WHERE rm1.user_id = $1 AND cr.is_group = false
		GROUP BY cr.id, u.username

		UNION

		-- グループチャット（ルーム名を表示）
		SELECT cr.id, cr.room_name AS display_name, cr.is_group, cr.created_at, COALESCE(MAX(m.created_at), cr.created_at) AS last_message_time
		FROM room_members rm
		JOIN chat_rooms cr ON cr.id = rm.room_id
		LEFT JOIN messages m ON cr.id = m.room_id
		WHERE rm.user_id = $1 AND cr.is_group = true
		GROUP BY cr.id, cr.room_name

		ORDER BY last_message_time DESC;
	`

	// 🗃️ クエリ実行（参加しているルームを取得）
	rows, err := db.Query(query, userID)
	if err != nil {
		http.Error(w, "DB error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	// 🧹 クエリ結果を構造体に詰めて配列にする
	var rooms []RoomDisplay
	for rows.Next() {
		var room RoomDisplay
		if err := rows.Scan(&room.RoomID, &room.DisplayName, &room.IsGroup, &room.CreatedAt, &room.LastMessageTime); err != nil {
			http.Error(w, "Scan error", http.StatusInternalServerError)
			return
		}
		rooms = append(rooms, room)
	}

	// 📤 結果をJSON形式で返す
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(rooms)
}

// 🧑‍🤝‍🧑 特定ルームに所属しているメンバーを取得するハンドラー
func GetRoomMembersHandler(w http.ResponseWriter, r *http.Request) {
	// 📥 URLクエリから room_id を取得（例：?room_id=3）
	roomID := r.URL.Query().Get("room_id")
	if roomID == "" {
		http.Error(w, "Missing room_id", http.StatusBadRequest)
		return
	}

	// 📄 クエリ実行：ルームに所属しているユーザーを取得
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

	// 🧹 結果を構造体に詰める
	var members []RoomMember
	for rows.Next() {
		var member RoomMember
		if err := rows.Scan(&member.UserID, &member.Username); err != nil {
			http.Error(w, "Scan error", http.StatusInternalServerError)
			return
		}
		members = append(members, member)
	}

	// 📤 結果をJSONで返す
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(members)
}
