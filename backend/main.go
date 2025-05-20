package main

import (
	"backend/handler" // ハンドラー関数（API処理）が入ってるパッケージ
	"fmt"
	"log"
	"net/http"
)

func main() {
	// データベースに接続する（PostgreSQLとつながる）
	handler.InitDB()

	// --- 各APIのルーティング設定 ---
	// それぞれのURLに対応する処理を登録していく
	// handler.WithCORS(...) でCORS対応（フロントからの通信許可）

	http.HandleFunc("/signup", handler.WithCORS(handler.SignupHandler))
	http.HandleFunc("/login", handler.WithCORS(handler.LoginHandler))
	http.HandleFunc("/users", handler.WithCORS(handler.GetUsersHandler))
	http.HandleFunc("/start_chat", handler.WithCORS(handler.StartChatHandler))
	http.HandleFunc("/delete", handler.WithCORS(handler.DeleteUserHandler))
	http.HandleFunc("/my_rooms", handler.WithCORS(handler.GetMyRoomsHandler))
	http.HandleFunc("/room_members", handler.WithCORS(handler.GetRoomMembersHandler))

	http.HandleFunc("/messages", handler.WithCORS(handler.MessagesRouter)) // メッセージ送信・取得の処理（POST/GETで分ける）

	// サーバー起動ログを表示（実行中の確認）
	fmt.Println("Server started at http://localhost:8081")

	// サーバーを8081番ポートで起動（アクセスを待つ）
	log.Fatal(http.ListenAndServe(":8081", nil))
}
