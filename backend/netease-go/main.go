package main

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/chaunsin/netease-cloud-music/api"
	"github.com/chaunsin/netease-cloud-music/api/weapi"
	"github.com/chaunsin/netease-cloud-music/pkg/cookie"
	ncmlog "github.com/chaunsin/netease-cloud-music/pkg/log"
	"github.com/skip2/go-qrcode"
	"gopkg.in/natefinch/lumberjack.v2"
)

// Each QR owns an isolated client and cookie jar; no account state is shared.
type loginSession struct {
	mu             sync.Mutex
	client         *api.Client
	key, directory string
	expires        time.Time
}

var sessions = struct {
	sync.Mutex
	items    map[string]*loginSession
	creating int
}{items: map[string]*loginSession{}}

var quietLog = ncmlog.New(&ncmlog.Config{Level: "error", Stdout: false, Rotate: lumberjack.Logger{Filename: os.DevNull}})

func newClient(directory string) (*api.Client, error) {
	return api.NewClient(&api.Config{Timeout: 12 * time.Second, Retry: 0, HomeDir: directory, Cookie: cookie.Config{Filepath: filepath.Join(directory, "cookies.json"), Interval: 0}}, quietLog)
}

func respond(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
func fail(w http.ResponseWriter, message string) { respond(w, 502, map[string]any{"error": message}) }
func (s *loginSession) close() {
	_ = s.client.Close(context.Background())
	_ = os.RemoveAll(s.directory) // Unique directory created by os.MkdirTemp, never a user path.
}
func create(w http.ResponseWriter, r *http.Request) {
	sessions.Lock()
	if len(sessions.items)+sessions.creating >= 32 {
		sessions.Unlock()
		respond(w, 429, map[string]any{"error": "待扫码会话过多，请稍后再试"})
		return
	}
	sessions.creating++
	sessions.Unlock()
	defer func() { sessions.Lock(); sessions.creating--; sessions.Unlock() }()
	directory, err := os.MkdirTemp("", "melorank-go-login-")
	if err != nil {
		fail(w, "无法创建临时登录会话")
		return
	}
	client, err := newClient(directory)
	if err != nil {
		_ = os.RemoveAll(directory)
		fail(w, "Go 客户端初始化失败")
		return
	}
	s := &loginSession{client: client, directory: directory, expires: time.Now().Add(3 * time.Minute)}
	success := false
	defer func() {
		if !success {
			s.close()
		}
	}()
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	engine := weapi.New(client)
	key, err := engine.QrcodeCreateKey(ctx, &weapi.QrcodeCreateKeyReq{Type: 1})
	if err != nil || key.UniKey == "" {
		fail(w, "Go 网易云 Web 接口未能生成二维码，请稍后重试")
		return
	}
	qr, err := engine.QrcodeGenerate(ctx, &weapi.QrcodeGenerateReq{CodeKey: key.UniKey, Platform: "web", Level: qrcode.Medium})
	if err != nil {
		fail(w, "Go 二维码生成失败")
		return
	}
	token := make([]byte, 32)
	if _, err = rand.Read(token); err != nil {
		fail(w, "无法创建登录会话标识")
		return
	}
	id := hex.EncodeToString(token)
	s.key = key.UniKey
	sessions.Lock()
	sessions.items[id] = s
	sessions.Unlock()
	success = true
	respond(w, 200, map[string]any{"key": id, "image": "data:image/png;base64," + base64.StdEncoding.EncodeToString(qr.Qrcode)})
}
func check(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Key string `json:"key"`
	}
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024)).Decode(&body) != nil {
		respond(w, 400, map[string]any{"error": "无效的扫码会话"})
		return
	}
	sessions.Lock()
	s := sessions.items[body.Key]
	sessions.Unlock()
	if s == nil {
		respond(w, 200, map[string]any{"code": 800})
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if time.Now().After(s.expires) {
		respond(w, 200, map[string]any{"code": 800})
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	result, err := weapi.New(s.client).QrcodeCheck(ctx, &weapi.QrcodeCheckReq{Key: s.key, Type: 1})
	if err != nil {
		fail(w, "Go 扫码状态检查失败，请尝试官网登录")
		return
	}
	response := map[string]any{"code": result.Code}
	if result.Code == 803 {
		values := []string{}
		for _, name := range []string{"MUSIC_U", "__csrf", "NMTID", "MUSIC_A"} {
			if ck, ok := s.client.Cookie("https://music.163.com/", name); ok && ck.Value != "" {
				values = append(values, name+"="+ck.Value)
			}
		}
		if !strings.Contains(strings.Join(values, ";"), "MUSIC_U=") {
			fail(w, "扫码确认后未获得网易云登录凭证")
			return
		}
		response["cookie"] = strings.Join(values, "; ") + ";"
		// Retain briefly so a lost HTTP response can be retried, then remove all local state.
		s.expires = time.Now().Add(15 * time.Second)
	}
	respond(w, 200, response)
}
func main() {
	ncmlog.SetDefault(quietLog)
	go func() {
		for range time.Tick(15 * time.Second) {
			sessions.Lock()
			for id, s := range sessions.items {
				s.mu.Lock()
				if time.Now().After(s.expires) {
					delete(sessions.items, id)
					s.close()
				}
				s.mu.Unlock()
			}
			sessions.Unlock()
		}
	}()
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		respond(w, 200, map[string]any{"engine": "chaunsin/netease-cloud-music", "protocol": "weapi", "type": 1})
	})
	mux.HandleFunc("POST /qr", create)
	mux.HandleFunc("POST /qr/check", check)
	fmt.Println("MeloRank Go QR service: http://127.0.0.1:5001")
	server := &http.Server{Addr: "127.0.0.1:5001", Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	stopped := make(chan os.Signal, 1)
	signal.Notify(stopped, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-stopped
		ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
		defer cancel()
		_ = server.Shutdown(ctx)
	}()
	failed := false
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		fmt.Fprintln(os.Stderr, "Go QR service stopped:", err)
		failed = true
	}
	sessions.Lock()
	for id, s := range sessions.items {
		s.mu.Lock()
		s.close()
		s.mu.Unlock()
		delete(sessions.items, id)
	}
	sessions.Unlock()
	if failed {
		os.Exit(1)
	}
}
