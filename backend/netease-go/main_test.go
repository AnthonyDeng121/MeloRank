package main

import (
	"bytes"
	"context"
	"image/png"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/chaunsin/netease-cloud-music/api/weapi"
	"github.com/skip2/go-qrcode"
)

func TestClientIsolationAndLocalQR(t *testing.T) {
	first, err := newClient(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer first.Close(context.Background())
	second, err := newClient(t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer second.Close(context.Background())
	uri, _ := url.Parse("https://music.163.com/")
	first.SetCookies(uri, []*http.Cookie{{Name: "MUSIC_U", Value: "fixture", Path: "/", Domain: "music.163.com"}})
	if _, ok := second.Cookie(uri.String(), "MUSIC_U"); ok {
		t.Fatal("account cookie leaked to another QR session")
	}
	if value, ok := first.Cookie(uri.String(), "MUSIC_U"); !ok || value.Value != "fixture" {
		t.Fatal("missing first session cookie")
	}
	qr, err := weapi.New(second).QrcodeGenerate(context.Background(), &weapi.QrcodeGenerateReq{CodeKey: "fixture-qr-key", Platform: "web", Level: qrcode.Medium})
	if err != nil {
		t.Fatal(err)
	}
	picture, err := png.Decode(bytes.NewReader(qr.Qrcode))
	if err != nil {
		t.Fatal(err)
	}
	if picture.Bounds().Dx() != 256 {
		t.Fatal("unexpected QR image dimensions")
	}
}
func TestUnknownAndInvalidSession(t *testing.T) {
	for _, item := range []struct {
		body     string
		status   int
		contains string
	}{{`{"key":"missing"}`, 200, `"code":800`}, {`invalid`, 400, `"error"`}} {
		recorder := httptest.NewRecorder()
		check(recorder, httptest.NewRequest("POST", "/qr/check", strings.NewReader(item.body)))
		if recorder.Code != item.status || !strings.Contains(recorder.Body.String(), item.contains) {
			t.Fatal(recorder.Code, recorder.Body.String())
		}
	}
}
