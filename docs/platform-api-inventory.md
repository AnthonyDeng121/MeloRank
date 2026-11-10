# Platform API inventory

Generated from this checkout on 2026-11-10. This inventory lists available modules and routes, not proof of live account acceptance.

## QQ service: 40 mounted routes

| Method | Route |
| --- | --- |
| GET | `/user/library` |
| POST | `/user/playlist/edit` |
| POST | `/user/logout` |
| GET | `/user/getCookie` |
| GET | `/user/setCookie` |
| GET | `/user/account` |
| GET | `/downloadQQMusic` |
| GET | `/getHotkey` |
| GET | `/getSearchByKey/:key?/:limit?/:page?/:catZhida?` |
| GET | `/getSmartbox/:key?` |
| GET | `/getSongListCategories` |
| GET | `/getSongLists/:page?/:limit?/:categoryId?/:sortId?` |
| POST | `/batchGetSongLists` |
| GET | `/getSongInfo/:songmid?/:songid?` |
| POST | `/batchGetSongInfo` |
| GET | `/getSongListDetail/:disstid?` |
| GET | `/getNewDisks/:page?/:limit?` |
| GET | `/getMvByTag` |
| GET | `/getMv/:area_id?/:version_id?/:limit?/:page?` |
| GET | `/getSingerList/:area?/:sex?/:genre?/:index?/:page?` |
| GET | `/getSimilarSinger/:singermid?` |
| GET | `/getSingerAlbum/:singermid?/:limit?/:page?` |
| GET | `/getSingerHotsong/:singermid?/:limit?/:page?` |
| GET | `/getSingerMv/:singermid?/:limit?/:order?` |
| GET | `/getSingerDesc/:singermid?` |
| GET | `/getSingerStarNum/:singermid?` |
| GET | `/getRadioLists` |
| GET | `/getDigitalAlbumLists` |
| GET | `/getLyric/:songmid?/:isFormat?` |
| GET | `/getMusicPlay/:songmid?` |
| GET | `/getAlbumInfo/:albummid?` |
| GET | `/getComments/:id?/:rootcommentid?/:cid?/:pagesize?/:pagenum?/:cmd?/:reqtype?/:biztype?` |
| GET | `/getRecommend` |
| GET | `/getMvPlay/:vid?` |
| GET | `/getTopLists` |
| GET | `/getRanks/:topId?/:limit?/:page?` |
| GET | `/getTicketInfo` |
| GET | `/getImageUrl` |
| GET | `/user/getQQLoginQr` |
| POST | `/user/checkQQLoginQr` |

## NetEase backend: 12 mounted POST routes

All paths below use `/api/music/netease` as prefix.

- `POST /suggestions`
- `POST /search`
- `POST /album-search`
- `POST /playback`
- `POST /lyric`
- `POST /account`
- `POST /logout`
- `POST /collection`
- `POST /library`
- `POST /go/qr`
- `POST /go/qr/check`
- `POST /playlist/edit`

## NetEase Go QR service: 3 routes

The standalone Go service listens on port 5001 and is called by the Node backend.

| Method | Route |
| --- | --- |
| GET | `/health` |
| POST | `/qr` |
| POST | `/qr/check` |

## NetEase SDK: 449 modules

The installed SDK version is 4.41.1. Most modules are not mounted as MeloRank routes. `scrobble` exists in the SDK but is not wired to website playback.

