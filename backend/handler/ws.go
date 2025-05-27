package handler

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"strconv"

	"time"

	"fmt"

	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
)

// JWTの秘密鍵（本番では環境変数で管理すべき）
var jwtSecret = []byte("your-secret-key") // フロントと一致させること！

// WebSocketアップグレーダー
var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		return origin == "http://localhost:3001" // フロントのURL
	},
}

// 接続管理マップ（ルームIDごと）
var roomConnections = make(map[string][]*websocket.Conn)
var mu sync.Mutex

func WebSocketHandler(w http.ResponseWriter, r *http.Request) {
	roomID := r.URL.Query().Get("room_id")
	tokenStr := r.URL.Query().Get("token")

	if roomID == "" || tokenStr == "" {
		http.Error(w, "Missing room_id or token", http.StatusBadRequest)
		return
	}

	// JWTトークンの検証
	claims := jwt.RegisteredClaims{}
	_, err := jwt.ParseWithClaims(tokenStr, &claims, func(token *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})
	if err != nil {
		http.Error(w, "Invalid token: "+err.Error(), http.StatusUnauthorized)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("WebSocket upgrade error:", err)
		http.Error(w, "WebSocket upgrade failed", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	log.Printf("✅ WebSocket connected: room_id=%s, user_id=%s\n", roomID, claims.Subject)

	// 接続をマップに登録
	mu.Lock()
	roomConnections[roomID] = append(roomConnections[roomID], conn)
	mu.Unlock()

	// 切断時に除去
	defer func() {
		mu.Lock()
		conns := roomConnections[roomID]
		for i, c := range conns {
			if c == conn {
				roomConnections[roomID] = append(conns[:i], conns[i+1:]...)
				break
			}
		}
		mu.Unlock()
	}()

	// メッセージ読み込みループ
	for {
		var raw map[string]interface{}
		if err := conn.ReadJSON(&raw); err != nil {
			log.Println("ReadJSON error:", err)
			break
		}

		eventType, ok := raw["type"].(string)
		if !ok {
			log.Println("Invalid event format (no type)")
			continue
		}

		switch eventType {
		case "message":
			handleNewMessage(raw, conn, roomID)
		case "message_read":
			handleMessageRead(raw, roomID)
		default:
			log.Println("Unknown event type:", eventType)
		}
	}
}

// 新規メッセージ処理（保存はせず、ブロードキャストのみ）
func handleNewMessage(data map[string]interface{}, conn *websocket.Conn, roomID string) {
	log.Println("💬 handleNewMessage called")

	data["type"] = "message"

	// ログ出力（デバッグ用）
	if content, ok := data["content"].(string); ok {
		log.Println("📩 メッセージ内容:", content)
	}

	var msg MessageResponse
	b, _ := json.Marshal(data)
	json.Unmarshal(b, &msg)

	// 🆕 sender_id を正しくセット
	if senderIDFloat, ok := data["sender_id"].(float64); ok {
		msg.SenderID = int(senderIDFloat)
		log.Println("👤 sender_id is", msg.SenderID)
	} else {
		log.Println("❌ sender_id missing in data")
	}

	log.Println("📛 checking mentions in:", msg.Content)
	mentions := extractMentions(msg.Content)
	log.Println("📛 extracted mentions:", mentions)

	// メンションごとの通知処理
	for _, username := range mentions {
		var mentionedUserID int
		err := db.QueryRow("SELECT id FROM users WHERE username = $1", username).Scan(&mentionedUserID)
		if err == nil {
			log.Println("📣 found user_id:", mentionedUserID, "for username:", username)
			log.Println("👥 comparing:", mentionedUserID, "vs", msg.SenderID)

			if mentionedUserID != msg.SenderID {
				go BroadcastMentionNotification(msg.RoomID, mentionedUserID, msg.SenderID, msg.Content)
			}
		}
	}
	// ...以下省略（既存のbroadcast処理など）

	mu.Lock()
	defer mu.Unlock()

	for _, c := range roomConnections[roomID] {
		if c != conn {
			if err := c.WriteJSON(data); err != nil {
				log.Println("WriteJSON error:", err)
			}
		}
	}
}

// 既読通知処理
func handleMessageRead(data map[string]interface{}, roomID string) {
	messageIDFloat, ok1 := data["message_id"].(float64)
	userIDFloat, ok2 := data["user_id"].(float64)
	if !ok1 || !ok2 {
		log.Println("Invalid message_read payload")
		return
	}
	messageID := int(messageIDFloat)
	userID := int(userIDFloat)

	// DBに挿入（重複なら無視）
	_, err := db.Exec(`
		INSERT INTO message_reads (message_id, user_id) 
		VALUES ($1, $2) ON CONFLICT DO NOTHING
	`, messageID, userID)
	if err != nil {
		log.Println("Error inserting message_read:", err)
		return
	}

	roomInt, err := strconv.Atoi(roomID)
	if err != nil {
		log.Println("Invalid roomID:", roomID)
		return
	}

	// 全クライアントに通知
	msg := map[string]interface{}{
		"type":       "message_read",
		"message_id": messageID,
		"user_id":    userID,
		"room_id":    roomInt,
	}

	mu.Lock()
	defer mu.Unlock()
	for _, c := range roomConnections[roomID] {
		if err := c.WriteJSON(msg); err != nil {
			log.Println("WriteJSON error (message_read):", err)
		}
	}
}

func BroadcastMentionNotification(roomID int, mentionedUserID int, senderID int, content string) {
	fmt.Println("📣 mention通知実行：", mentionedUserID, "にメンションされました")
	msg := map[string]interface{}{
		"type":      "mention",
		"user_id":   mentionedUserID,
		"sender_id": senderID,
		"room_id":   roomID,
		"message":   content,
		"timestamp": time.Now().Format(time.RFC3339),
	}

	roomIDStr := strconv.Itoa(roomID)

	mu.Lock()
	defer mu.Unlock()
	for _, conn := range roomConnections[roomIDStr] {
		if err := conn.WriteJSON(msg); err != nil {
			log.Println("WriteJSON error (mention):", err)
		}
	}
}

func BroadcastToRoom(roomID int, data interface{}) {
	roomStr := strconv.Itoa(roomID)
	log.Println("📡 Broadcasting to room:", roomStr)
	mu.Lock()
	defer mu.Unlock()
	for _, conn := range roomConnections[roomStr] {
		log.Println("📨 sending to one conn")
		if err := conn.WriteJSON(data); err != nil {
			log.Println("❌ WebSocket送信失敗:", err)
		}
	}

}
