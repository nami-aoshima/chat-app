package main

import (
	"backend/handler"
	"fmt"
	"log"
	"net/http"
)

func main() {
	handler.InitDB()

	// ✅ 正しく割り当て直し！
	http.HandleFunc("/signup", handler.WithCORS(handler.SignupHandler))
	http.HandleFunc("/login", handler.WithCORS(handler.LoginHandler)) // ←修正！
	http.HandleFunc("/users", handler.WithCORS(handler.GetUsersHandler))
	http.HandleFunc("/start_chat", handler.WithCORS(handler.StartChatHandler))
	http.HandleFunc("/delete", handler.WithCORS(handler.DeleteUserHandler))
	http.HandleFunc("/my_rooms", handler.WithCORS(handler.GetMyRoomsHandler))
	http.HandleFunc("/room_members", handler.WithCORS(handler.GetRoomMembersHandler))

	http.HandleFunc("/messages", handler.WithCORS(handler.MessagesRouter))

	fmt.Println("Server started at http://localhost:8081")
	log.Fatal(http.ListenAndServe(":8081", nil))
}
