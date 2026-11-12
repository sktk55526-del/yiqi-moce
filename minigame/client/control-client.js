'use strict';
const {PROTOCOL}=require('../shared/party');
class ControlClient{
 constructor(platform,changed=()=>{}){this.platform=platform;this.changed=changed;this.token='';this.sequence=0;this.socket=null;this.connected=false;this.pending=null;}
 connect(){
  if(this.connected)return Promise.resolve();
  if(this.connecting)return this.connecting;
  this.connecting=new Promise((resolve,reject)=>{
   this.connectReject=reject;
   const handlers={open:()=>{if(this.socket!==socket)return;clearTimeout(this.connectTimer);this.connected=true;this.connecting=null;this.connectReject=null;resolve();},
    message:raw=>{if(this.socket!==socket)return;let value;try{value=JSON.parse(raw);}catch{return;}this.receive(value);},
    close:()=>{if(this.socket===socket)this.disconnect('管理连接已断开，请重新登录');}};
   let socket;
   try{socket=this.platform.openSocket(handlers);this.socket=socket;}
   catch{reject(Error('无法连接管理服务器'));this.connectReject=null;return;}
   this.connectTimer=setTimeout(()=>this.disconnect('管理连接超时，请重试'),this.platform.socketTimeout||7000);
  });
  return this.connecting.catch(error=>{this.connecting=null;throw error;});
 }
 async login(password){await this.connect();return this.request('login',{password});}
 request(method,fields={}){
  if(!this.connected)return Promise.reject(Error('请先输入管理员密码'));
  if(this.pending)return Promise.reject(Error('上一项操作仍在处理中'));
  return new Promise((resolve,reject)=>{
   const id=++this.sequence,timer=setTimeout(()=>this.disconnect('管理操作超时，请重新登录并核对牌局'),8000);
   this.pending={id,method,resolve,reject,timer};
   try{this.socket.send(JSON.stringify({...fields,type:'control',protocol:PROTOCOL,id,method,token:this.token}));}
   catch{this.disconnect('管理连接已断开，请重新登录');}
  });
 }
 receive(data){
  const pending=this.pending;if(!pending||pending.id!==data.id)return;
  if(!['control-result','error'].includes(data.type))return;
  this.pending=null;clearTimeout(pending.timer);
  if(data.type==='error'){
   if(data.code==='control-auth'){this.token='';this.changed();}
   pending.reject(Error(data.message||'操作未完成'));return;
  }
  if(pending.method==='login')this.token=data.token;
  if(pending.method==='logout')this.token='';
  pending.resolve(data);this.changed();
 }
 disconnect(message=''){
  clearTimeout(this.connectTimer);const pending=this.pending;this.pending=null;
  if(pending){clearTimeout(pending.timer);pending.reject(Error(message||'已退出管理'));}
  this.connectReject?.(Error(message||'已退出管理'));this.connectReject=null;this.connecting=null;
  const socket=this.socket;this.socket=null;this.connected=false;this.token='';
  try{socket?.close();}catch{}this.changed(message);
 }
}
module.exports={ControlClient};
