package handler

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	_ "github.com/lib/pq" // PostgreSQL ドライバ
	"golang.org/x/crypto/bcrypt"
)

var db *sql.DB

// User struct for storing the user information from the request body
type User struct {
	Username     string `json:"username"`
	Email        string `json:"email"`
	Password     string `json:"password"`
	ProfileImage string `json:"profile_image"`
	ProfileMsg   string `json:"profile_message"`
}

// InitDB initializes the database connection
func InitDB() {
	var err error

	// Retrieve the environment variables for DB connection
	connStr := fmt.Sprintf("postgres://%s:%s@%s:%s/%s?sslmode=disable",
		os.Getenv("DB_USER"),     // DB_USER
		os.Getenv("DB_PASSWORD"), // DB_PASSWORD
		os.Getenv("DB_HOST"),     // DB_HOST
		os.Getenv("DB_PORT"),     // DB_PORT
		os.Getenv("DB_NAME"))     // DB_NAME

	// Initialize the DB connection
	db, err = sql.Open("postgres", connStr)
	if err != nil {
		log.Fatal("Failed to connect to the database:", err)
	}

	// Check the database connection
	if err = db.Ping(); err != nil {
		log.Fatal("Failed to ping the database:", err)
	}

	fmt.Println("Successfully connected to the database")
}

// SignupHandler handles user registration requests
func SignupHandler(w http.ResponseWriter, r *http.Request) {
	var user User
	// Decode the JSON request body into the User struct
	if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
		http.Error(w, "Invalid input", http.StatusBadRequest)
		return
	}

	// Hash the password before storing it
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "Failed to hash password", http.StatusInternalServerError)
		return
	}

	// Insert the user into the database
	query := `INSERT INTO users (username, email, password_hash, profile_image_url, profile_message) 
              VALUES ($1, $2, $3, $4, $5) RETURNING id`
	var userID int
	err = db.QueryRow(query, user.Username, user.Email, hashedPassword, user.ProfileImage, user.ProfileMsg).Scan(&userID)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error creating user: %s", err), http.StatusInternalServerError)
		return
	}

	// Return a success response with the user details
	response := map[string]interface{}{
		"id":       userID,
		"username": user.Username,
		"email":    user.Email,
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}

func DeleteUserHandler(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	if id == "" {
		http.Error(w, "Missing user ID", http.StatusBadRequest)
		return
	}
	query := `DELETE FROM users WHERE id = $1`
	res, err := db.Exec(query, id)
	if err != nil {
		http.Error(w, fmt.Sprintf("Error deleting user: %s", err), http.StatusInternalServerError)
		return
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("User deleted successfully"))
}
