package handler

import (
	"encoding/json"
	"net/http"
)

// GetUsersHandler returns a list of all users
func GetUsersHandler(w http.ResponseWriter, r *http.Request) {
	// 🔒 JWTトークンからユーザーIDを取得（認証チェック）
	_, err := GetUserIDFromToken(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// 👍 認証OKならユーザー一覧を返す
	rows, err := db.Query(`SELECT id, username FROM users`)
	if err != nil {
		http.Error(w, "Failed to fetch users", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var users []map[string]interface{}
	for rows.Next() {
		var id int
		var username string
		if err := rows.Scan(&id, &username); err != nil {
			http.Error(w, "Failed to scan user", http.StatusInternalServerError)
			return
		}
		users = append(users, map[string]interface{}{
			"id":       id,
			"username": username,
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}
