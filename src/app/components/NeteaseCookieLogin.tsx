import React, { useEffect, useRef, useState } from 'react';
import { netease } from '../services/musicPlatforms';
import { requestNeteaseBridge } from '../services/neteaseBridge';

export function NeteaseCookieLogin({ onDone }: { onDone: () => void }) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => { request.current?.abort(); void requestNeteaseBridge('cancel').catch(() => {}); }, []);
  const automatic = async () => {
    if (busy) return;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError('');
    try {
      await requestNeteaseBridge('begin', controller.signal);
      for (let attempt = 0; attempt < 120; attempt++) {
        const result = await requestNeteaseBridge('read', controller.signal);
        if (result.cookie) {
          await netease.connectCookie(result.cookie, controller.signal);
          if (!controller.signal.aborted) onDone();
          return;
        }
        await new Promise<void>(resolve => setTimeout(resolve, 1500));
      }
      throw new Error('等待登录超时，请重新连接');
    } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : '自动连接失败'); }
    finally {
      if (request.current === controller) {
        void requestNeteaseBridge('cancel').catch(() => {});
        if (!controller.signal.aborted) setBusy(false);
      }
    }
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setError('');
    try {
      await netease.connectCookie(value, controller.signal);
      if (!controller.signal.aborted) { setValue(''); onDone(); }
    } catch (error) {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : '验证失败，请重试');
    } finally { if (!controller.signal.aborted) setBusy(false); }
  };
  return <form className="netease-cookie-login" onSubmit={submit}>
    <button type="button" disabled={busy} onClick={() => void automatic()}>{busy ? '正在等待登录或验证账号…' : '打开官网并自动连接'}</button>
    {busy && <button type="button" onClick={() => { request.current?.abort(); setBusy(false); void requestNeteaseBridge('cancel').catch(() => {}); }}>取消连接</button>}
    <details><summary>首次使用：安装登录助手扩展</summary>
      <p>在 Chrome / Edge 扩展管理页开启开发者模式，点击“加载已解压的扩展程序”，选择项目中的 browser-extension/netease-login 文件夹，然后刷新 MeloRank。扩展仅在你点击连接后读取网易云凭证，传回本机 5188 端口页面。</p>
    </details>
    <a href="https://music.163.com/#/login" target="_blank" rel="noreferrer">打开网易云官网登录</a>
    <p>在官网完成登录，再导入此账号的登录凭证。关闭此标签页后需要重新导入。</p>
    <details><summary>如何获取登录凭证？</summary>
      <ol>
        <li>在 Chrome / Edge 打开官网并完成登录，确认能看到自己的账号。</li>
        <li>按 F12，进入“应用 / Application” → “存储 / Storage” → “Cookie”，选择 music.163.com。</li>
        <li>找到 MUSIC_U，复制它的“值 / Value”，在下方按 MUSIC_U=复制的值; 格式填写。</li>
        <li>返回 MeloRank，点击“验证并连接”，成功后可在“我的音乐”查看曲库。</li>
      </ol>
    </details>
    <label htmlFor="netease-cookie">网易云登录凭证</label>
    <input id="netease-cookie" type="password" autoComplete="off" spellCheck={false} placeholder="MUSIC_U=复制的值;" value={value} disabled={busy} onChange={event => setValue(event.target.value)} />
    <p className="cookie-privacy">凭证会发送给当前配置的 MeloRank 后端验证，仅保存在本标签页。请勿发送到聊天、截图或提交到仓库。</p>
    {error && <p role="alert">{error}</p>}
    <button type="submit" disabled={busy || !value.trim()}>{busy ? '正在验证账号…' : '验证并连接'}</button>
  </form>;
}
