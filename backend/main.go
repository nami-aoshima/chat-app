package main

import (
	"backend/handler" // モジュール名 + パッケージパス
	"fmt"
	"log"
	"net/http"
)

func main() {
	// データベース接続の初期化
	handler.InitDB()

	// ハンドラーの設定
	http.HandleFunc("/signup", handler.WithCORS(handler.SignupHandler))
	http.HandleFunc("/login", handler.WithCORS(handler.SignupHandler))
	http.HandleFunc("/users", handler.WithCORS(handler.SignupHandler))
	http.HandleFunc("/start_chat", handler.WithCORS(handler.SignupHandler))
	http.HandleFunc("/delete", handler.WithCORS(handler.SignupHandler))
	http.HandleFunc("/my_rooms", handler.WithCORS(handler.SignupHandler))
	http.HandleFunc("/room_members", handler.WithCORS(handler.SignupHandler))

	// ✅ POST / GET 両方対応するルーター
	http.HandleFunc("/messages", handler.WithCORS(handler.MessagesRouter))

	// サーバー起動
	fmt.Println("Server started at http://localhost:8081")
	log.Fatal(http.ListenAndServe(":8081", nil))
}
