package handler

import (
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
)

// JWTの秘密鍵（本番では環境変数などで管理）
var jwtSecret = []byte("your-secret-key") // フロントと一致させること！

// WebSocketアップグレーダー
var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		origin := r.Header.Get("Origin")
		// React側のポートを許可
		return origin == "http://localhost:3001"
	},
}

// ルームごとの接続管理（roomID -> []*websocket.Conn）
var roomConnections = make(map[string][]*websocket.Conn)
var mu sync.Mutex

func WebSocketHandler(w http.ResponseWriter, r *http.Request) {
	roomID := r.URL.Query().Get("room_id")
	tokenStr := r.URL.Query().Get("token")

	if roomID == "" || tokenStr == "" {
		http.Error(w, "Missing room_id or token", http.StatusBadRequest)
		return
	}

	// トークン検証
	claims := jwt.RegisteredClaims{}
	_, err := jwt.ParseWithClaims(tokenStr, &claims, func(token *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})
	if err != nil {
		http.Error(w, "Invalid token: "+err.Error(), http.StatusUnauthorized)
		return
	}

	// WebSocketアップグレード
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("WebSocket upgrade error:", err)
		http.Error(w, "WebSocket upgrade failed", http.StatusInternalServerError)
		return
	}
	defer conn.Close()

	log.Printf("✅ WebSocket connected: room_id=%s, user_id=%s\n", roomID, claims.Subject)

	// ルームに接続を登録
	mu.Lock()
	roomConnections[roomID] = append(roomConnections[roomID], conn)
	mu.Unlock()

	// 切断時に除外
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

	for {
		var msg Message
		if err := conn.ReadJSON(&msg); err != nil {
			log.Println("ReadJSON error:", err)
			break
		}

		// DBにメッセージ保存（created_at取得付き）
		query := `INSERT INTO messages (room_id, sender_id, content, created_at)
		          VALUES ($1, $2, $3, NOW()) RETURNING id, created_at`
		var id int
		var createdAt time.Time
		if err := db.QueryRow(query, msg.RoomID, msg.SenderID, msg.Content).Scan(&id, &createdAt); err != nil {
			log.Println("DB insert error:", err)
			continue
		}

		// 送信用レスポンス構造体に変換
		res := MessageResponse{
			ID:        id,
			RoomID:    msg.RoomID,
			SenderID:  msg.SenderID,
			Content:   msg.Content,
			CreatedAt: createdAt.Format(time.RFC3339),
		}

		// 他のクライアントに送信
		mu.Lock()
		for _, c := range roomConnections[roomID] {
			if c != conn {
				if err := c.WriteJSON(res); err != nil {
					log.Println("WriteJSON error:", err)
				}
			}
		}
		mu.Unlock()
	}
}
