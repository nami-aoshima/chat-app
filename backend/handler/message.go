package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// 📦 クライアントから受け取るメッセージ構造体（POST時）
type Message struct {
	RoomID   int    `json:"room_id"`   // 送信先ルームID
	SenderID int    `json:"sender_id"` // 送信者ユーザーID
	Content  string `json:"content"`   // メッセージ内容
}

// 📤 クライアントに返すメッセージ構造体（GET・POSTのレスポンス）
type MessageResponse struct {
	ID        int    `json:"id"`         // メッセージID（DBの自動採番）
	RoomID    int    `json:"room_id"`    // ルームID
	SenderID  int    `json:"sender_id"`  // 送信者ID
	Content   string `json:"content"`    // メッセージ本文
	CreatedAt string `json:"created_at"` // 作成日時
}

// ------------------------------
// 📮 メッセージ保存処理（POST）
// ------------------------------
func SendMessageHandler(w http.ResponseWriter, r *http.Request) {
	// ① リクエストボディのJSONを Message 構造体に変換
	var msg Message
	if err := json.NewDecoder(r.Body).Decode(&msg); err != nil {
		http.Error(w, "Invalid input", http.StatusBadRequest)
		return
	}

	// ② messagesテーブルにINSERT（現在時刻を created_at に設定）
	query := `INSERT INTO messages (room_id, sender_id, content, created_at) 
				VALUES ($1, $2, $3, NOW()) RETURNING id, created_at`

	var messageID int
	var createdAt time.Time

	// ③ 登録と同時に id, 作成時刻を取得
	err := db.QueryRow(query, msg.RoomID, msg.SenderID, msg.Content).Scan(&messageID, &createdAt)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error sending message: %s", err), http.StatusInternalServerError)
		return
	}

	// ④ クライアントにレスポンスとして返すJSONを構築
	res := MessageResponse{
		ID:        messageID,
		RoomID:    msg.RoomID,
		SenderID:  msg.SenderID,
		Content:   msg.Content,
		CreatedAt: createdAt.Format(time.RFC3339),
	}

	// ⑤ JSONとしてレスポンス返却
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}

// ------------------------------
// 📥 メッセージ取得処理（GET）
// ------------------------------
func GetMessagesHandler(w http.ResponseWriter, r *http.Request) {
	// ① クエリパラメータから room_id を取得（例：?room_id=3）
	roomID := r.URL.Query().Get("room_id")
	if roomID == "" {
		http.Error(w, "Missing room_id", http.StatusBadRequest)
		return
	}

	// ② 指定された room_id のメッセージを取得（古い順）
	query := `SELECT id, room_id, sender_id, content, created_at 
				FROM messages WHERE room_id = $1 ORDER BY created_at ASC`

	rows, err := db.Query(query, roomID)
	if err != nil {
		http.Error(w, "Failed to fetch messages", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	// ③ 1件ずつ構造体に読み取り → スライスに追加
	var messages []MessageResponse
	for rows.Next() {
		var (
			msg       MessageResponse
			createdAt time.Time
		)
		if err := rows.Scan(&msg.ID, &msg.RoomID, &msg.SenderID, &msg.Content, &createdAt); err != nil {
			http.Error(w, "Failed to parse messages", http.StatusInternalServerError)
			return
		}
		msg.CreatedAt = createdAt.Format(time.RFC3339)
		messages = append(messages, msg)
	}

	// ④ JSON形式でレスポンスを返す
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(messages)
}

// ------------------------------
// 🌐 POST / GET を切り分けるルーター
// ------------------------------
func MessagesRouter(w http.ResponseWriter, r *http.Request) {
	// POST（送信）なら送信処理へ
	if r.Method == http.MethodPost {
		SendMessageHandler(w, r)
		// GET（取得）なら取得処理へ
	} else if r.Method == http.MethodGet {
		GetMessagesHandler(w, r)
		// それ以外は405エラー
	} else {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}
