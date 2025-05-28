package main

import (
	"backend/handler" // ハンドラーパッケージ
	"fmt"
	"log"
	"net/http"
	"strings"
)

func main() {
	// PostgreSQL接続
	handler.InitDB()

	// --- 静的ファイル（画像アップロード） ---
	http.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir("public/uploads"))))

	// --- 認証・ユーザー関連 ---
	http.HandleFunc("/signup", handler.WithCORS(handler.SignupHandler))
	http.HandleFunc("/login", handler.WithCORS(handler.LoginHandler))
	http.HandleFunc("/users", handler.WithCORS(handler.GetUsersHandler))
	http.HandleFunc("/delete", handler.WithCORS(handler.DeleteUserHandler))
	http.HandleFunc("/api/profile", handler.WithCORS(handler.UpdateProfileHandler))

	// --- チャットルーム関連 ---
	http.HandleFunc("/start_chat", handler.WithCORS(handler.StartChatHandler))
	http.HandleFunc("/create_group", handler.WithCORS(handler.CreateGroupHandler))
	http.HandleFunc("/my_rooms", handler.WithCORS(handler.GetMyRoomsHandler))
	http.HandleFunc("/room_members", handler.WithCORS(handler.GetRoomMembersHandler))

	// --- メッセージ関連 ---
	http.HandleFunc("/messages", handler.WithCORS(handler.MessagesRouter))
	http.HandleFunc("/messages/", handler.WithCORS(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasSuffix(r.URL.Path, "/hide") {
			handler.HideMessageForUser(w, r)
		} else {
			handler.MessagesByIDRouter(w, r)
		}
	}))

	// --- その他 ---
	http.HandleFunc("/upload", handler.WithCORS(handler.UploadImageHandler))
	http.HandleFunc("/ws", handler.WebSocketHandler) // WebSocketはCORS不要
	// --- チャットルーム関連 ---
	http.HandleFunc("/delete_room", handler.WithCORS(handler.DeleteRoomHandler))

	// サーバーログ表示
	fmt.Println("Server started at http://localhost:8081")

	// サーバー起動
	log.Fatal(http.ListenAndServe(":8081", nil))
}