```text
activate_init_profile
ad_get
ad_listening_rights
ad_listening_rights_gain
aidj_content_rcmd
album
album_detail
album_detail_dynamic
album_list
album_list_style
album_new
album_newest
album_privilege
album_songsaleboard
album_sub
album_sublist
api
artist_album
artist_desc
artist_detail
artist_detail_dynamic
artist_fans
artist_follow_count
artist_list
artist_mv
artist_new_mv
artist_new_song
artist_new_song_mv_list_v2
artist_new_song_playall
artist_songs
artist_sub
artist_sublist
artist_top_song
artist_video
artists
audio_match
avatar_upload
banner
batch
broadcast_category_region_get
broadcast_channel_collect_list
broadcast_channel_currentinfo
broadcast_channel_list
broadcast_sub
calendar
captcha_safe_sent
captcha_sent
captcha_sent_v1
captcha_verify
cellphone_existence_check
chart_detail
chart_song_detail
check_music
cloud
cloud_import
cloud_lyric_get
cloud_match
cloud_upload_complete
cloud_upload_token
cloudsearch
comment
comment_add
comment_album
comment_delete
comment_dj
comment_event
comment_floor
comment_hot
comment_hug_list
comment_info_list
comment_like
comment_music
comment_mv
comment_new
comment_playlist
comment_reply
comment_report
comment_video
countries_code_list
creator_authinfo_get
daily_signin
decrypt
device_kickoff
device_list
deviceinfo_center_upload
digitalAlbum_detail
digitalAlbum_ordering
digitalAlbum_purchased
digitalAlbum_sales
djRadio_top
dj_banner
dj_category_excludehot
dj_category_recommend
dj_catelist
dj_detail
dj_difm_all_style_channel
dj_difm_channel_subscribe
dj_difm_channel_unsubscribe
dj_difm_playing_tracks_list
dj_difm_subscribe_channels_get
dj_hot
dj_paygift
dj_personalize_recommend
dj_program
dj_program_detail
dj_program_toplist
dj_program_toplist_hours
dj_radio_hot
dj_recommend
dj_recommend_type
dj_sub
dj_sublist
dj_subscriber
dj_today_perfered
dj_toplist
dj_toplist_hours
dj_toplist_newcomer
dj_toplist_pay
dj_toplist_popular
eapi_decrypt
event
event_del
event_forward
event_privacy
fans_group_detail
fans_group_feed_recommend
fans_group_user_group_detail
fans_group_user_groups
fanscenter_basicinfo_age_get
fanscenter_basicinfo_gender_get
fanscenter_basicinfo_province_get
fanscenter_overview_get
fanscenter_trend_list
fm_trash
follow
get_userids
history_recommend_songs
history_recommend_songs_detail
homepage_block_page
homepage_dragon_ball
hot_topic
hug_comment
inner_version
lbs_city_code
like
like_v1
likelist
listen_data_realtime_report
listen_data_report
listen_data_song_play_rank
listen_data_today_song
listen_data_total
listen_data_year_report
listentogether_accept
listentogether_end
listentogether_heatbeat
listentogether_play_command
listentogether_room_check
listentogether_room_create
listentogether_status
listentogether_sync_list_command
listentogether_sync_playlist_get
login
login_cellphone
login_qr_check
login_qr_create
login_qr_key
login_refresh
login_status
logout
lyric
lyric_new
middle_play_do_lottery
middle_play_lottery_remain_chance
mlog_music_rcmd
mlog_to_video
mlog_url
msg_comments
msg_forwards
msg_notices
msg_private
msg_private_history
msg_recentcontact
music_first_listen_info
musician_cloudbean
musician_cloudbean_obtain
musician_data_overview
musician_play_trend
musician_sign
musician_tasks
musician_tasks_new
musician_vip_tasks
mv_all
mv_detail
mv_detail_info
mv_exclusive_rcmd
mv_first
mv_sub
mv_sublist
mv_url
nickname_check
personal_fm
personal_fm_mode
personalized
personalized_djprogram
personalized_mv
personalized_newsong
personalized_privatecontent
personalized_privatecontent_list
pl_count
playlist_category_list
playlist_catlist
playlist_cover_update
playlist_create
playlist_delete
playlist_desc_update
playlist_detail
playlist_detail_dynamic
playlist_detail_rcmd_get
playlist_highquality_tags
playlist_hot
playlist_import_name_task_create
playlist_import_task_status
playlist_mylike
playlist_name_update
playlist_order_update
playlist_privacy
playlist_subscribe
playlist_subscribers
playlist_tags_update
playlist_track_add
playlist_track_all
playlist_track_delete
playlist_tracks
playlist_update
playlist_update_playcount
playlist_video_recent
playmode_intelligence_list
playmode_song_vector
program_recommend
radio_sport_get
rebind
recent_listen_list
recommend_category_configs
recommend_category_set
recommend_category_songs
recommend_resource
recommend_songs
recommend_songs_dislike
recommend_songs_v1
record_recent_album
record_recent_dj
record_recent_playlist
record_recent_song
record_recent_video
record_recent_voice
register_anonimous
register_cellphone
register_checktoken_v2
register_checktoken_v3
register_neapikey
register_xeapikey
related_allvideo
related_playlist
relay_play_state_submit
rep_ugc_activity_collect
rep_ugc_activity_get
rep_ugc_exam_info_get
rep_ugc_exam_question_single_get
rep_ugc_exam_result_get
rep_ugc_exam_start
rep_ugc_exam_submit
rep_ugc_user_collect-vip
rep_ugc_user_get
rep_ugc_user_sign
rep_ugc_user_vip
resource_like
sati_resource_list
sati_resource_list_more
sati_resource_sub
sati_resource_sub_list
sati_tag_list
sati_timescene_resources_get
scrobble
scrobble_v1
search
search_default
search_hot
search_hot_detail
search_match
search_multimatch
search_suggest
search_suggest_pc
send_album
send_playlist
send_song
send_text
setting
share_resource
sheet_list
sheet_preview
sign_happy_info
signin_progress
simi_artist
simi_mv
simi_playlist
simi_song
simi_user
song_chorus
song_cloud_download
song_copyright_rcmd
song_creators
song_detail
song_downlist
song_download_url
song_download_url_v1
song_dynamic_cover
song_like
song_like_check
song_lyrics_mark
song_lyrics_mark_add
song_lyrics_mark_del
song_lyrics_mark_user_page
song_monthdownlist
song_music_detail
song_order_update
song_purchased
song_red_count
song_simi_get
song_singledownlist
song_url
song_url_match
song_url_ncmget
song_url_v1
song_url_v1_302
song_wiki_info
song_wiki_summary
starpick_comments_summary
style_album
style_artist
style_detail
style_list
style_playlist
style_preference
style_song
summary_annual
thinktank_audit_resource_detail
thinktank_audit_resource_update
threshold_detail_get
top_album
top_artists
top_list
top_mv
top_playlist
top_playlist_highquality
top_song
topic_detail
topic_detail_event_hot
topic_sublist
toplist
toplist_artist
toplist_detail
toplist_detail_v2
ugc_album_get
ugc_artist_get
ugc_artist_search
ugc_detail
ugc_mv_get
ugc_song_get
ugc_user_devote
user_account
user_audio
user_binding
user_bindingcellphone
user_cloud
user_cloud_del
user_cloud_detail
user_comment_history
user_detail
user_detail_new
user_dj
user_event
user_event_all
user_follow_mixed
user_followeds
user_follows
user_level
user_medal
user_mutualfollow_get
user_playlist
user_playlist_collect
user_playlist_create
user_record
user_replacephone
user_social_status
user_social_status_edit
user_social_status_rcmd
user_social_status_support
user_subcount
user_update
verify_getQr
verify_qrcodestatus
video_category_list
video_detail
video_detail_info
video_group
video_group_list
video_sub
video_timeline_all
video_timeline_recommend
video_url
vip_growthpoint
vip_growthpoint_details
vip_growthpoint_get
vip_growthpoint_getall
vip_info
vip_info_v2
vip_sign
vip_sign_detail
vip_sign_history
vip_sign_info
vip_tasks
vip_tasks_v1
vip_timemachine
voice_delete
voice_detail
voice_lyric
voice_upload
voicelist_detail
voicelist_list
voicelist_list_search
voicelist_my_created
voicelist_search
voicelist_trans
weblog
yunbei
yunbei_expense
yunbei_info
yunbei_rcmd_song
yunbei_rcmd_song_history
yunbei_receipt
yunbei_sign
yunbei_task_finish
yunbei_task_finish_v1
yunbei_task_list_v1
yunbei_task_recommend_song
yunbei_tasks
yunbei_tasks_todo
yunbei_today
```
