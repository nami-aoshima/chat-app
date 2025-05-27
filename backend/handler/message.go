package handler

import (
	"encoding/json"
	"fmt"
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

	query := `SELECT id, room_id, sender_id, content, created_at 
				FROM messages WHERE room_id = $1 ORDER BY created_at ASC`

	rows, err := db.Query(query, roomID)
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
		)
		if err := rows.Scan(&msg.ID, &msg.RoomID, &msg.SenderID, &msg.Content, &createdAt); err != nil {
			http.Error(w, "Failed to parse messages", http.StatusInternalServerError)
			return
		}
		msg.CreatedAt = createdAt.Format(time.RFC3339)

		// ⭐ 空配列で初期化（←ここが重要！）
		msg.ReadBy = []int{}

		// 📥 read_by（既読ユーザーID一覧）を取得
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

// ------------------------------
// 🌐 POST / GET を切り分けるルーター
// ------------------------------
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
