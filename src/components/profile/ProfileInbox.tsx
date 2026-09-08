import {lazy,Suspense,useEffect,useMemo,useState} from 'react';
import {Mail,MessageCircle,X} from 'lucide-react';
import type {Member} from '../../types';
import {supabase} from '../../services/authService';
import styles from './ProfileCenter.module.css';

const MessagesCenter=lazy(()=>import('../messages/MessagesCenter'));
type MessageRow={direction:'sent'|'received';read_at?:string|null};

function initialOpen(){if(typeof window==='undefined')return false;const url=new URL(window.location.href);return url.searchParams.get('inbox')==='1'||url.pathname==='/messages'}

export default function ProfileInbox({member}:{member:Member}){
  const [open,setOpen]=useState(()=>initialOpen()),[items,setItems]=useState<MessageRow[]>([]),[error,setError]=useState('');
  const unread=useMemo(()=>items.filter(x=>x.direction==='received'&&!x.read_at).length,[items]);
  const load=async()=>{try{const {data,error}=await supabase.rpc('messages_inbox_v1',{p_limit:120});if(error)throw error;setItems((Array.isArray(data)?data:[]) as MessageRow[]);setError('')}catch(e){setError((e as Error).message)}};
  useEffect(()=>{void load();const channel=supabase.channel(`profile-inbox-badge:${member.id}`).on('postgres_changes',{event:'*',schema:'public',table:'member_messages'},()=>void load()).subscribe();return()=>{void supabase.removeChannel(channel)}},[member.id]);
  const show=()=>{setOpen(true);const url=new URL(window.location.href);url.pathname='/profile';url.searchParams.set('inbox','1');history.replaceState(null,'',`${url.pathname}${url.search}`)};
  const close=()=>{setOpen(false);void load();const url=new URL(window.location.href);url.searchParams.delete('inbox');history.replaceState(null,'',`${url.pathname}${url.search}`)};
  return <>
    <button className={styles.inboxButton} onClick={show} aria-label={unread?`Mở inbox, ${unread} tin chưa đọc`:'Mở inbox cá nhân'}><Mail/><span>Inbox</span>{unread>0&&<b className={styles.inboxBadge}>{Math.min(unread,99)}</b>}</button>
    {error&&<small className={styles.inboxError}>{error}</small>}
    {open&&<div className={styles.inboxBackdrop} onMouseDown={close}><section className={styles.inboxDialog} role="dialog" aria-modal="true" aria-label="Inbox cá nhân" onMouseDown={e=>e.stopPropagation()}><header><div><MessageCircle/><span><b>Inbox · Tường cá nhân</b><small>Tin nhắn riêng được hợp nhất vào khu vực cá nhân.</small></span></div><button className={styles.inboxClose} onClick={close} aria-label="Đóng inbox"><X/></button></header><div className={styles.inboxBody}><Suspense fallback={<div className={styles.inboxLoading}>Đang tải hộp thư…</div>}><MessagesCenter member={member}/></Suspense></div></section></div>}
  </>;
}
