package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
)

// 最小限のユーザー情報を表す構造体
type UserSimple struct {
	ID       int    `json:"id"`
	Username string `json:"username"`
}

func GetUsersHandler(w http.ResponseWriter, r *http.Request) {
	// 認証チェック（JWT）
	userIDStr, err := GetUserIDFromToken(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	// 自分以外のユーザーを取得
	rows, err := db.Query(`SELECT id, username FROM users WHERE id != $1 ORDER BY username ASC`, userID)
	if err != nil {
		http.Error(w, "Failed to fetch users", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var users []UserSimple
	for rows.Next() {
		var user UserSimple
		if err := rows.Scan(&user.ID, &user.Username); err != nil {
			http.Error(w, "Failed to scan user", http.StatusInternalServerError)
			return
		}
		users = append(users, user)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}
