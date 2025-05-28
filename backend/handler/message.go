package handler

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"
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
	ReadBy    []int  `json:"read_by"`    // 既読ユーザーのID配列
	Edited    bool   `json:"edited"`     // 👈 編集されたかどうか
	IsDeleted bool   `json:"is_deleted"` // 👈 削除されたかどうか
}

func extractMentions(content string) []string {
	words := strings.Fields(content)
	var mentions []string
	for _, word := range words {
		if strings.HasPrefix(word, "@") {
			mentions = append(mentions, strings.TrimPrefix(word, "@"))
		}
	}
	return mentions
}

// ------------------------------
// 📮 メッセージ保存処理（POST）
// ------------------------------
func SendMessageHandler(w http.ResponseWriter, r *http.Request) {
	userIDStr, err := GetUserIDFromToken(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	userID, _ := strconv.Atoi(userIDStr)

	var msg struct {
		RoomID  int    `json:"room_id"`
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&msg); err != nil {
		http.Error(w, "Invalid input", http.StatusBadRequest)
		return
	}
	fmt.Println("📩 メッセージ内容:", msg.Content)

	query := `INSERT INTO messages (room_id, sender_id, content, created_at) 
				VALUES ($1, $2, $3, NOW()) RETURNING id, created_at`

	var messageID int
	var createdAt time.Time

	err = db.QueryRow(query, msg.RoomID, userID, msg.Content).Scan(&messageID, &createdAt)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error sending message: %s", err), http.StatusInternalServerError)
		return
	}

	res := MessageResponse{
		ID:        messageID,
		RoomID:    msg.RoomID,
		SenderID:  userID, // ← tokenから取得した値！
		Content:   msg.Content,
		CreatedAt: createdAt.Format(time.RFC3339),
		ReadBy:    []int{},
	}
	// --- メンション処理（@ユーザー名 抽出） ---

	mentionRegex := regexp.MustCompile(`@(\w+)`)
	matches := mentionRegex.FindAllStringSubmatch(msg.Content, -1)

	for _, match := range matches {
		if len(match) < 2 {
			continue
		}
		username := match[1]

		// ユーザー名からユーザーID取得
		var mentionedUserID int
		err := db.QueryRow(`SELECT id FROM users WHERE username = $1`, username).Scan(&mentionedUserID)
		if err != nil {
			continue // ユーザーが見つからなければスキップ
		}

		// mentions テーブルに保存

		_, err = db.Exec(`
	INSERT INTO mentions (message_id, mention_target_id)
	VALUES ($1, $2) ON CONFLICT DO NOTHING
`, messageID, mentionedUserID)

		if err != nil {
			fmt.Println("❌ mention insert error:", err)
		}
		// WebSocket通知（自分以外）
		if mentionedUserID != userID {
			BroadcastMentionNotification(msg.RoomID, mentionedUserID, userID, msg.Content)
		}

	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}

// ------------------------------
// 📥 メッセージ取得処理（GET）
// ------------------------------
func GetMessagesHandler(w http.ResponseWriter, r *http.Request) {
	roomID := r.URL.Query().Get("room_id")
	if roomID == "" {
		http.Error(w, "Missing room_id", http.StatusBadRequest)
		return
	}

	userIDStr, err := GetUserIDFromToken(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	userID, _ := strconv.Atoi(userIDStr)

	query := `
	SELECT id, room_id, sender_id, content, created_at, edited_at, is_deleted
	FROM messages 
	WHERE room_id = $1 AND NOT ($2 = ANY(hidden_user_ids))
	ORDER BY created_at ASC`
	rows, err := db.Query(query, roomID, userID)

	if err != nil {
		http.Error(w, "Failed to fetch messages", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var messages []MessageResponse
	for rows.Next() {
		var (
			msg       MessageResponse
			createdAt time.Time
			editedAt  *time.Time
		)

		// ここで edited_at と is_deleted も含めてスキャン
		if err := rows.Scan(&msg.ID, &msg.RoomID, &msg.SenderID, &msg.Content, &createdAt, &editedAt, &msg.IsDeleted); err != nil {
			http.Error(w, "Failed to parse messages", http.StatusInternalServerError)
			return
		}
		msg.CreatedAt = createdAt.Format(time.RFC3339)
		msg.Edited = (editedAt != nil) // 編集されたかどうかの判定

		msg.ReadBy = []int{}

		// 既読ユーザーID一覧の取得
		readQuery := `SELECT user_id FROM message_reads WHERE message_id = $1`
		readRows, err := db.Query(readQuery, msg.ID)
		if err != nil {
			http.Error(w, "Failed to fetch read_by", http.StatusInternalServerError)
			return
		}
		defer readRows.Close()

		for readRows.Next() {
			var uid int
			if err := readRows.Scan(&uid); err == nil {
				msg.ReadBy = append(msg.ReadBy, uid)
			}
		}

		messages = append(messages, msg)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(messages)
}

// ← 今これがないので、新しく作ろう！
func MessagesRouter(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		SendMessageHandler(w, r)
	case http.MethodGet:
		GetMessagesHandler(w, r)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

// ------------------------------
// 🌐 POST / GET を切り分けるルーター
// ------------------------------
func MessagesByIDRouter(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/messages/")

	switch r.Method {
	case http.MethodPut:
		EditMessageHandler(w, r, idStr)
	case http.MethodDelete:
		DeleteMessageHandler(w, r, idStr)
	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func EditMessageHandler(w http.ResponseWriter, r *http.Request, messageIDStr string) {
	userIDStr, err := GetUserIDFromToken(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	userID, _ := strconv.Atoi(userIDStr)

	messageID, err := strconv.Atoi(messageIDStr)
	if err != nil {
		http.Error(w, "Invalid message ID", http.StatusBadRequest)
		return
	}

	var input struct {
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		http.Error(w, "Invalid input", http.StatusBadRequest)
		return
	}

	query := `
		UPDATE messages 
		SET content = $1, edited_at = NOW()
		WHERE id = $2 AND sender_id = $3
	`
	_, err = db.Exec(query, input.Content, messageID, userID)
	if err != nil {
		http.Error(w, "Failed to update message", http.StatusInternalServerError)
		return
	}

	// メッセージ編集が成功したあと、WebSocketで全クライアントに通知

	// 編集されたメッセージ情報を再取得
	var updatedMsg MessageResponse
	var createdAt time.Time
	var editedAt *time.Time
	var isDeleted bool
	var roomID int
	err = db.QueryRow(`SELECT room_id, sender_id, content, created_at, edited_at, is_deleted FROM messages WHERE id = $1`, messageID).
		Scan(&roomID, &updatedMsg.SenderID, &updatedMsg.Content, &createdAt, &editedAt, &isDeleted)
	if err != nil {
		log.Println("❌ メッセージ取得失敗:", err)
	} else {
		updatedMsg.ID = messageID
		updatedMsg.RoomID = roomID
		updatedMsg.CreatedAt = createdAt.Format(time.RFC3339)
		updatedMsg.Edited = editedAt != nil
		updatedMsg.IsDeleted = isDeleted
		updatedMsg.ReadBy = []int{} // クライアントで保持しているので空でOK

		BroadcastToRoom(roomID, map[string]interface{}{
			"type":    "edit_message",
			"message": updatedMsg,
		})
	}
	log.Println("🔊 Broadcasting edited message to room:", roomID)

	w.WriteHeader(http.StatusOK)

}

func DeleteMessageHandler(w http.ResponseWriter, r *http.Request, messageIDStr string) {
	userIDStr, err := GetUserIDFromToken(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	userID, _ := strconv.Atoi(userIDStr)

	messageID, err := strconv.Atoi(messageIDStr)
	if err != nil {
		http.Error(w, "Invalid message ID", http.StatusBadRequest)
		return
	}

	query := `
		UPDATE messages 
		SET is_deleted = TRUE
		WHERE id = $1 AND sender_id = $2
	`
	_, err = db.Exec(query, messageID, userID)
	if err != nil {
		http.Error(w, "Failed to delete message", http.StatusInternalServerError)
		return
	}
	// 削除対象のメッセージのroom_idを取得
	var roomID int
	err = db.QueryRow(`SELECT room_id FROM messages WHERE id = $1`, messageID).Scan(&roomID)
	if err == nil {
		BroadcastToRoom(roomID, map[string]interface{}{
			"type":       "delete_message",
			"message_id": messageID,
		})
	}

	w.WriteHeader(http.StatusOK)
}

// 🚨 新しく追加するエンドポイント
// POST /messages/{id}/hide
func HideMessageForUser(w http.ResponseWriter, r *http.Request) {
	// JWTからuserIDを取得
	userIDStr, err := GetUserIDFromToken(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	userID, _ := strconv.Atoi(userIDStr)

	// メッセージIDをURLから取得
	messageIDStr := strings.TrimPrefix(r.URL.Path, "/messages/")
	messageIDStr = strings.TrimSuffix(messageIDStr, "/hide")
	messageID, err := strconv.Atoi(messageIDStr)
	if err != nil {
		http.Error(w, "Invalid message ID", http.StatusBadRequest)
		return
	}

	// hidden_user_ids に userID を追加（重複しないように）
	_, err = db.Exec(`
		UPDATE messages 
		SET hidden_user_ids = array_append(hidden_user_ids, $1)
		WHERE id = $2 AND NOT ($1 = ANY(hidden_user_ids))
	`, userID, messageID)
	if err != nil {
		http.Error(w, "Failed to hide message", http.StatusInternalServerError)
		return
	}

	// WebSocketで通知（必要に応じて）
	var roomID int
	err = db.QueryRow(`SELECT room_id FROM messages WHERE id = $1`, messageID).Scan(&roomID)
	if err == nil {
		BroadcastToRoom(roomID, map[string]interface{}{
			"type":       "hide_message",
			"message_id": messageID,
			"user_id":    userID,
		})
	}

	w.WriteHeader(http.StatusNoContent)
}
