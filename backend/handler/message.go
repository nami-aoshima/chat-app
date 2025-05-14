package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type Message struct {
	RoomID   int    `json:"room_id"`
	SenderID int    `json:"sender_id"`
	Content  string `json:"content"`
}

type MessageResponse struct {
	ID        int       `json:"id"`
	RoomID    int       `json:"room_id"`
	SenderID  int       `json:"sender_id"`
	Content   string    `json:"content"`
	CreatedAt time.Time `json:"created_at"`
}

// ------------------------------
// メッセージ保存処理（POST）
// ------------------------------
func SendMessageHandler(w http.ResponseWriter, r *http.Request) {
	var msg Message
	if err := json.NewDecoder(r.Body).Decode(&msg); err != nil {
		http.Error(w, "Invalid input", http.StatusBadRequest)
		return
	}

	query := `INSERT INTO messages (room_id, sender_id, content, created_at) 
	          VALUES ($1, $2, $3, NOW()) RETURNING id, created_at`

	var messageID int
	var createdAt time.Time
	err := db.QueryRow(query, msg.RoomID, msg.SenderID, msg.Content).Scan(&messageID, &createdAt)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error sending message: %s", err), http.StatusInternalServerError)
		return
	}

	res := MessageResponse{
		ID:        messageID,
		RoomID:    msg.RoomID,
		SenderID:  msg.SenderID,
		Content:   msg.Content,
		CreatedAt: createdAt,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}

// ------------------------------
// メッセージ取得処理（GET）
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
		var msg MessageResponse
		if err := rows.Scan(&msg.ID, &msg.RoomID, &msg.SenderID, &msg.Content, &msg.CreatedAt); err != nil {
			http.Error(w, "Failed to parse messages", http.StatusInternalServerError)
			return
		}
		messages = append(messages, msg)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(messages)
}

// ------------------------------
// POST / GET を切り分けるルーター
// ------------------------------
func MessagesRouter(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodPost {
		SendMessageHandler(w, r)
	} else if r.Method == http.MethodGet {
		GetMessagesHandler(w, r)
	} else {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}
